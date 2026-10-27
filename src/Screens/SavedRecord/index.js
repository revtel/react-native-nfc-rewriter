import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import * as React from 'react';
import {
  Alert,
  Pressable,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as AppContext from '../../AppContext';
import RecordItem from './RecordItem';
import SaveRecordModal from '../../Components/SaveRecordModal';
import {getRecordNavigationTarget} from '../../features/records/recordModel';
import {
  classifyLibraryRecord,
  summarizeLibrary,
} from '../../features/record-library/recordInfo';
import {useRecordLibraryTransfer} from '../../features/record-library/useRecordLibraryTransfer';
import ImportPreview from '../../features/record-library/ImportPreview';
import {useVisualTheme} from '../../visual/theme';

const EMPTY_RECORDS = [];

function LibraryButton({label, onPress, disabled, styles}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.control, disabled && styles.disabled]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

function SavedRecordScreen({navigation}) {
  useTranslation();
  const app = React.useContext(AppContext.Context);
  const recordList = app.state.storageCache || EMPTY_RECORDS;
  const ready = app.state.storageStatus === 'ready';
  const revision = app.state.storageRevision;
  const [recordToCopy, setRecordToCopy] = React.useState(null);
  const [changing, setChanging] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const mounted = React.useRef(false);
  const focused = React.useRef(
    navigation.isFocused ? navigation.isFocused() : true,
  );
  const mutationBusy = React.useRef(false);
  const transfer = useRecordLibraryTransfer(app, navigation);
  const {colors, spacing, type, isDark} = useVisualTheme();
  const styles = React.useMemo(
    () => makeStyles(colors, spacing, type),
    [colors, spacing, type],
  );
  React.useEffect(() => {
    mounted.current = true;
    const blur = navigation.addListener?.('blur', () => {
      focused.current = false;
      setRecordToCopy(null);
    });
    const focus = navigation.addListener?.('focus', () => {
      focused.current = true;
    });
    return () => {
      mounted.current = false;
      blur?.();
      focus?.();
    };
  }, [navigation]);
  const active = () => mounted.current && focused.current;
  async function changeRecords(action) {
    if (!active() || mutationBusy.current || !ready || transfer.busy)
      return false;
    mutationBusy.current = true;
    setChanging(true);
    try {
      await action();
      return true;
    } catch (error) {
      if (active())
        Alert.alert(
          tr('Could not change saved records'),
          tr(
            error?.code === 'RECORD_STALE'
              ? 'Saved records changed. Please review the list and try again.'
              : 'Saved records could not be read or saved reliably. Reload them before making changes.',
          ),
        );
      return false;
    } finally {
      mutationBusy.current = false;
      if (mounted.current) setChanging(false);
    }
  }
  async function retry() {
    if (!active() || mutationBusy.current) return;
    mutationBusy.current = true;
    setRetrying(true);
    try {
      await app.actions.initStorage();
    } catch (_) {
      /* The trusted storage status renders the retry guidance. */
    } finally {
      mutationBusy.current = false;
      if (mounted.current) setRetrying(false);
    }
  }
  function clearAll() {
    if (!ready || transfer.busy || changing) return;
    Alert.alert(
      tr('CLEAR ALL RECORDS'),
      tr('Delete all saved records? This cannot be undone.'),
      [
        {
          text: tr('DELETE ALL'),
          style: 'destructive',
          onPress: () =>
            changeRecords(() =>
              app.actions.setStorage([], {expectedRevision: revision}),
            ),
        },
        {text: tr('CANCEL'), style: 'cancel'},
      ],
    );
  }
  function removeIdx(idx, name) {
    if (!ready || transfer.busy || changing) return;
    const expectedRecord = recordList[idx];
    Alert.alert(tr('DELETE RECORD'), tr('Delete “{{name}}”?', {name}), [
      {
        text: tr('DELETE'),
        style: 'destructive',
        onPress: () =>
          changeRecords(() =>
            app.actions.removeRecord(idx, {
              expectedRecord,
              expectedRevision: revision,
            }),
          ),
      },
      {text: tr('CANCEL'), style: 'cancel'},
    ]);
  }
  function openRecord(idx, record) {
    if (
      !active() ||
      !ready ||
      transfer.busy ||
      changing ||
      !classifyLibraryRecord(record).supported
    )
      return;
    const target = getRecordNavigationTarget(record, idx);
    if (target)
      navigation.navigate(target.name, {
        ...target.params,
        savedRecordRevision: revision,
      });
  }
  const sections = React.useMemo(() => {
    const groups = new Map(
      ['script', 'Ndef', 'NfcA', 'NfcV', 'IsoDep', 'unsupported'].map(
        (kind) => [kind, []],
      ),
    );
    summarizeLibrary(recordList).entries.forEach((entry) =>
      groups.get(entry.kind).push({...entry, record: recordList[entry.index]}),
    );
    return [...groups]
      .filter(([, data]) => data.length)
      .map(([kind, data]) => ({
        kind,
        title:
          kind === 'script'
            ? 'NFC Scripts'
            : kind === 'unsupported'
            ? 'Other records'
            : kind === 'Ndef'
            ? 'NDEF'
            : kind,
        data,
      }));
  }, [recordList]);
  const disabled = !ready || transfer.busy || changing;
  const busyText = {
    exporting: 'Preparing backup…',
    saving: 'Choose a location in the system save dialog.',
    picking: 'Choose a backup file.',
    reading: 'Reading backup…',
    committing: 'Adding records…',
  }[transfer.phase];
  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {tr('MY RECORDS')}
      </Text>
      <Text style={styles.subtitle}>
        {tr('Saved NFC workflows and tag records.')}
      </Text>
      <View style={styles.controls}>
        <LibraryButton
          label={tr('Export all')}
          disabled={disabled || recordList.length === 0}
          onPress={transfer.confirmExport}
          styles={styles}
        />
        <LibraryButton
          label={tr('Import file')}
          disabled={disabled}
          onPress={transfer.importRecords}
          styles={styles}
        />
      </View>
      {!!transfer.notice && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {transfer.notice}
        </Text>
      )}
      {!!busyText && (
        <View>
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {tr(busyText)}
          </Text>
          {transfer.phase !== 'committing' && (
            <LibraryButton
              label={tr('CANCEL')}
              onPress={transfer.cancel}
              styles={styles}
            />
          )}
        </View>
      )}
      {!ready && (
        <View style={styles.other}>
          <Text style={styles.emptyTitle}>
            {tr(
              app.state.storageStatus === 'loading'
                ? 'Loading saved records…'
                : 'Could not load saved records',
            )}
          </Text>
          {app.state.storageStatus !== 'loading' && (
            <>
              <Text style={styles.subtitle}>
                {tr(
                  'Your records could not be read. Retry loading before making changes.',
                )}
              </Text>
              <LibraryButton
                label={tr('Retry')}
                disabled={retrying}
                onPress={retry}
                styles={styles}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
  return (
    <SafeAreaView edges={{top: true, bottom: true}} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SectionList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        sections={ready ? sections : []}
        keyExtractor={(item) => String(item.index)}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          ready ? (
            <View style={styles.emptyState}>
              <Icon name="archive-outline" size={36} color={colors.accent} />
              <Text style={styles.emptyTitle}>
                {tr('No saved records yet')}
              </Text>
              <Text style={styles.emptyText}>
                {tr(
                  'Save a writer, transceive, or Flow Script to find it here.',
                )}
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={({section}) => (
          <View style={styles.groupHeader}>
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {tr(section.title)}
            </Text>
            <Text style={styles.groupCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({item}) =>
          item.supported ? (
            <RecordItem
              record={item.record}
              idx={item.index}
              removeIdx={removeIdx}
              goToHandler={(record) => openRecord(item.index, record)}
              onCopy={() => {
                if (!disabled && active()) setRecordToCopy(item.record);
              }}
            />
          ) : (
            <View style={styles.other}>
              <Text style={styles.emptyTitle}>
                {item.name ?? tr('Record {{index}}', {index: item.index + 1})}
              </Text>
              <Text style={styles.subtitle}>
                {tr(
                  'Preserved for backup. This version cannot open this record.',
                )}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          ready && recordList.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Clear all records')}
              accessibilityState={{disabled}}
              disabled={disabled}
              onPress={clearAll}
              style={[styles.clearAll, disabled && styles.disabled]}
            >
              <Icon
                name="delete-sweep-outline"
                size={20}
                color={colors.danger}
              />
              <Text style={styles.clearAllText}>{tr('CLEAR ALL RECORDS')}</Text>
            </Pressable>
          ) : null
        }
      />
      <ImportPreview
        preview={transfer.preview}
        committing={transfer.phase === 'committing'}
        onCancel={transfer.cancel}
        onConfirm={transfer.confirmImport}
      />
      <SaveRecordModal
        title={tr('COPY THIS RECORD AS')}
        visible={!!recordToCopy}
        onClose={() => setRecordToCopy(null)}
        onPersistRecord={async (name) => {
          if (!recordToCopy) return false;
          const success = await changeRecords(() =>
            app.actions.appendRecord({name, payload: recordToCopy.payload}),
          );
          if (success && active()) setRecordToCopy(null);
          return success;
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scroll: {flex: 1},
    controls: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    control: {
      minHeight: 48,
      justifyContent: 'center',
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 8,
    },
    controlText: {color: colors.accent, fontSize: type.body, fontWeight: '700'},
    disabled: {opacity: 0.45},
    notice: {
      color: colors.text,
      fontSize: type.body,
      paddingVertical: spacing.md,
    },
    other: {
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginBottom: spacing.md,
    },
    content: {paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl},
    header: {paddingTop: spacing.xl, paddingBottom: spacing.xl},
    title: {color: colors.text, fontSize: type.hero, fontWeight: '800'},
    subtitle: {
      color: colors.textMuted,
      fontSize: type.body,
      marginTop: spacing.sm,
    },
    group: {marginBottom: spacing.xl},
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingBottom: spacing.sm,
      marginBottom: spacing.md,
    },
    groupTitle: {
      flex: 1,
      color: colors.text,
      fontSize: type.label,
      fontWeight: '800',
    },
    groupCount: {
      color: colors.textMuted,
      fontSize: type.body,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.xl,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: type.label,
      fontWeight: '700',
      marginTop: spacing.md,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: type.body,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    clearAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      padding: spacing.sm,
    },
    clearAllText: {
      color: colors.danger,
      fontSize: type.body,
      fontWeight: '700',
    },
  });
}

export default SavedRecordScreen;
