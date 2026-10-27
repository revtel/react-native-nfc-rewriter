import {
  createIncomingIntentController,
  MAX_PENDING_INTENTS,
} from '../src/features/home/incomingIntentController';

const tag = {ndefMessage: [{tnf: 1, type: [85], payload: [4, 97]}]};
const promotion = 'https://revtel.github.io/react-native-nfc-rewriter/';
const tick = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}
function setup(overrides = {}) {
  let tagListener;
  let urlListener;
  const removals = [];
  const services = {
    getInitialTag: jest.fn().mockResolvedValue(null),
    getInitialURL: jest.fn().mockResolvedValue(null),
    clearInitialTag: jest.fn().mockResolvedValue(undefined),
    onError: jest.fn(),
    subscribeTag: jest.fn((callback) => {
      tagListener = callback;
      const remove = jest.fn();
      removals.push(remove);
      return remove;
    }),
    subscribeURL: jest.fn((callback) => {
      urlListener = callback;
      const remove = jest.fn();
      removals.push(remove);
      return remove;
    }),
    ...overrides,
  };
  const controller = createIncomingIntentController(services);
  const navigate = jest.fn();
  const owner = controller.attach(navigate);
  return {
    services,
    controller,
    navigate,
    owner,
    removals,
    tag: (value = tag) => tagListener(value),
    url: (value = promotion) => urlListener(value),
  };
}

test('subscribes before initial reads and queues a real NFC result until startup is ready', async () => {
  const initial = deferred();
  const x = setup({getInitialTag: jest.fn(() => initial.promise)});
  expect(x.services.subscribeTag).toHaveBeenCalledTimes(1);
  expect(x.services.subscribeURL).toHaveBeenCalledTimes(1);
  expect(x.services.getInitialTag).not.toHaveBeenCalled();
  initial.resolve(tag);
  await tick();
  expect(x.navigate).not.toHaveBeenCalled();
  x.owner.setReady(true);
  expect(x.navigate).toHaveBeenCalledWith('TagDetail', {tag});
  expect(x.services.clearInitialTag).toHaveBeenCalledTimes(1);
});

test('deduplicates an event before its initial snapshot and permits identical later scans', async () => {
  const initial = deferred();
  const x = setup({getInitialTag: jest.fn(() => initial.promise)});
  await tick();
  x.tag();
  initial.resolve({...tag});
  await tick();
  x.owner.setReady(true);
  expect(x.navigate).toHaveBeenCalledTimes(1);
  x.tag();
  x.tag();
  expect(x.navigate).toHaveBeenCalledTimes(3);
});

test('deduplicates one snapshot/event startup overlap, not two later deliberate events', async () => {
  const x = setup({getInitialTag: jest.fn().mockResolvedValue(tag)});
  await tick();
  x.tag();
  x.owner.setReady(true);
  expect(x.navigate).toHaveBeenCalledTimes(1);
  x.tag();
  expect(x.navigate).toHaveBeenCalledTimes(2);
});

test('continues ordinary URL delivery if initial NFC lookup fails', async () => {
  const x = setup({
    getInitialTag: jest.fn().mockRejectedValue(new Error('NFC unavailable')),
    getInitialURL: jest.fn().mockResolvedValue(promotion),
  });
  await tick();
  x.owner.setReady(true);
  expect(x.navigate).toHaveBeenCalledWith('MainTabs', {screen: 'HomeTab'});
  expect(x.services.onError).toHaveBeenCalledTimes(1);
});

test('a cold NFC snapshot takes precedence over a legacy simultaneous initial URL', async () => {
  const x = setup({
    getInitialTag: jest.fn().mockResolvedValue(tag),
    getInitialURL: jest.fn().mockResolvedValue(promotion),
  });
  await tick();
  x.owner.setReady(true);
  expect(x.navigate.mock.calls).toEqual([['TagDetail', {tag}]]);
});

test('URL events during the initial read are delivered once and sharing only opens an editor', async () => {
  const initial = deferred();
  const x = setup({getInitialURL: jest.fn(() => initial.promise)});
  const record = {name: 'Example', payload: {tech: 'Ndef'}};
  const url = `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(
    JSON.stringify(record),
  )}`;
  x.url(url);
  initial.resolve(url);
  await tick();
  x.owner.setReady(true);
  expect(x.navigate.mock.calls).toEqual([['NdefWrite', {savedRecord: record}]]);
  x.url(url);
  expect(x.navigate).toHaveBeenCalledTimes(2);
});

test('disposal removes subscriptions and prevents late initial work from navigating or clearing cache', async () => {
  const initial = deferred();
  const x = setup({getInitialTag: jest.fn(() => initial.promise)});
  await tick();
  x.owner.dispose();
  initial.resolve(tag);
  await tick();
  x.owner.setReady(true);
  expect(x.navigate).not.toHaveBeenCalled();
  expect(x.services.clearInitialTag).not.toHaveBeenCalled();
  expect(x.removals.every((remove) => remove.mock.calls.length === 1)).toBe(
    true,
  );
});

test('a stale owner cannot clear a replacement owner listener or consume its pending snapshot', async () => {
  const oldRead = deferred();
  const newRead = deferred();
  const x = setup({
    getInitialTag: jest
      .fn()
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise),
  });
  await tick();
  const oldTagCallback = x.services.subscribeTag.mock.calls[0][0];
  x.owner.dispose();
  const nextNavigate = jest.fn();
  const next = x.controller.attach(nextNavigate);
  await tick();
  x.owner.dispose();
  oldTagCallback(tag);
  oldRead.resolve(tag);
  await tick();
  expect(x.services.clearInitialTag).not.toHaveBeenCalled();
  expect(x.removals[2]).not.toHaveBeenCalled();
  newRead.resolve(tag);
  await tick();
  next.setReady(true);
  expect(nextNavigate).toHaveBeenCalledTimes(1);
  expect(x.navigate).not.toHaveBeenCalled();
});

test('consumed initial inputs are not replayed on remount, including while cache clear is pending', async () => {
  const clear = deferred();
  const x = setup({
    // Native clear empties storage before acknowledging its bridge callback.
    getInitialTag: jest.fn().mockResolvedValueOnce(tag).mockResolvedValue(null),
    clearInitialTag: jest.fn(() => clear.promise),
  });
  await tick();
  x.owner.setReady(true);
  x.owner.dispose();
  const nextNavigate = jest.fn();
  const next = x.controller.attach(nextNavigate);
  next.setReady(true);
  clear.resolve();
  await tick();
  expect(x.services.getInitialTag).toHaveBeenCalledTimes(2);
  expect(x.services.getInitialURL).toHaveBeenCalledTimes(1);
  expect(nextNavigate).not.toHaveBeenCalled();
  x.tag();
  expect(nextNavigate).toHaveBeenCalledTimes(1);
});

test('pending startup intent survives owner remount and the queue keeps only the latest bounded inputs', async () => {
  const x = setup();
  await tick();
  for (let id = 0; id < MAX_PENDING_INTENTS + 2; id += 1) x.tag({id});
  x.owner.dispose();
  const nextNavigate = jest.fn();
  const next = x.controller.attach(nextNavigate);
  next.setReady(true);
  expect(nextNavigate).toHaveBeenCalledTimes(MAX_PENDING_INTENTS);
  expect(nextNavigate.mock.calls[0]).toEqual(['TagDetail', {tag: {id: 2}}]);
  expect(nextNavigate.mock.calls.at(-1)).toEqual([
    'TagDetail',
    {tag: {id: MAX_PENDING_INTENTS + 1}},
  ]);
});

test('recovers a fresh native tag cached while the navigator has no owner', async () => {
  const x = setup({
    getInitialTag: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(tag),
  });
  await tick();
  x.owner.dispose();
  // iOS receives a new activity in the detached interval. There is no app
  // listener to receive an event, but native cache retains it for the new owner.
  const nextNavigate = jest.fn();
  const next = x.controller.attach(nextNavigate);
  await tick();
  next.setReady(true);
  expect(nextNavigate.mock.calls).toEqual([['TagDetail', {tag}]]);
  expect(x.navigate).not.toHaveBeenCalled();
});
