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
    readOnly,
  } = props;
  const [saveModalVisible, setSaveModalVisible] = React.useState(false);
  const colorScheme = useColorScheme();
  const {colors} = useVisualTheme();
  const app = React.useContext(AppContext.Context);

  async function onPersistRecord(name, updateExist = false) {
    const payload = getRecordPayload();
    const record = {name, payload};
    if (updateExist && typeof savedRecordIdx === 'number') {
      await app.actions.updateRecord(savedRecordIdx, record);
    } else {
      await app.actions.appendRecord(record);
    }
    setSaveModalVisible(false);
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
            accessibilityLabel={tr('Save record')}
            icon={() => (
              <Icon name="content-save" size={24} color={colors.accent} />
            )}
            onPress={() => {
              if (savedRecord && typeof savedRecordIdx === 'number') {
                Alert.alert(
                  tr('Confirm'),
                  tr('Do you want to override current record?'),
                  [
                    {
                      text: tr('YES'),
                      onPress: () => {
                        onPersistRecord(savedRecord.name, true);
                        showToast({
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
