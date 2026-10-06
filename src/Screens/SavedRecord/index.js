import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import * as React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
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
import {
  getRecordNavigationTarget,
  groupRecordsByTech,
} from '../../features/records/recordModel';
import {useVisualTheme} from '../../visual/theme';

function SavedRecordScreen({navigation}) {
  useTranslation();
  const app = React.useContext(AppContext.Context);
  const recordList = app.state.storageCache || [];
  const [recordToCopy, setRecordToCopy] = React.useState(null);
  const {colors, spacing, type, isDark} = useVisualTheme();
  const styles = React.useMemo(
    () => makeStyles(colors, spacing, type),
    [colors, spacing, type],
  );

  function clearAll() {
    Alert.alert(
      tr('CLEAR ALL RECORDS'),
      tr('Delete all saved records? This cannot be undone.'),
      [
        {
          text: tr('DELETE ALL'),
          style: 'destructive',
          onPress: async () => app.actions.setStorage([]),
        },
        {text: tr('CANCEL'), style: 'cancel'},
      ],
    );
  }

  function removeIdx(idx, name) {
    Alert.alert(tr('DELETE RECORD'), tr('Delete “{{name}}”?', {name}), [
      {
        text: tr('DELETE'),
        style: 'destructive',
        onPress: async () => app.actions.removeRecord(idx),
      },
      {text: tr('CANCEL'), style: 'cancel'},
    ]);
  }

  function goToHandler(savedRecordIdx, savedRecord) {
    const target = getRecordNavigationTarget(savedRecord, savedRecordIdx);
    if (target) {
      navigation.navigate(target.name, target.params);
    }
  }

  const {ndefRecords, nfcARecords, nfcVRecords, isoDepRecords, scriptRecords} =
    groupRecordsByTech(recordList);
  const groups = [
    {title: tr('NFC Scripts'), items: scriptRecords},
    {title: 'NDEF', items: ndefRecords},
    {title: 'NfcA', items: nfcARecords},
    {title: 'NfcV', items: nfcVRecords},
    {title: 'IsoDep', items: isoDepRecords},
  ];

  return (
    <SafeAreaView edges={{top: true, bottom: true}} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{tr('MY RECORDS')}</Text>
          <Text style={styles.subtitle}>
            {tr('Saved NFC workflows and tag records.')}
          </Text>
        </View>

        {recordList.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="archive-outline" size={36} color={colors.accent} />
            <Text style={styles.emptyTitle}>{tr('No saved records yet')}</Text>
            <Text style={styles.emptyText}>
              {tr('Save a writer, transceive, or Flow Script to find it here.')}
            </Text>
          </View>
        ) : (
          <>
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <View key={groups.indexOf(group)} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <Text style={styles.groupCount}>{group.items.length}</Text>
                  </View>
                  {group.items.map(({record, idx}) => (
                    <RecordItem
                      key={idx}
                      record={record}
                      idx={idx}
                      removeIdx={removeIdx}
                      goToHandler={(item) => goToHandler(idx, item)}
                      onCopy={() => setRecordToCopy(record)}
                    />
                  ))}
                </View>
              ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Clear all records')}
              onPress={clearAll}
              style={({pressed}) => [
                styles.clearAll,
                pressed && {backgroundColor: colors.surfaceMuted},
              ]}
            >
              <Icon
                name="delete-sweep-outline"
                size={20}
                color={colors.danger}
              />
              <Text style={styles.clearAllText}>{tr('CLEAR ALL RECORDS')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <SaveRecordModal
        title={tr('COPY THIS RECORD AS')}
        visible={!!recordToCopy}
        onClose={() => setRecordToCopy(null)}
        onPersistRecord={async (name) => {
          if (!recordToCopy) {
            return false;
          }
          await app.actions.appendRecord({name, payload: recordToCopy.payload});
          setRecordToCopy(null);
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scroll: {flex: 1},
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
