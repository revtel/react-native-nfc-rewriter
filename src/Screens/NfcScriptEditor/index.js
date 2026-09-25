import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Button} from 'react-native-paper';
import ScreenHeader from '../../Components/ScreenHeader';
import NfcProxy from '../../NfcProxy';
import {
  makeStep,
  newScript,
  validateScript,
} from '../../features/nfc-script/model';

const STEP_TYPES = [
  'transceive',
  'delay',
  'set',
  'capture',
  'if',
  'repeat',
  'stop',
];
const CAPTURE_FORMATS = ['u8', 'u16be', 'u16le', 'bytes'];
const OPERATORS = ['==', '!=', '<', '<=', '>', '>='];

function Field({label, value, onChange, numeric = false, multiline = false}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={String(value ?? '')}
        onChangeText={(text) => onChange(numeric ? Number(text) : text)}
        keyboardType={numeric ? 'number-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
      />
    </View>
  );
}

function Choice({values, selected, onSelect}) {
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
          {value}
        </Button>
      ))}
    </View>
  );
}

function StepFields({step, change, depth}) {
  switch (step.type) {
    case 'transceive':
      return (
        <Field
          label="Command bytes (hex and ${expression:format})"
          value={step.template}
          onChange={(template) => change({template})}
          multiline
        />
      );
    case 'delay':
      return (
        <Field
          label="Delay (ms, max 5000)"
          value={step.ms}
          onChange={(ms) => change({ms})}
          numeric
        />
      );
    case 'set':
      return (
        <>
          <Field
            label="Variable name"
            value={step.name}
            onChange={(name) => change({name})}
          />
          <Field
            label="Numeric expression"
            value={step.expression}
            onChange={(expression) => change({expression})}
          />
        </>
      );
    case 'capture':
      return (
        <>
          <Field
            label="Variable name"
            value={step.name}
            onChange={(name) => change({name})}
          />
          <Text style={styles.fieldLabel}>Response source</Text>
          <Choice
            values={['data', 'raw']}
            selected={step.source}
            onSelect={(source) => change({source})}
          />
          <Field
            label="Byte offset (zero-based)"
            value={step.offset}
            onChange={(offset) => change({offset})}
            numeric
          />
          <Text style={styles.fieldLabel}>Interpret as</Text>
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
              label="Byte count"
              value={step.length}
              onChange={(length) => change({length})}
              numeric
            />
          )}
        </>
      );
    case 'if':
      return (
        <>
          <Field
            label="Left expression"
            value={step.left}
            onChange={(left) => change({left})}
          />
          <Choice
            values={OPERATORS}
            selected={step.operator}
            onSelect={(operator) => change({operator})}
          />
          <Field
            label="Right expression"
            value={step.right}
            onChange={(right) => change({right})}
          />
          <Text style={styles.branchLabel}>TRUE PATH</Text>
          <StepList
            steps={step.then || []}
            onChange={(thenSteps) => change({then: thenSteps})}
            depth={depth + 1}
          />
          <Text style={styles.branchLabel}>FALSE PATH</Text>
          <StepList
            steps={step.else || []}
            onChange={(elseSteps) => change({else: elseSteps})}
            depth={depth + 1}
          />
        </>
      );
    case 'repeat':
      return (
        <>
          <Field
            label="Count expression"
            value={step.count}
            onChange={(count) => change({count})}
          />
          <Field
            label="Maximum iterations (1–64)"
            value={step.maxIterations}
            onChange={(maxIterations) => change({maxIterations})}
            numeric
          />
          <Text style={styles.hint}>
            The body can use zero-based variable index.
          </Text>
          <Text style={styles.branchLabel}>REPEAT BODY</Text>
          <StepList
            steps={step.steps || []}
            onChange={(body) => change({steps: body})}
            depth={depth + 1}
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
            label="Message"
            value={step.message}
            onChange={(message) => change({message})}
          />
        </>
      );
    default:
      return (
        <Text style={styles.error}>
          Unsupported step. Remove it before running.
        </Text>
      );
  }
}

function StepList({steps, onChange, depth = 0}) {
  const [showAdd, setShowAdd] = React.useState(false);
  const update = (idx, patch) =>
    onChange(
      steps.map((step, position) =>
        position === idx ? {...step, ...patch} : step,
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
      {steps.map((step, idx) => (
        <View key={`${depth}-${idx}`} style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>
              {idx + 1}. {String(step?.type || 'unknown').toUpperCase()}
            </Text>
            <Button compact disabled={idx === 0} onPress={() => move(idx, -1)}>
              ↑
            </Button>
            <Button
              compact
              disabled={idx === steps.length - 1}
              onPress={() => move(idx, 1)}
            >
              ↓
            </Button>
            <Button
              compact
              onPress={() =>
                onChange(steps.filter((_, position) => position !== idx))
              }
            >
              ✕
            </Button>
          </View>
          <StepFields
            step={step || {}}
            change={(patch) => update(idx, patch)}
            depth={depth}
          />
        </View>
      ))}
      {depth <= 6 && (
        <>
          <Button mode="outlined" onPress={() => setShowAdd(!showAdd)}>
            {showAdd ? 'CANCEL' : '+ ADD STEP'}
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
                  {type}
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

function TraceView({result}) {
  if (!result) {
    return (
      <Text style={styles.hint}>Run the script to see an execution trace.</Text>
    );
  }
  return (
    <View>
      <Text style={result.success ? styles.success : styles.error}>
        {result.success ? 'Completed' : `Stopped: ${result.error}`}
      </Text>
      {result.trace.map((entry, idx) => (
        <View key={idx} style={styles.stepCard}>
          <Text style={styles.stepTitle}>
            {entry.location} · {entry.type.toUpperCase()}
          </Text>
          {entry.command && <Text>→ {formatBytes(entry.command)}</Text>}
          {entry.response && (
            <>
              <Text>← {formatBytes(entry.response.raw)}</Text>
              {entry.response.sw !== undefined && (
                <Text>
                  Data: {formatBytes(entry.response.data)} · SW:{' '}
                  {entry.response.sw
                    .toString(16)
                    .padStart(4, '0')
                    .toUpperCase()}
                </Text>
              )}
            </>
          )}
          {entry.variable && (
            <Text>
              {entry.variable.name} ={' '}
              {Array.isArray(entry.variable.value)
                ? formatBytes(entry.variable.value)
                : entry.variable.value}
            </Text>
          )}
          {entry.branch && (
            <Text>
              Branch: {entry.branch} ({entry.comparison.left}{' '}
              {entry.comparison.operator} {entry.comparison.right})
            </Text>
          )}
          {entry.count !== undefined && <Text>Iterations: {entry.count}</Text>}
          {entry.ms !== undefined && <Text>Delay: {entry.ms} ms</Text>}
          {entry.error && <Text style={styles.error}>{entry.error}</Text>}
          {entry.message && <Text>{entry.message}</Text>}
        </View>
      ))}
    </View>
  );
}

function NfcScriptEditorScreen({navigation, route}) {
  const params = route?.params || {};
  const [script, setScript] = React.useState(
    () => params.savedRecord?.payload || newScript(params.nfcTech || 'NfcA'),
  );
  const [mode, setMode] = React.useState('editor');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const errors = validateScript(script);

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
        title={params.savedRecord?.name || 'NFC FLOW SCRIPT'}
        getRecordPayload={() => script}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
      />
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Button
            compact
            mode={mode === 'editor' ? 'contained' : 'outlined'}
            onPress={() => setMode('editor')}
          >
            EDITOR
          </Button>
          <Button
            compact
            mode={mode === 'trace' ? 'contained' : 'outlined'}
            onPress={() => setMode('trace')}
          >
            TRACE
          </Button>
          <Button
            compact
            mode="contained"
            disabled={running || errors.length > 0}
            onPress={run}
          >
            {running ? 'RUNNING' : 'RUN'}
          </Button>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {mode === 'editor' ? (
            <>
              <Text style={styles.heading}>Technology</Text>
              <Choice
                values={['NfcA', 'IsoDep']}
                selected={script.tech}
                onSelect={(tech) => editScript({...script, tech})}
              />
              <Text style={styles.hint}>
                One technology and one NFC session per run. Scripts run only
                when you tap RUN.
              </Text>
              {errors.map((error, idx) => (
                <Text key={idx} style={styles.error}>
                  {error}
                </Text>
              ))}
              <StepList
                steps={Array.isArray(script.steps) ? script.steps : []}
                onChange={(steps) => editScript({...script, steps})}
              />
            </>
          ) : (
            <TraceView result={result} />
          )}
        </ScrollView>
        <SafeAreaView />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: 'white',
  },
  content: {padding: 12, paddingBottom: 36},
  heading: {fontSize: 18, fontWeight: '600', marginBottom: 8},
  hint: {color: '#54606E', marginVertical: 8},
  error: {color: '#B42318', marginVertical: 4},
  success: {color: '#127447', marginVertical: 4},
  stepList: {marginVertical: 8},
  nestedList: {
    borderLeftWidth: 3,
    borderLeftColor: '#8AA9D2',
    paddingLeft: 8,
    marginLeft: 4,
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    padding: 10,
    marginBottom: 10,
  },
  stepHeader: {flexDirection: 'row', alignItems: 'center'},
  stepTitle: {fontWeight: '700', flex: 1, color: '#23436A'},
  field: {marginVertical: 4},
  fieldLabel: {color: '#455468', marginBottom: 4},
  input: {
    borderWidth: 1,
    borderColor: '#B9C7D5',
    borderRadius: 4,
    minHeight: 40,
    paddingHorizontal: 8,
    color: '#172B4D',
  },
  multilineInput: {minHeight: 64, textAlignVertical: 'top'},
  choices: {flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4},
  choice: {marginRight: 4, marginBottom: 4},
  branchLabel: {fontWeight: '700', color: '#355E89', marginTop: 8},
});

export default NfcScriptEditorScreen;
export {StepList, TraceView};
