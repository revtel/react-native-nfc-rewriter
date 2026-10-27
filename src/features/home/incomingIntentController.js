import {parseIncomingLink} from './deepLink';

const MAX_PENDING_INTENTS = 16;

// One instance lives for a JS runtime, independently of the Home tab. Attachments
// own subscriptions/navigation; consumed snapshots and pending intents survive a
// navigator remount. Late work from an old attachment cannot mutate a new one.
function createIncomingIntentController(services) {
  let generation = 0;
  let owner = null;
  let pending = [];
  let initialURLConsumed = false;

  const report = (error) => services.onError?.(error);
  function flush() {
    while (owner?.ready && pending.length) {
      const target = pending.shift();
      owner.navigate(target.name, target.params);
    }
  }
  function enqueue(target) {
    if (!target) {
      return;
    }
    // Keep the latest 16 intents if startup is delayed indefinitely.
    if (pending.length === MAX_PENDING_INTENTS) {
      pending.shift();
    }
    pending.push(target);
    flush();
  }
  function attach(navigate) {
    owner?.dispose();
    const token = ++generation;
    const current = () => owner?.token === token;
    const eventTags = new Set();
    const eventURLs = new Set();
    let snapshotTagKey = null;
    let snapshotURL = null;
    let readingTag = true;
    let readingURL = !initialURLConsumed;
    let initialTag = null;
    let removeTag = () => {};
    let removeURL = () => {};
    const attachment = {
      token,
      ready: false,
      navigate,
      setReady(ready) {
        if (!current()) {
          return;
        }
        attachment.ready = ready;
        if (ready) {
          snapshotTagKey = null;
          snapshotURL = null;
        }
        flush();
      },
      dispose() {
        if (!current()) {
          return;
        }
        // Invalidate before calling transport cleanup, which can be reentrant.
        owner = null;
        removeURL();
        removeTag();
      },
    };
    owner = attachment;

    function clearTag() {
      if (!current()) {
        return;
      }
      try {
        Promise.resolve(services.clearInitialTag()).catch((error) => {
          if (current()) report(error);
        });
      } catch (error) {
        report(error);
      }
    }
    function receiveTag(tag) {
      if (!current() || !tag || typeof tag !== 'object') {
        return;
      }
      const key = JSON.stringify(tag);
      if (readingTag) eventTags.add(key);
      // A snapshot delivered first can overlap one bootstrap event. Consume only
      // that overlap, never suppress every future scan of the same card.
      if (snapshotTagKey === key) {
        snapshotTagKey = null;
        clearTag();
        return;
      }
      enqueue({name: 'TagDetail', params: {tag}});
      clearTag();
    }
    function receiveURL(url) {
      if (!current() || typeof url !== 'string') {
        return;
      }
      if (readingURL) eventURLs.add(url);
      if (snapshotURL === url) {
        snapshotURL = null;
        return;
      }
      enqueue(parseIncomingLink(url));
    }

    // Subscribe before beginning either asynchronous initial read.
    removeTag = services.subscribeTag(receiveTag);
    removeURL = services.subscribeURL(receiveURL);

    // Native cache is fresh on each attachment: it can receive a tag while no
    // JS owner is attached. Unlike getInitialURL, it is not an immutable launch value.
    const tagRead = Promise.resolve()
      .then(() => services.getInitialTag())
      .then((tag) => {
        if (!current()) return;
        initialTag = tag;
        if (tag && typeof tag === 'object') {
          const key = JSON.stringify(tag);
          if (!eventTags.has(key)) {
            enqueue({name: 'TagDetail', params: {tag}});
            snapshotTagKey = attachment.ready ? null : key;
          }
          clearTag();
        }
      })
      .catch((error) => {
        if (current()) report(error);
      })
      .finally(() => {
        if (current()) {
          readingTag = false;
          eventTags.clear();
        }
      });

    // Read independently even if NFC snapshot access fails. Delay initial URL
    // delivery until the initial tag decision, since legacy launch paths may
    // supply both for one physical NFC activity.
    if (!initialURLConsumed) {
      Promise.resolve()
        .then(() => services.getInitialURL())
        .then(async (url) => {
          await tagRead;
          if (!current()) return;
          initialURLConsumed = true;
          if (!initialTag && typeof url === 'string' && !eventURLs.has(url)) {
            enqueue(parseIncomingLink(url));
            snapshotURL = attachment.ready ? null : url;
          }
        })
        .catch((error) => {
          if (current()) report(error);
        })
        .finally(() => {
          if (current()) {
            readingURL = false;
            eventURLs.clear();
          }
        });
    }

    return attachment;
  }
  return {attach};
}

export {createIncomingIntentController, MAX_PENDING_INTENTS};
