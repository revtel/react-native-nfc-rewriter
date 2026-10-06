import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import React from 'react';
import {Alert, StyleSheet, View, Text} from 'react-native';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
} from 'react-native-draggable-flatlist';
import {SafeAreaView} from 'react-native-screens/experimental';
import {Button} from 'react-native-paper';
import CustomTransceiveModal from '../../Components/CustomTransceiveModal';
import CommandItem from '../../Components/CustomCommandItem';
import NfcProxy from '../../NfcProxy';
import ScreenHeader from '../../Components/ScreenHeader';
import {NfcTech} from 'react-native-nfc-manager';
import {
  appendCommand,
  moveCommand,
  removeCommand,
  replaceCommand,
  updateParameter,
} from '../../features/transceive/commandList';
import {useVisualTheme} from '../../visual/theme';

function CustomTransceiveScreen(props) {
  useTranslation();
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);
  const {params} = props.route;
  const nfcTech = params.savedRecord?.payload.tech || params.nfcTech;
  const [showCommandModal, setShowCommandModal] = React.useState(false);
  const [currEditIdx, setCurrEditIdx] = React.useState(null);
  const [commands, setCommands] = React.useState(
    params.savedRecord?.payload.value || [],
  );
  const {readOnly, title} = params;
  const [responses, setResponses] = React.useState([]);
  const commandKeys = React.useRef(new WeakMap());
  const nextCommandKey = React.useRef(0);
  function commandKey(command) {
    if (!commandKeys.current.has(command)) {
      commandKeys.current.set(command, `command-${nextCommandKey.current++}`);
    }
    return commandKeys.current.get(command);
  }
  const [currEditParamIdx, setCurrEditParamIdx] = React.useState(null);
  const [editableParameters, setEditableParameters] = React.useState(
    (Array.isArray(params.savedRecord?.parameters) &&
      params.savedRecord.parameters.map((p) => ({...p, payload: []}))) ||
      null,
  );
  const hasCustomExecuteFunc =
    typeof params.savedRecord?.onExecute === 'function';

  React.useEffect(() => {
    if (!showCommandModal) {
      setCurrEditIdx(null);
    }
  }, [showCommandModal]);

  function addCommand(cmd) {
    setCommands(appendCommand(commands, cmd));
    setResponses([]);
  }

  function deleteCommand(idx) {
    setCommands(removeCommand(commands, idx));
    setResponses([]);
  }

  function moveCommandDown(idx) {
    setCommands(moveCommand(commands, idx, idx + 1));
    setResponses([]);
  }

  function moveCommandUp(idx) {
    setCommands(moveCommand(commands, idx, idx - 1));
    setResponses([]);
  }

  function editCommand(cmd) {
    if (currEditIdx === null) {
      return;
    }
    setCommands(replaceCommand(commands, currEditIdx, cmd));
    setResponses([]);
  }

  function editParameter(cmd) {
    const nextValues = updateParameter(
      editableParameters,
      currEditParamIdx,
      cmd.payload,
    );
    setEditableParameters(nextValues);

    // apply parameters into command template
    setCommands(
      params.savedRecord.onParameterChanged({
        parameters: nextValues,
        commands,
      }),
    );

    setCurrEditParamIdx(null);
  }

  async function executeCommands() {
    if (hasCustomExecuteFunc) {
      params.savedRecord?.onExecute();
      return;
    }

    let result = [];

    try {
      const options = {
        beforeTransceive: params.savedRecord?.beforeTransceive,
      };
      if (nfcTech === NfcTech.NfcA) {
        result = await NfcProxy.customTransceiveNfcA(
          commands,
          params.savedRecord?.onPostExecute,
          options,
        );
      } else if (nfcTech === NfcTech.NfcV) {
        result = await NfcProxy.customTransceiveNfcV(
          commands,
          params.savedRecord?.onPostExecute,
          options,
        );
      } else if (nfcTech === NfcTech.IsoDep) {
        result = await NfcProxy.customTransceiveIsoDep(
          commands,
          params.savedRecord?.onPostExecute,
          options,
        );
      }
    } catch (ex) {
      console.warn('executeCommands w unexpected ex', ex);
    }

    const [success, resps] = result;

    if (!success) {
      Alert.alert(tr('Commands Not Finished'), '', [
        {text: tr('OK'), onPress: () => 0},
      ]);
    }

    setResponses(resps);
  }

  function getRecordPayload() {
    return {
      tech: nfcTech,
      value: commands,
    };
  }

  return (
    <>
      <ScreenHeader
        title={
          title
            ? readOnly
              ? tr(title)
              : title
            : params.savedRecord?.name || tr('CUSTOM TRANSCEIVE')
        }
        navigation={props.navigation}
        getRecordPayload={getRecordPayload}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
        readOnly={readOnly}
      />
      <SafeAreaView edges={{bottom: true}} style={styles.wrapper}>
        <NestableScrollContainer contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>{tr('NFC WORKBENCH')}</Text>
          <Text style={styles.heading}>{tr('Custom Transceive')}</Text>
          <Text style={styles.intro}>
            {tr(
              'Review commands and responses before running them against a tag.',
            )}
          </Text>
          <View style={styles.techBadge}>
            <Text style={styles.techBadgeText}>
              {tr('TECH /')}
              {nfcTech}
            </Text>
          </View>

          {editableParameters ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{tr('CONFIGURATIONS')}</Text>
                {editableParameters.map((p, idx) => {
                  const hexString = p.payload
                    .map((b) => ('00' + b.toString(16)).slice(-2))
                    .join(' ');
                  return (
                    <View
                      key={`${readOnly ? p.name : p.name}-${idx}`}
                      style={styles.parameterRow}
                    >
                      <Text style={styles.parameterName}>
                        {readOnly ? tr(p.name) : p.name}
                      </Text>
                      <Button
                        mode="outlined"
                        accessibilityLabel={`Edit ${
                          readOnly ? tr(p.name) : p.name
                        }`}
                        disabled={readOnly}
                        onPress={() => {
                          setShowCommandModal(true);
                          setCurrEditParamIdx(idx);
                        }}
                      >
                        {hexString || tr('update')}
                      </Button>
                    </View>
                  );
                })}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{tr('DESCRIPTION')}</Text>
                <Text style={styles.description}>
                  {(readOnly
                    ? tr(params.savedRecord?.description)
                    : params.savedRecord?.description) || tr('No description')}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.commandSection}>
              <Text style={styles.sectionTitle}>
                {tr('COMMANDS ·')}
                {commands.length}
              </Text>
              {commands.length === 0 ? (
                <Text style={styles.emptyText}>
                  {tr('No commands yet. Add one to begin.')}
                </Text>
              ) : (
                <NestableDraggableFlatList
                  data={commands}
                  keyExtractor={commandKey}
                  onDragEnd={({from, to}) => {
                    if (from !== to) {
                      setCommands((current) => moveCommand(current, from, to));
                      setResponses([]);
                    }
                  }}
                  renderItem={({item: cmd, getIndex, drag, isActive}) => {
                    const idx = getIndex();
                    if (idx === undefined) {
                      return null;
                    }
                    return (
                      <CommandItem
                        cmd={cmd}
                        resp={responses[idx]}
                        onDrag={drag}
                        isActive={isActive}
                        onMoveUp={
                          commands.length > 1 &&
                          idx > 0 &&
                          (() => moveCommandUp(idx))
                        }
                        onMoveDown={
                          commands.length > 1 &&
                          idx < commands.length - 1 &&
                          (() => moveCommandDown(idx))
                        }
                        onDelete={() => deleteCommand(idx)}
                        onEdit={() => {
                          setShowCommandModal(true);
                          setCurrEditIdx(idx);
                        }}
                        readOnly={readOnly}
                      />
                    );
                  }}
                />
              )}
            </View>
          )}

          <View style={styles.actionBar}>
            {!readOnly && (
              <Button
                mode="outlined"
                style={styles.addButton}
                contentStyle={styles.actionContent}
                accessibilityLabel={tr('Add command')}
                onPress={() => setShowCommandModal(true)}
              >
                {tr('ADD COMMAND')}
              </Button>
            )}
            <Button
              mode="contained"
              disabled={commands.length === 0 && !hasCustomExecuteFunc}
              contentStyle={styles.actionContent}
              accessibilityLabel={tr('Execute commands')}
              onPress={executeCommands}
            >
              {tr('EXECUTE')}
            </Button>
          </View>
        </NestableScrollContainer>
      </SafeAreaView>

      <CustomTransceiveModal
        cmdType={currEditParamIdx !== null ? 'command' : null}
        isEditing={currEditIdx !== null || currEditParamIdx !== null}
        visible={showCommandModal}
        setVisible={setShowCommandModal}
        editCommand={
          currEditParamIdx !== null
            ? editParameter
            : currEditIdx !== null
            ? editCommand
            : addCommand
        }
      />
    </>
  );
}

function createStyles(colors, spacing, type) {
  return StyleSheet.create({
    wrapper: {flex: 1, backgroundColor: colors.background},
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl + spacing.xl,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: type.caption,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    heading: {
      color: colors.text,
      fontSize: type.hero,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    intro: {
      color: colors.textMuted,
      fontSize: type.label,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    techBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xl,
    },
    techBadgeText: {
      color: colors.accent,
      fontSize: type.caption,
      fontWeight: '700',
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    commandSection: {marginBottom: spacing.lg},
    sectionTitle: {
      color: colors.textMuted,
      fontSize: type.caption,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    parameterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    parameterName: {color: colors.text, fontSize: type.body},
    description: {color: colors.text, fontSize: type.body, lineHeight: 22},
    emptyText: {
      color: colors.textMuted,
      fontSize: type.body,
      padding: spacing.lg,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
    },
    actionBar: {gap: spacing.md, marginTop: spacing.sm},
    addButton: {borderColor: colors.accent},
    actionContent: {minHeight: 48},
  });
}

export default CustomTransceiveScreen;
