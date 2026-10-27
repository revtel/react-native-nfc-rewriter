import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import * as React from 'react';
import {Appbar} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SaveRecordModal from './SaveRecordModal';
import * as AppContext from '../AppContext';
import {Alert, StatusBar, useColorScheme} from 'react-native';
import {showToast} from './Toast';
import {useVisualTheme} from '../visual/theme';

function ScreenHeader(props) {
  useTranslation();
  const {
    navigation,
    title,
    getRecordPayload,
    savedRecord,
    savedRecordIdx,
    savedRecordRevision,
    readOnly,
  } = props;
  const [saveModalVisible, setSaveModalVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const saveLock = React.useRef(false);
  const mounted = React.useRef(true);
  const expectedRecord = React.useRef(savedRecord);
  const expectedRevision = React.useRef(savedRecordRevision);
  const colorScheme = useColorScheme();
  const {colors} = useVisualTheme();
  const app = React.useContext(AppContext.Context);
  const renderSaveIcon = React.useCallback(
    () => <Icon name="content-save" size={24} color={colors.accent} />,
    [colors.accent],
  );

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  React.useEffect(() => {
    expectedRecord.current = savedRecord;
    expectedRevision.current = savedRecordRevision;
  }, [savedRecord, savedRecordRevision]);

  async function onPersistRecord(name, updateExist = false) {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    try {
      if (app.state.storageStatus && app.state.storageStatus !== 'ready') {
        const failure = new Error('STORAGE_NOT_READY');
        failure.code = 'STORAGE_NOT_READY';
        throw failure;
      }
      const payload = getRecordPayload();
      const record = {name, payload};
      if (updateExist && typeof savedRecordIdx === 'number') {
        if (!Number.isSafeInteger(expectedRevision.current) || expectedRevision.current < 0) {
          const failure = new Error('RECORD_STALE');
          failure.code = 'RECORD_STALE';
          throw failure;
        }
        const verified = await app.actions.updateRecordSnapshot(savedRecordIdx, record, {
          expectedRecord: expectedRecord.current,
          expectedRevision: expectedRevision.current,
        });
        expectedRecord.current = verified.records[savedRecordIdx];
        expectedRevision.current = verified.revision;
      } else {
        await app.actions.appendRecord(record);
      }
      if (mounted.current) setSaveModalVisible(false);
      return true;
    } catch (error) {
      if (mounted.current) {
        const message = error?.code === 'RECORD_STALE'
          ? 'Saved records changed. Reopen the record before updating it.'
          : ['STORAGE_NOT_READY', 'STORAGE_WRITE_UNCERTAIN'].includes(error?.code)
          ? 'Saved records could not be read or saved reliably. Reload them before making changes.'
          : 'The record could not be saved. Please try again.';
        Alert.alert(tr('Could not save record'), tr(message));
      }
      return false;
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <Appbar.Header style={{backgroundColor: colors.surface}}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={title} titleStyle={{color: colors.text}} />
        {!!getRecordPayload && !readOnly && (
          <Appbar.Action
            disabled={saving}
            accessibilityLabel={tr('Save record')}
            icon={renderSaveIcon}
            onPress={() => {
              if (savedRecord && typeof savedRecordIdx === 'number') {
                Alert.alert(
                  tr('Confirm'),
                  tr('Do you want to override current record?'),
                  [
                    {
                      text: tr('YES'),
                      onPress: async () => {
                        const success = await onPersistRecord(savedRecord.name, true);
                        if (success && mounted.current) showToast({
                          message: tr(
                            '“{{name}}” has been updated successfully!',
                            {name: savedRecord.name},
                          ),
                          type: 'success',
                        });
                      },
                    },
                    {text: tr('No')},
                  ],
                );
              } else {
                setSaveModalVisible(true);
              }
            }}
          />
        )}
      </Appbar.Header>

      <SaveRecordModal
        visible={saveModalVisible}
        onClose={() => setSaveModalVisible(false)}
        onPersistRecord={onPersistRecord}
      />
    </>
  );
}

export default ScreenHeader;
