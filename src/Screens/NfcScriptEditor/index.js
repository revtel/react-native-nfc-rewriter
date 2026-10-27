import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import {translateError} from '../../i18n/errors';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Pressable,
  Switch,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomTransceiveModal from '../../Components/CustomTransceiveModal';
import ScreenHeader from '../../Components/ScreenHeader';
import NfcProxy from '../../NfcProxy';
import {
  parseTemplateTokens,
  serializeTemplateTokens,
  variablesAfterStep,
} from '../../features/nfc-script/editorHelpers';
import {
  makeStep,
  newScript,
  validateScript,
} from '../../features/nfc-script/model';
import VariableInsertModal from './VariableInsertModal';
import {useVisualTheme} from '../../visual/theme';

const STEP_TYPES = [
  'transceive',
  'assert-response',
  'delay',
  'set',
  'capture',
  'if',
  'repeat',
  'stop',
];
const CAPTURE_FORMATS = ['u8', 'u16be', 'u16le', 'bytes'];
const OPERATORS = ['==', '!=', '<', '<=', '>', '>='];

function useEditorStyles() {
  const {colors, spacing, type} = useVisualTheme();
  return React.useMemo(
    () => makeStyles(colors, spacing, type),
    [colors, spacing, type],
  );
}

function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
  preserveBlank = false,
}) {
  useTranslation();
  const styles = useEditorStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={String(value ?? '')}
        onChangeText={(text) =>
          onChange(
            numeric
              ? preserveBlank && text.trim() === ''
                ? ''
                : Number(text)
              : text,
          )
        }
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Choice({values, selected, onSelect}) {
  useTranslation();
  const styles = useEditorStyles();
  return (
    <View style={styles.choices}>
      {values.map((value) => (
        <Button
          key={value}
          compact
          mode={selected === value ? 'contained' : 'outlined'}
          style={styles.choice}
          onPress={() => onSelect(value)}
        >
          {tr(value)}
        </Button>
      ))}
    </View>
  );
}

function CommandTemplateField({template, change, available}) {
  useTranslation();
  const styles = useEditorStyles();
  const value = typeof template === 'string' ? template : '';
  const [mode, setMode] = React.useState('TEXT');
  const [showVariablePicker, setShowVariablePicker] = React.useState(false);
  const [showHexPicker, setShowHexPicker] = React.useState(false);
  const [modeError, setModeError] = React.useState(null);
  let tokens = [];
  if (mode === 'BUILDER') {
    try {
      tokens = parseTemplateTokens(value);
    } catch (error) {
      tokens = [];
    }
  }

  function selectMode(nextMode) {
    if (nextMode === 'BUILDER') {
      try {
        parseTemplateTokens(value);
      } catch (error) {
        setModeError(error.message);
        return;
      }
    }
    setModeError(null);
    setMode(nextMode);
  }

  function updateTokens(nextTokens) {
    change({template: serializeTemplateTokens(nextTokens)});
  }

  function moveToken(index, direction) {
    const next = [...tokens];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    updateTokens(next);
  }

  return (
    <>
      <Text style={styles.fieldLabel}>
        {tr('Command bytes (hex and {{syntax}})', {
          syntax: '${expression:format}',
        })}
      </Text>
      <Choice
        values={['TEXT', 'BUILDER']}
        selected={mode}
        onSelect={selectMode}
      />
      {mode === 'TEXT' ? (
        <>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={value}
            onChangeText={(text) => change({template: text})}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            accessibilityLabel={tr('Command bytes')}
          />
          {modeError && (
            <Text style={styles.error}>
              {tr('Fix command syntax in TEXT mode: {{error}}', {
                error: translateError(modeError),
              })}
            </Text>
          )}
          <Text style={styles.hint}>
            {tr('Example: 30 ${targetPage:u8}. See HELP for formats.')}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            {tr(
              'Add hex bytes or variables in send order. Use TEXT for arithmetic expressions or direct editing.',
            )}
          </Text>
          {tokens.length === 0 && (
            <Text style={styles.hint}>{tr('No command segments yet.')}</Text>
          )}
          {tokens.map((token, index) => (
            <View key={`${index}-${token}`} style={styles.commandSegment}>
              <Text selectable style={styles.commandToken}>{`${
                index + 1
              }. ${token}`}</Text>
              <Button
                compact
                disabled={index === 0}
                onPress={() => moveToken(index, -1)}
              >
                ↑
              </Button>
              <Button
                compact
                disabled={index === tokens.length - 1}
                onPress={() => moveToken(index, 1)}
              >
                ↓
              </Button>
              <Button
                compact
                onPress={() =>
                  updateTokens(
                    tokens.filter((_, position) => position !== index),
                  )
                }
              >
                ✕
              </Button>
            </View>
          ))}
          <View style={styles.builderActions}>
            <Button mode="outlined" onPress={() => setShowHexPicker(true)}>
              {tr('ADD HEX BYTES')}
            </Button>
            <Button mode="outlined" onPress={() => setShowVariablePicker(true)}>
              {tr('CHOOSE VARIABLE')}
            </Button>
          </View>
          <Text selectable style={styles.commandPreview}>
            {value || tr('(empty command)')}
          </Text>
        </>
      )}
      <CustomTransceiveModal
        visible={showHexPicker}
        setVisible={setShowHexPicker}
        onInsertBytes={(bytes) =>
          updateTokens([
            ...tokens,
            ...bytes.map((byte) =>
              byte.toString(16).padStart(2, '0').toUpperCase(),
            ),
          ])
        }
      />
      <VariableInsertModal
        visible={showVariablePicker}
        available={available}
        onInsert={(token) => updateTokens([...tokens, token])}
        onClose={() => setShowVariablePicker(false)}
      />
    </>
  );
}

function StepFields({step, change, depth, available, tech}) {
  useTranslation();
  const styles = useEditorStyles();
  switch (step.type) {
    case 'transceive':
      return (
        <CommandTemplateField
          template={step.template}
          change={change}
          available={available}
        />
      );
    case 'assert-response': {
      const hasBytes = Object.prototype.hasOwnProperty.call(
        step,
        'expectedHex',
      );
      const hasSw = Object.prototype.hasOwnProperty.call(step, 'expectedSw');
      const remove = (property) =>
        change((current) => {
          const next = {...current};
          delete next[property];
          return next;
        });
      return (
        <>
          <Text style={styles.fieldLabel}>{tr('Response source')}</Text>
          <Choice
            values={['data', 'raw']}
            selected={step.source}
            onSelect={(source) => change({source})}
          />
          <Field
            label={tr('Exact byte length (0–4096)')}
            value={step.length}
            onChange={(length) => change({length})}
            numeric
            preserveBlank
          />
          <Text style={styles.hint}>
            {tr(
              'Checks the latest TRANSCEIVE without sending a command. On IsoDep, data excludes SW1/SW2; raw includes them.',
            )}
          </Text>
          <View style={styles.assertionToggle}>
            <Text style={styles.assertionToggleLabel}>
              {tr('Check exact bytes')}
            </Text>
            <Switch
              accessibilityLabel={tr('Check exact bytes')}
              value={hasBytes}
              onValueChange={(enabled) =>
                enabled ? change({expectedHex: ''}) : remove('expectedHex')
              }
            />
          </View>
          {hasBytes && (
            <>
              <Field
                label={tr('Expected literal hex bytes')}
                value={step.expectedHex}
                onChange={(expectedHex) => change({expectedHex})}
                multiline
              />
              <Text style={styles.hint}>
                {tr(
                  'An enabled empty field means exactly zero bytes and requires length 0. Turn off the check to omit it.',
                )}
              </Text>
            </>
          )}
          {(tech === 'IsoDep' || hasSw) && (
            <>
              <View style={styles.assertionToggle}>
                <Text style={styles.assertionToggleLabel}>
                  {tr('Check status word')}
                </Text>
                <Switch
                  accessibilityLabel={tr('Check status word')}
                  value={hasSw}
                  onValueChange={(enabled) =>
                    enabled
                      ? change({expectedSw: '9000'})
                      : remove('expectedSw')
                  }
                />
              </View>
              {hasSw && (
                <Field
                  label={tr('Expected SW (four hex digits)')}
                  value={step.expectedSw}
                  onChange={(expectedSw) => change({expectedSw})}
                />
              )}
              {tech !== 'IsoDep' && (
                <Text style={styles.error}>
                  {tr(
                    'Status checks require IsoDep. Disable this check or change the script technology.',
                  )}
                </Text>
              )}
            </>
          )}
        </>
      );
    }
    case 'delay':
      return (
        <Field
          label={tr('Delay (ms, max 5000)')}
          value={step.ms}
          onChange={(ms) => change({ms})}
          numeric
        />
      );
    case 'set':
      return (
        <>
          <Field
            label={tr('Variable name')}
            value={step.name}
            onChange={(name) => change({name})}
          />
          <Field
            label={tr('Numeric expression')}
            value={step.expression}
            onChange={(expression) => change({expression})}
          />
          <Text style={styles.hint}>
            {'Example: basePage + 4. Use a variable from an earlier step.'}
          </Text>
        </>
      );
    case 'capture':
      return (
        <>
          <Field
            label={tr('Variable name')}
            value={step.name}
            onChange={(name) => change({name})}
          />
          <Text style={styles.fieldLabel}>{tr('Response source')}</Text>
          <Choice
            values={['data', 'raw']}
            selected={step.source}
            onSelect={(source) => change({source})}
          />
          <Field
            label={tr('Byte offset (zero-based)')}
            value={step.offset}
            onChange={(offset) => change({offset})}
            numeric
          />
          <Text style={styles.fieldLabel}>{tr('Interpret as')}</Text>
          <Choice
            values={CAPTURE_FORMATS}
            selected={step.format}
            onSelect={(format) =>
              change({
                format,
                ...(format === 'bytes' ? {length: step.length || 1} : {}),
              })
            }
          />
          {step.format === 'bytes' && (
            <Field
              label={tr('Byte count')}
              value={step.length}
              onChange={(length) => change({length})}
              numeric
            />
          )}
          <Text style={styles.hint}>
            {tr('Read from the latest response. Byte offset starts at 0.')}
          </Text>
        </>
      );
    case 'if':
      return (
        <>
          <Field
            label={tr('Left expression')}
            value={step.left}
            onChange={(left) => change({left})}
          />
          <Choice
            values={OPERATORS}
            selected={step.operator}
            onSelect={(operator) => change({operator})}
          />
          <Field
            label={tr('Right expression')}
            value={step.right}
            onChange={(right) => change({right})}
          />
          <Text style={styles.branchLabel}>{tr('TRUE PATH')}</Text>
          <StepList
            steps={step.then || []}
            onChange={(thenSteps) => change({then: thenSteps})}
            depth={depth + 1}
            available={available}
            tech={tech}
          />
          <Text style={styles.branchLabel}>{tr('FALSE PATH')}</Text>
          <StepList
            steps={step.else || []}
            onChange={(elseSteps) => change({else: elseSteps})}
            depth={depth + 1}
            available={available}
            tech={tech}
          />
        </>
      );
    case 'repeat':
      return (
        <>
          <Field
            label={tr('Count expression')}
            value={step.count}
            onChange={(count) => change({count})}
          />
          <Field
            label={tr('Maximum iterations (1–64)')}
            value={step.maxIterations}
            onChange={(maxIterations) => change({maxIterations})}
            numeric
          />
          <Text style={styles.hint}>
            {tr('The body can use zero-based variable index.')}
          </Text>
          <Text style={styles.branchLabel}>{tr('REPEAT BODY')}</Text>
          <StepList
            steps={step.steps || []}
            onChange={(body) => change({steps: body})}
            depth={depth + 1}
            available={{...available, index: 'number'}}
            tech={tech}
          />
        </>
      );
    case 'stop':
      return (
        <>
          <Choice
            values={['success', 'failure']}
            selected={step.outcome}
            onSelect={(outcome) => change({outcome})}
          />
          <Field
            label={tr('Message')}
            value={step.message}
            onChange={(message) => change({message})}
          />
        </>
      );
    default:
      return (
        <Text style={styles.error}>
          {tr('Unsupported step. Remove it before running.')}
        </Text>
      );
  }
}

function StepList({
  steps,
  onChange,
  depth = 0,
  available = {},
  tech = 'NfcA',
  errors = [],
}) {
  useTranslation();
  const styles = useEditorStyles();
  const [showAdd, setShowAdd] = React.useState(false);
  let currentAvailable = {...available};
  const update = (idx, patch) =>
    onChange(
      steps.map((step, position) =>
        position === idx
          ? typeof patch === 'function'
            ? patch(step)
            : {...step, ...patch}
          : step,
      ),
    );
  const move = (idx, direction) => {
    const next = [...steps];
    const target = idx + direction;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <View style={[styles.stepList, depth > 0 && styles.nestedList]}>
      {steps.map((step, idx) => {
        const stepAvailable = currentAvailable;
        currentAvailable = variablesAfterStep(currentAvailable, step, tech);
        return (
          <View key={`${depth}-${idx}`} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                {idx + 1}. {tr(String(step?.type || 'unknown'))}
              </Text>
              <IconButton
                icon="arrow-up"
                size={20}
                accessibilityLabel={tr('Move step up')}
                disabled={idx === 0}
                onPress={() => move(idx, -1)}
              />
              <IconButton
                icon="arrow-down"
                size={20}
                accessibilityLabel={tr('Move step down')}
                disabled={idx === steps.length - 1}
                onPress={() => move(idx, 1)}
              />
              <IconButton
                icon="delete-outline"
                size={20}
                accessibilityLabel={tr('Remove step')}
                onPress={() =>
                  onChange(steps.filter((_, position) => position !== idx))
                }
              />
            </View>
            <StepFields
              step={step || {}}
              change={(patch) => update(idx, patch)}
              depth={depth}
              available={stepAvailable}
              tech={tech}
            />
            {errors
              .filter((error) => error.startsWith(`Step ${idx + 1}:`))
              .map((error, errorIndex) => (
                <Text key={errorIndex} style={styles.error}>
                  {translateError(error)}
                </Text>
              ))}
          </View>
        );
      })}
      {depth <= 6 && (
        <>
          <Button mode="outlined" onPress={() => setShowAdd(!showAdd)}>
            {showAdd ? tr('CANCEL') : tr('+ ADD STEP')}
          </Button>
          {showAdd && (
            <View style={styles.choices}>
              {STEP_TYPES.filter(
                (type) => depth < 6 || (type !== 'if' && type !== 'repeat'),
              ).map((type) => (
                <Button
                  key={type}
                  compact
                  mode="text"
                  onPress={() => {
                    onChange([...steps, makeStep(type)]);
                    setShowAdd(false);
                  }}
                >
                  {tr(type)}
                </Button>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function formatBytes(bytes) {
  return Array.isArray(bytes)
    ? bytes
        .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' ')
    : '';
}

function AssertionTrace({assertion}) {
  useTranslation();
  const styles = useEditorStyles();
  const check = (outcome) =>
    tr(outcome == null ? 'Not checked' : outcome ? 'PASS' : 'FAIL');
  const bytes = (value) => (value === '' ? tr('(empty bytes)') : value);
  return (
    <View>
      <Text style={assertion.passed ? styles.success : styles.error}>
        {tr(assertion.passed ? 'ASSERTION PASSED' : 'ASSERTION FAILED')}
      </Text>
      <Text selectable style={styles.technicalText}>
        {tr('Source: {{source}}', {source: assertion.source})}
      </Text>
      <Text selectable style={styles.technicalText}>
        {tr('Expected length: {{expected}} · Actual length: {{actual}}', {
          expected: assertion.expectedLength,
          actual: assertion.actualLength,
        })}
      </Text>
      <Text style={styles.traceText}>
        {tr('Length check: {{result}}', {
          result: check(assertion.checks.length),
        })}
      </Text>
      <Text style={styles.traceText}>
        {tr('Exact bytes check: {{result}}', {
          result: check(assertion.checks.bytes),
        })}
      </Text>
      {assertion.expectedHex !== null && (
        <Text selectable style={styles.technicalText}>
          {tr('Expected bytes:')} {bytes(assertion.expectedHex)}
        </Text>
      )}
      <Text selectable style={styles.technicalText}>
        {tr('Actual bytes:')} {bytes(assertion.actualHex)}
      </Text>
      {assertion.actualHexTruncated && (
        <Text style={styles.hint}>
          {tr(
            'Assertion preview shows only the first 4096 bytes. Checks used the complete response; the preceding TRANSCEIVE retains its full raw bytes.',
          )}
        </Text>
      )}
      <Text style={styles.traceText}>
        {tr('Status check: {{result}}', {result: check(assertion.checks.sw)})}
      </Text>
      {assertion.expectedSw !== null && (
        <Text selectable style={styles.technicalText}>
          {tr('Expected SW:')} {assertion.expectedSw}
        </Text>
      )}
      {assertion.actualSw !== null && (
        <Text selectable style={styles.technicalText}>
          {tr('Actual SW:')} {assertion.actualSw}
        </Text>
      )}
    </View>
  );
}

function TraceView({result}) {
  useTranslation();
  const styles = useEditorStyles();
  if (!result) {
    return (
      <Text style={styles.hint}>
        {tr('Run the script to see an execution trace.')}
      </Text>
    );
  }
  return (
    <View>
      <Text style={result.success ? styles.success : styles.error}>
        {result.success
          ? tr('Completed')
          : tr('Stopped: {{error}}', {
              error: result.userMessage
                ? result.error
                : translateError(result.error),
            })}
      </Text>
      {result.trace.map((entry, idx) => (
        <View key={idx} style={styles.stepCard}>
          <Text style={styles.stepTitle}>
            {entry.location} · {tr(entry.type)}
          </Text>
          {entry.command && (
            <Text selectable style={styles.technicalText}>
              → {formatBytes(entry.command)}
            </Text>
          )}
          {entry.response && (
            <>
              <Text selectable style={styles.technicalText}>
                ← {formatBytes(entry.response.raw)}
              </Text>
              {entry.response.sw !== undefined && (
                <Text selectable style={styles.technicalText}>
                  {tr('Data:')}
                  {formatBytes(entry.response.data)} · SW:{' '}
                  {entry.response.sw
                    .toString(16)
                    .padStart(4, '0')
                    .toUpperCase()}
                </Text>
              )}
            </>
          )}
          {entry.variable && (
            <Text selectable style={styles.technicalText}>
              {entry.variable.name} ={' '}
              {Array.isArray(entry.variable.value)
                ? formatBytes(entry.variable.value)
                : entry.variable.value}
            </Text>
          )}
          {entry.branch && (
            <Text style={styles.traceText}>
              {tr('Branch:')}
              {tr(entry.branch)} ({entry.comparison.left}{' '}
              {entry.comparison.operator} {entry.comparison.right})
            </Text>
          )}
          {entry.count !== undefined && (
            <Text style={styles.traceText}>
              {tr('Iterations:')}
              {entry.count}
            </Text>
          )}
          {entry.assertion && <AssertionTrace assertion={entry.assertion} />}
          {entry.ms !== undefined && (
            <Text style={styles.traceText}>
              {tr('Delay:')}
              {entry.ms} ms
            </Text>
          )}
          {entry.error && (
            <Text style={styles.error}>{translateError(entry.error)}</Text>
          )}
          {entry.message && (
            <Text style={styles.traceText}>{entry.message}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function NfcScriptEditorScreen({navigation, route}) {
  useTranslation();
  const styles = useEditorStyles();
  const {colors} = useVisualTheme();
  const {bottom: bottomInset} = useSafeAreaInsets();
  const params = route?.params || {};
  const [script, setScript] = React.useState(
    () => params.savedRecord?.payload || newScript(params.nfcTech || 'NfcA'),
  );
  const [mode, setMode] = React.useState('editor');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const errors = validateScript(script);
  const hasNestedSteps =
    Array.isArray(script.steps) &&
    script.steps.some((step) => step?.type === 'if' || step?.type === 'repeat');

  function editScript(nextScript) {
    setScript(nextScript);
    setResult(null);
  }

  async function run() {
    setMode('trace');
    setRunning(true);
    try {
      setResult(await NfcProxy.runNfcScript(script));
    } catch (error) {
      setResult({
        success: false,
        error: error?.message || String(error),
        trace: [],
        variables: {},
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <ScreenHeader
        navigation={navigation}
        title={params.savedRecord?.name || tr('NFC FLOW SCRIPT')}
        getRecordPayload={() => script}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
        savedRecordRevision={params.savedRecordRevision}
      />
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Button
            compact
            mode={mode === 'editor' ? 'contained' : 'outlined'}
            style={styles.toolbarButton}
            onPress={() => setMode('editor')}
          >
            {tr('EDITOR')}
          </Button>
          <Button
            compact
            mode={mode === 'trace' ? 'contained' : 'outlined'}
            style={styles.toolbarButton}
            onPress={() => setMode('trace')}
          >
            {tr('TRACE')}
          </Button>
          <Button
            compact
            mode="contained"
            icon="play"
            style={styles.toolbarRun}
            disabled={running || errors.length > 0}
            onPress={run}
          >
            {running ? tr('RUNNING') : tr('RUN')}
          </Button>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'editor' ? (
            <>
              <Text style={styles.heading}>{tr('Technology')}</Text>
              <Choice
                values={['NfcA', 'IsoDep']}
                selected={script.tech}
                onSelect={(tech) => editScript({...script, tech})}
              />
              <Text style={styles.hint}>
                {tr(
                  'One technology and one NFC session per run. Scripts run only when you tap RUN.',
                )}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('Help: examples and formats')}
                style={styles.helpButton}
                onPress={() =>
                  navigation.navigate('NfcScriptHelp', {tech: script.tech})
                }
              >
                <Icon
                  name="information-outline"
                  size={20}
                  color={colors.accent}
                />
                <Text style={styles.helpText}>
                  {tr('HELP: EXAMPLES & FORMATS')}
                </Text>
              </Pressable>
              <Text style={styles.stepsHeading}>
                {tr('Steps ·')}
                {Array.isArray(script.steps) ? script.steps.length : 0}
              </Text>
              {errors
                .filter((error) => hasNestedSteps || !/^Step \d+:/.test(error))
                .map((error, idx) => (
                  <Text key={idx} style={styles.error}>
                    {translateError(error)}
                  </Text>
                ))}
              <StepList
                steps={Array.isArray(script.steps) ? script.steps : []}
                onChange={(steps) => editScript({...script, steps})}
                tech={script.tech}
                errors={hasNestedSteps ? [] : errors}
              />
            </>
          ) : (
            <TraceView result={result} />
          )}
        </ScrollView>
        <View style={{height: bottomInset}} />
      </View>
    </>
  );
}

function makeStyles(colors, spacing, type) {
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toolbarButton: {minWidth: 76},
    toolbarRun: {marginLeft: 'auto'},
    content: {padding: spacing.xl, paddingBottom: spacing.xxl},
    heading: {
      fontSize: type.title,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    helpButton: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 48,
      paddingVertical: spacing.sm,
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    helpText: {
      color: colors.accent,
      fontWeight: '700',
      fontSize: type.body,
      flexShrink: 1,
    },
    stepsHeading: {
      color: colors.text,
      fontSize: type.label,
      fontWeight: '700',
      marginTop: spacing.xl,
    },
    hint: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 21,
      marginVertical: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontSize: type.body,
      marginVertical: spacing.sm,
    },
    success: {
      color: colors.success,
      fontSize: type.body,
      marginVertical: spacing.sm,
    },
    stepList: {marginVertical: spacing.sm},
    nestedList: {
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      paddingLeft: spacing.md,
      marginLeft: spacing.sm,
    },
    stepCard: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
    },
    stepHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      minHeight: 48,
    },
    stepTitle: {
      fontWeight: '700',
      flex: 1,
      color: colors.text,
      fontSize: type.label,
    },
    field: {marginVertical: spacing.sm},
    assertionToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginVertical: spacing.sm,
      minHeight: 48,
    },
    assertionToggleLabel: {
      flex: 1,
      flexShrink: 1,
      color: colors.text,
      fontSize: type.body,
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: type.body,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 6,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.technical,
      fontSize: type.body,
    },
    multilineInput: {minHeight: 64, textAlignVertical: 'top', fontFamily: mono},
    commandSegment: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 6,
      marginBottom: spacing.sm,
      paddingLeft: spacing.sm,
      backgroundColor: colors.surfaceMuted,
    },
    commandToken: {
      flex: 1,
      flexShrink: 1,
      color: colors.technical,
      fontFamily: mono,
      fontSize: type.body,
    },
    builderActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    commandPreview: {
      color: colors.technical,
      fontFamily: mono,
      marginTop: spacing.md,
      fontSize: type.body,
      flexShrink: 1,
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginVertical: spacing.sm,
    },
    choice: {marginRight: spacing.sm, marginBottom: spacing.sm},
    branchLabel: {
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    technicalText: {
      color: colors.technical,
      fontFamily: mono,
      fontSize: type.body,
      marginTop: spacing.sm,
      flexShrink: 1,
    },
    traceText: {color: colors.text, fontSize: type.body, marginTop: spacing.sm},
  });
}

export default NfcScriptEditorScreen;
export {StepList, TraceView};
