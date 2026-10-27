import * as React from 'react';
import {Alert} from 'react-native';
import {translateText as tr} from '../../i18n';
import {version as appVersion} from '../../../package.json';
import {createDocumentOperation} from '../../services/records/documentService';
import {createArchive, parseArchive} from './archive';
import {summarizeLibrary} from './recordInfo';

function transferErrorMessage(error) {
  const code = error?.code;
  if (['archive-depth-limit', 'archive-node-limit'].includes(code))
    return tr(
      'The backup exceeds supported complexity limits (64 levels or 100,000 values).',
    );
  if (
    [
      'archive-entry-limit',
      'archive-library-bytes-limit',
      'archive-bytes-limit',
      'ARCHIVE_TOO_LARGE',
    ].includes(code)
  )
    return tr(
      'The backup exceeds the supported limits: 5 MiB file, 1 MiB library, 10,000 records.',
    );
  if (code === 'archive-unsupported-version')
    return tr('This backup version is not supported by this app.');
  if (
    [
      'archive-invalid-value',
      'archive-number-loss',
      'RECORD_INVALID_DATA',
    ].includes(code)
  )
    return tr('The backup contains values that cannot be preserved safely.');
  if (code === 'DOCUMENT_UNAVAILABLE')
    return tr('This action is unavailable in the installed app.');
  if (code === 'DOCUMENT_SAVE_FAILED')
    return tr('The file could not be saved. Please try again.');
  if (code === 'IMPORT_PREVIEW_EXPIRED')
    return tr('Import preview expired. Please select the backup again.');
  if (['STORAGE_NOT_READY', 'STORAGE_WRITE_UNCERTAIN'].includes(code))
    return tr(
      'Saved records could not be read or saved reliably. Reload them before making changes.',
    );
  if (
    code === 'INVALID_UTF8' ||
    (typeof code === 'string' && code.startsWith('archive-'))
  )
    return tr(
      'Invalid backup file. Choose a backup created by NFC Open ReWriter.',
    );
  return tr('Could not access the file. Please choose it again.');
}

// Tokens invalidate late picker/read/preview results. A commit, once submitted,
// remains a real repository operation even when navigation hides its result.
function useRecordLibraryTransfer(app, navigation) {
  const appRef = React.useRef(app);
  appRef.current = app;
  const mounted = React.useRef(false);
  const focused = React.useRef(
    navigation.isFocused ? navigation.isFocused() : true,
  );
  const generation = React.useRef(0);
  const operation = React.useRef(null);
  const busy = React.useRef(false);
  const runningToken = React.useRef(null);
  const phaseRef = React.useRef(null);
  const previewRef = React.useRef(null);
  const [phase, setPhase] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const available = () => mounted.current && focused.current;
  const current = (token) => available() && generation.current === token;

  function discard(value) {
    if (value?.plan?.receipt)
      appRef.current.actions.discardRecordImport(value.plan.receipt);
  }
  function invalidate() {
    generation.current += 1;
    operation.current?.cancel();
    operation.current = null;
    if (phaseRef.current !== 'committing') discard(previewRef.current);
    previewRef.current = null;
    // A queued commit is not canceled by invalidating its presentation.
    if (phaseRef.current !== 'committing') {
      busy.current = false;
      runningToken.current = null;
    }
  }
  React.useEffect(() => {
    mounted.current = true;
    const offBlur = navigation.addListener?.('blur', () => {
      focused.current = false;
      invalidate();
      setPreview(null);
      setPhase(null);
    });
    const offFocus = navigation.addListener?.('focus', () => {
      focused.current = true;
      if (phaseRef.current === 'committing') setPhase('committing');
    });
    return () => {
      mounted.current = false;
      invalidate();
      offBlur?.();
      offFocus?.();
    };
    // Lifecycle refs deliberately outlive individual action closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  function start(nextPhase) {
    if (
      !available() ||
      busy.current ||
      appRef.current.state.storageStatus !== 'ready'
    )
      return null;
    busy.current = true;
    const token = ++generation.current;
    runningToken.current = token;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    setNotice(null);
    return token;
  }
  function finish(token) {
    if (runningToken.current !== token) return;
    // Refocusing can redisplay this submitted commit after blur invalidated its
    // result notices. Its owner still releases that busy presentation on finish.
    const clearPhase =
      current(token) || (phaseRef.current === 'committing' && available());
    busy.current = false;
    runningToken.current = null;
    phaseRef.current = null;
    operation.current = null;
    if (clearPhase) setPhase(null);
  }
  function showError(title, error, token) {
    if (current(token)) Alert.alert(tr(title), transferErrorMessage(error));
  }
  async function exportRecords() {
    const token = start('exporting');
    if (token === null) return;
    try {
      const snapshot = await appRef.current.actions.getRecordSnapshot();
      if (!current(token)) return;
      if (snapshot.records.length === 0) return;
      const text = createArchive(snapshot.records, {
        exportedAt: new Date().toISOString(),
        appVersion,
      });
      const document = createDocumentOperation();
      operation.current = document;
      setPhase('saving');
      const result = await document.saveArchive(
        text,
        `nfc-records-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (result && current(token))
        setNotice(
          tr(
            result.cleanupPending
              ? 'Backup saved. Temporary backup data will be cleaned up later.'
              : 'Backup saved.',
          ),
        );
    } catch (error) {
      showError('Could not export records', error, token);
    } finally {
      finish(token);
    }
  }
  function confirmExport() {
    if (
      !available() ||
      busy.current ||
      appRef.current.state.storageStatus !== 'ready' ||
      !appRef.current.state.storageCache.length
    )
      return;
    const token = generation.current;
    Alert.alert(
      tr('Export all records'),
      tr(
        'Backup contains {{count}} records. The file is not encrypted. Your selected storage service may sync it.',
        {count: appRef.current.state.storageCache.length},
      ),
      [
        {text: tr('CANCEL'), style: 'cancel'},
        {
          text: tr('Choose location'),
          onPress: () => {
            if (current(token)) return exportRecords();
          },
        },
      ],
    );
  }
  async function buildPreview(source, token) {
    const plan = await appRef.current.actions.previewRecordImport(
      source.incoming,
    );
    const next = {...source, plan};
    if (!current(token)) {
      discard(next);
      return;
    }
    previewRef.current = next;
    setPreview(next);
  }
  async function importRecords() {
    const token = start('picking');
    if (token === null) return;
    try {
      discard(previewRef.current);
      previewRef.current = null;
      setPreview(null);
      const document = createDocumentOperation();
      operation.current = document;
      const file = await document.pickArchive();
      if (!file || !current(token)) return;
      setPhase('reading');
      const parsed = parseArchive(file.text);
      await buildPreview(
        {
          incoming: parsed.records,
          metadata: parsed.metadata,
          name: file.name,
          summary: summarizeLibrary(parsed.records),
        },
        token,
      );
    } catch (error) {
      showError('Could not import records', error, token);
    } finally {
      finish(token);
    }
  }
  function cancel() {
    if (!available() || phaseRef.current === 'committing') return;
    invalidate();
    phaseRef.current = null;
    setPreview(null);
    setPhase(null);
  }
  async function confirmImport() {
    const selected = previewRef.current;
    if (!selected || selected.plan.addedCount === 0) return;
    const token = start('committing');
    if (token === null) return;
    try {
      const result = await appRef.current.actions.commitRecordImport(
        selected.plan.receipt,
      );
      previewRef.current = null;
      if (current(token)) {
        setPreview(null);
        setNotice(tr('Added {{count}} records.', {count: result.addedCount}));
      }
    } catch (error) {
      if (error?.code === 'IMPORT_PREVIEW_STALE' && current(token)) {
        previewRef.current = null;
        setPreview(null);
        try {
          await buildPreview(selected, token);
          if (current(token))
            setNotice(
              tr(
                'Existing records changed. Review the updated import counts before confirming again.',
              ),
            );
        } catch (replanError) {
          showError('Could not import records', replanError, token);
        }
      } else {
        discard(selected);
        if (current(token)) {
          previewRef.current = null;
          setPreview(null);
        }
        showError('Could not import records', error, token);
      }
    } finally {
      finish(token);
    }
  }
  return {
    phase,
    preview,
    notice,
    confirmExport,
    importRecords,
    confirmImport,
    cancel,
    busy: !!phase,
  };
}

export {useRecordLibraryTransfer, transferErrorMessage};
