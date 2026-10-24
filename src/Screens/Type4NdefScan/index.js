import React from 'react';
import {
  FlatList,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {ActivityIndicator, Button} from 'react-native-paper';
import NfcManager, {Ndef} from 'react-native-nfc-manager';
import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import NfcProxy from '../../NfcProxy';
import {createType4Report} from '../../features/type4-ndef/report';
import {useVisualTheme} from '../../visual/theme';

const iosNotice =
  'iOS can automatically SELECT configured applications before this inspector sends its first APDU.';
const traceNotice =
  'The transcript contains app-controlled APDUs only; it is not a complete RF trace.';
const consistencyNotice =
  'Reads are sequential. Equal initial and final NLEN confirms only equal lengths, not an atomic snapshot, unchanged content, or authenticity.';
const effectsNotice =
  'Read-only commands may change selection, session state, or read counters.';
const labels = {
  complete: 'Declared NDEF bytes acquired',
  partial: 'Partial inspection',
  limited: 'Limited inspection',
  unavailable: 'Unavailable',
  supported: 'Supported CC',
  incomplete: 'Incomplete',
  malformed: 'Malformed',
  unsupported: 'Unsupported interpretation',
  decoded: 'Decoded',
  empty: 'Empty NDEF message',
  selected: 'Selected',
  rejected: 'Rejected',
  'not-attempted': 'Not attempted',
  'not-checked': 'Not checked',
  'equal-length': 'Initial and final lengths are equal',
  'length-changed': 'NLEN changed during inspection',
  failed: 'Length recheck failed',
  none: 'No file bytes read',
  'cc-only': 'CC evidence only',
  'ndef-file': 'Standard NDEF file',
  connecting: 'Connecting...',
  'select-application': 'Selecting NDEF application...',
  'select-cc': 'Selecting CC file...',
  'read-cc': 'Reading CC...',
  'select-ndef': 'Selecting NDEF file...',
  'read-nlen': 'Reading NLEN...',
  'read-ndef': 'Reading NDEF payload...',
  'recheck-nlen': 'Comparing final NLEN...',
  success: 'Success',
  'status-word': 'Terminal status word',
  'transport-error': 'Communication failure',
  'malformed-response': 'Malformed response',
  'length-mismatch': 'Unexpected response length',
  'invalid-nlen': 'NLEN exceeds the file capacity',
};
const hex = (bytes) =>
  (bytes || [])
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
const ascii = (bytes) =>
  bytes
    .map((byte) =>
      byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.',
    )
    .join('');
const valueText = (value) => (value == null ? tr('Unknown') : String(value));
const label = (value) => tr(labels[value] || value);
const swText = (sw1, sw2) =>
  sw1 == null || sw2 == null ? tr('Unknown') : hex([sw1, sw2]).replace(' ', '');

function recordPreview(record) {
  try {
    const recordType =
      typeof record.type === 'string'
        ? record.type
        : String.fromCharCode(...record.type);
    if (record.tnf === 1 && recordType === 'T') {
      return Ndef.text.decodePayload(record.payload);
    }
    if (record.tnf === 1 && recordType === 'U') {
      return Ndef.uri.decodePayload(record.payload);
    }
  } catch (_) {
    /* Full raw evidence remains visible if payload decoding fails. */
  }
  return null;
}
function Section({title, styles, children}) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}
function Field({title, value, styles, technical = false}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{title}</Text>
      <Text selectable style={technical ? styles.technical : styles.body}>
        {valueText(value)}
      </Text>
    </View>
  );
}

function Type4InspectionResult({result, styles}) {
  useTranslation();
  const [payloadExpanded, setPayloadExpanded] = React.useState(false);
  const [recordsExpanded, setRecordsExpanded] = React.useState(false);
  const {scope, application, cc, file, consistency, ndef, failure} = result;
  const showPayload = scope.readBytes <= 240 || payloadExpanded;
  return (
    <>
      <Section title={label(result.status)} styles={styles}>
        <Text style={styles.body}>{label(scope.kind)}</Text>
        <Text style={styles.body}>
          {tr(
            '{{read}} / {{planned}} NDEF bytes verified · {{commands}} app APDUs',
            {
              read: scope.readBytes,
              planned: scope.plannedBytes ?? tr('Unknown'),
              commands: scope.commandsSent,
            },
          )}
        </Text>
        <Text style={styles.note}>
          {tr(
            'Limits: {{bytes}} payload bytes · {{cc}} CC bytes · {{commands}} APDUs · {{chunk}} bytes per read',
            {
              bytes: scope.maxBytes,
              cc: scope.maxCcBytes,
              commands: scope.maxCommands,
              chunk: scope.maxReadBytes,
            },
          )}
        </Text>
        {scope.limits.length > 0 && (
          <Field
            title={tr('Scan limits')}
            value={scope.limits.join(', ')}
            styles={styles}
            technical
          />
        )}
        <Field
          title={tr('Verified CC bytes')}
          value={scope.verifiedCcBytes}
          styles={styles}
        />
        <Field
          title={tr('Verified file bytes (CC + NLEN + payload)')}
          value={scope.verifiedFileBytes}
          styles={styles}
        />
        {result.cancelled && (
          <Text style={styles.warning}>
            {tr('Cancelled; verified bytes retained.')}
          </Text>
        )}
        {failure && (
          <>
            <Text style={styles.warning}>{label(failure.kind)}</Text>
            <Field
              title={tr('Failed phase')}
              value={label(failure.phase)}
              styles={styles}
            />
            <Field
              title="SW"
              value={swText(failure.sw1, failure.sw2)}
              styles={styles}
              technical
            />
            <Field
              title={tr('File identifier')}
              value={failure.fileId}
              styles={styles}
              technical
            />
            <Field
              title={tr('File offset')}
              value={failure.offset}
              styles={styles}
            />
            {failure.responseBytes != null && (
              <Field
                title={tr('Raw response')}
                value={hex(failure.responseBytes)}
                styles={styles}
                technical
              />
            )}
            {failure.message != null && (
              <Field
                title={tr('Native diagnostic')}
                value={failure.message}
                styles={styles}
                technical
              />
            )}
            {failure.messageTruncated && (
              <Text style={styles.note}>
                {tr('Diagnostic shortened from {{length}} characters.', {
                  length: failure.messageLength,
                })}
              </Text>
            )}
            <Text style={styles.note}>
              {tr('The cause is not inferred. No later APDU was sent.')}
            </Text>
          </>
        )}
      </Section>
      <Section title={tr('NDEF APPLICATION / CC')} styles={styles}>
        <Field title="AID" value={application.aid} styles={styles} technical />
        <Field
          title={tr('Application selection')}
          value={label(application.status)}
          styles={styles}
        />
        <Field
          title={tr('CC interpretation')}
          value={label(cc.status)}
          styles={styles}
        />
        <Field title="CCLEN" value={cc.declaredLength} styles={styles} />
        <Field
          title={tr('Mapping version')}
          value={
            cc.mappingVersion
              ? `${cc.mappingVersion.major}.${cc.mappingVersion.minor}`
              : null
          }
          styles={styles}
        />
        <Field title="MLe" value={cc.mle} styles={styles} />
        <Field title="MLc" value={cc.mlc} styles={styles} />
        <Field
          title={tr('CC bytes')}
          value={hex(cc.rawBytes)}
          styles={styles}
          technical
        />
        {cc.reason && (
          <Field
            title={tr('Technical reason')}
            value={cc.reason}
            styles={styles}
            technical
          />
        )}
        {cc.files.map((descriptor, index) => (
          <Field
            key={index}
            title={tr('File descriptor {{number}}', {number: index + 1})}
            value={JSON.stringify(descriptor, null, 2)}
            styles={styles}
            technical
          />
        ))}
      </Section>
      <Section title={tr('NDEF FILE / LENGTH COMPARISON')} styles={styles}>
        <Field
          title={tr('File identifier')}
          value={file.id}
          styles={styles}
          technical
        />
        <Field
          title={tr('File selected')}
          value={file.selected ? tr('Yes') : tr('No')}
          styles={styles}
        />
        <Field
          title={tr('Maximum file size (including NLEN)')}
          value={file.maxSize}
          styles={styles}
        />
        <Field
          title={tr('Read access byte')}
          value={file.readAccess == null ? null : hex([file.readAccess])}
          styles={styles}
          technical
        />
        <Field
          title={tr('Write access byte')}
          value={file.writeAccess == null ? null : hex([file.writeAccess])}
          styles={styles}
          technical
        />
        <Field title={tr('Initial NLEN')} value={file.nlen} styles={styles} />
        <Field
          title={tr('Initial NLEN bytes')}
          value={file.rawNlen == null ? null : hex(file.rawNlen)}
          styles={styles}
          technical
        />
        <Field
          title={tr('Final NLEN')}
          value={consistency.finalNlen}
          styles={styles}
        />
        <Field
          title={tr('Final NLEN bytes')}
          value={
            consistency.rawFinalNlen == null
              ? null
              : hex(consistency.rawFinalNlen)
          }
          styles={styles}
          technical
        />
        <Field
          title={tr('Length comparison')}
          value={label(consistency.status)}
          styles={styles}
        />
        <Text style={styles.note}>{tr(consistencyNotice)}</Text>
      </Section>
      <Section title={tr('NDEF INTERPRETATION')} styles={styles}>
        <Field
          title={tr('Interpretation')}
          value={label(ndef.status)}
          styles={styles}
        />
        {ndef.reason && (
          <Field
            title={tr('Technical reason')}
            value={ndef.reason}
            styles={styles}
            technical
          />
        )}
        {scope.readBytes > 240 && ndef.records.length > 0 && (
          <Button
            onPress={() => setRecordsExpanded((current) => !current)}
            accessibilityState={{expanded: recordsExpanded}}
          >
            {recordsExpanded
              ? tr('HIDE NDEF RECORDS')
              : tr('SHOW ALL NDEF RECORDS')}
          </Button>
        )}
        {(scope.readBytes <= 240 || recordsExpanded) &&
          ndef.records.map((record, index) => (
            <View key={index}>
              <Field
                title={tr('NDEF record {{number}}', {number: index + 1})}
                value={JSON.stringify(record, null, 2)}
                styles={styles}
                technical
              />
              {!!recordPreview(record) && (
                <Text selectable style={styles.body}>
                  {recordPreview(record)}
                </Text>
              )}
            </View>
          ))}
      </Section>
      <Section title={tr('VERIFIED NDEF PAYLOAD')} styles={styles}>
        {scope.readBytes > 240 && (
          <Button
            onPress={() => setPayloadExpanded((current) => !current)}
            accessibilityState={{expanded: payloadExpanded}}
          >
            {payloadExpanded
              ? tr('HIDE PAYLOAD BYTES')
              : tr('SHOW ALL PAYLOAD BYTES')}
          </Button>
        )}
        {file.chunks.length === 0 && (
          <Text style={styles.body}>{tr('No verified payload bytes')}</Text>
        )}
        {showPayload &&
          file.chunks.map((chunk) => (
            <View key={chunk.offset} style={styles.chunk}>
              <Text style={styles.label}>
                {tr('File offset {{offset}} · {{bytes}} bytes', {
                  offset: chunk.offset,
                  bytes: chunk.bytes.length,
                })}
              </Text>
              <Field
                title="Hex"
                value={hex(chunk.bytes)}
                styles={styles}
                technical
              />
              <Field
                title="ASCII"
                value={ascii(chunk.bytes)}
                styles={styles}
                technical
              />
            </View>
          ))}
      </Section>
    </>
  );
}

function Type4TranscriptItem({exchange, styles}) {
  useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  return (
    <View style={styles.exchange}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{expanded}}
        accessibilityLabel={tr(
          'APDU {{number}}: {{phase}}; {{outcome}}. Show or hide full exchange.',
          {
            number: exchange.sequence,
            phase: label(exchange.phase),
            outcome: label(exchange.outcome),
          },
        )}
        onPress={() => setExpanded((current) => !current)}
        style={styles.exchangeButton}
      >
        <Text style={styles.heading}>
          {expanded ? '▾' : '▸'} #{exchange.sequence} · {label(exchange.phase)}
        </Text>
        <Text style={styles.body}>
          SW {swText(exchange.sw1, exchange.sw2)} · {label(exchange.outcome)}
        </Text>
      </TouchableOpacity>
      {expanded && <Type4ExchangeDetails exchange={exchange} styles={styles} />}
    </View>
  );
}

function Type4ExchangeDetails({exchange, styles}) {
  useTranslation();
  return (
    <View style={styles.exchangeDetails}>
      <Field
        title={tr('Command APDU')}
        value={hex(exchange.command)}
        styles={styles}
        technical
      />
      <Field
        title={tr('Response data')}
        value={hex(exchange.data)}
        styles={styles}
        technical
      />
      <Field
        title={tr('Raw response')}
        value={
          exchange.responseBytes == null ? null : hex(exchange.responseBytes)
        }
        styles={styles}
        technical
      />
      <Field
        title={tr('File identifier')}
        value={exchange.fileId}
        styles={styles}
        technical
      />
      <Field
        title={tr('File offset')}
        value={exchange.offset}
        styles={styles}
      />
      <Field
        title={tr('Requested bytes')}
        value={exchange.requestedLength}
        styles={styles}
      />
      <Field
        title={tr('Original response length')}
        value={exchange.responseLength}
        styles={styles}
      />
      {exchange.responseTruncated && (
        <Text style={styles.warning}>
          {tr(
            'Incomplete response evidence; only the available bounded prefix is retained.',
          )}
        </Text>
      )}
      {exchange.message != null && (
        <Field
          title={tr('Native diagnostic')}
          value={exchange.message}
          styles={styles}
          technical
        />
      )}
      {exchange.messageTruncated && (
        <Text style={styles.note}>
          {tr('Diagnostic shortened from {{length}} characters.', {
            length: exchange.messageLength,
          })}
        </Text>
      )}
    </View>
  );
}

function Type4NdefScanScreen({navigation}) {
  useTranslation();
  const styles = createStyles(useVisualTheme());
  const [result, setResult] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [platformDetailsExpanded, setPlatformDetailsExpanded] =
    React.useState(false);
  const mounted = React.useRef(false);
  const focused = React.useRef(navigation?.isFocused?.() ?? true);
  const run = React.useRef(0);
  const inFlight = React.useRef(false);
  const cancelled = React.useRef(false);
  const cancelNative = React.useCallback(() => {
    if (inFlight.current) {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    const offBlur = navigation?.addListener?.('blur', () => {
      focused.current = false;
      run.current += 1;
      cancelNative();
    });
    const offFocus = navigation?.addListener?.('focus', () => {
      focused.current = true;
      setScanning(inFlight.current);
    });
    return () => {
      mounted.current = false;
      run.current += 1;
      cancelNative();
      offBlur?.();
      offFocus?.();
    };
  }, [navigation, cancelNative]);

  async function startScan() {
    if (inFlight.current || !mounted.current || !focused.current) {
      return;
    }
    const token = ++run.current;
    inFlight.current = true;
    cancelled.current = false;
    setScanning(true);
    setProgress(null);
    setError(null);
    const active = () =>
      mounted.current && focused.current && token === run.current;
    const shouldContinue = () => active() && !cancelled.current;
    try {
      const next = await NfcProxy.scanType4Ndef({
        shouldContinue,
        onProgress: (update) => {
          if (shouldContinue()) {
            setProgress(update);
          }
        },
      });
      if (
        active() &&
        next &&
        (!cancelled.current || next.scope.verifiedFileBytes > 0)
      ) {
        setResult(next);
      }
    } catch (cause) {
      if (shouldContinue()) {
        setError(String(cause));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current && focused.current) {
        setScanning(false);
        if (active()) {
          setProgress(null);
        }
      }
    }
  }
  function cancelScan() {
    cancelled.current = true;
    setProgress(null);
    cancelNative();
  }
  async function shareResult() {
    try {
      await Share.share({
        message: JSON.stringify(createType4Report(result), null, 2),
      });
    } catch (cause) {
      if (mounted.current && focused.current) {
        setError(String(cause));
      }
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={result?.transcript || []}
      keyExtractor={(item) => String(item.sequence)}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      ListHeaderComponent={
        <>
          <Section title={tr('Type 4 NDEF / APDU Inspector')} styles={styles}>
            <Text style={styles.body}>
              {tr(
                'Inspect mapping 2.0 NDEF application and file evidence with bounded SELECT / READ BINARY commands.',
              )}
            </Text>
            <Text style={styles.note}>{tr(effectsNotice)}</Text>
            <Button
              mode="contained"
              disabled={scanning}
              onPress={startScan}
              accessibilityLabel={tr('Start Type 4 NDEF inspection')}
            >
              {result ? tr('SCAN AGAIN') : tr('SCAN TAG')}
            </Button>
            {scanning && (
              <>
                <View style={styles.progress}>
                  <ActivityIndicator />
                  <Text style={styles.body}>
                    {label(progress?.phase || 'connecting')}
                  </Text>
                </View>
                {progress && (
                  <Text style={styles.body}>
                    {tr(
                      '{{bytes}} NDEF bytes verified · {{commands}} app APDUs',
                      {
                        bytes: progress.bytesRead,
                        commands: progress.commandsSent,
                      },
                    )}
                  </Text>
                )}
                <Button
                  onPress={cancelScan}
                  accessibilityLabel={tr('Cancel Type 4 NDEF inspection')}
                >
                  {tr('CANCEL')}
                </Button>
              </>
            )}
            {result && (
              <Button disabled={scanning} onPress={shareResult}>
                {tr('SHARE JSON')}
              </Button>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={tr('Platform and trace details')}
              accessibilityState={{expanded: platformDetailsExpanded}}
              onPress={() => setPlatformDetailsExpanded((current) => !current)}
              style={styles.disclosure}
            >
              <Text style={styles.heading}>
                {platformDetailsExpanded ? '▾' : '▸'}{' '}
                {tr('Platform and trace details')}
              </Text>
            </TouchableOpacity>
            {platformDetailsExpanded && (
              <>
                {Platform.OS === 'ios' && (
                  <Text style={styles.note}>{tr(iosNotice)}</Text>
                )}
                <Text style={styles.note}>{tr(traceNotice)}</Text>
                <Text style={styles.note}>
                  {tr('This inspection does not validate SDM.')}
                </Text>
              </>
            )}
            {error && (
              <Text selectable style={styles.warning}>
                {tr('Technical details: {{details}}', {details: error})}
              </Text>
            )}
          </Section>
          {result && (
            <>
              <Type4InspectionResult result={result} styles={styles} />
              <Text style={styles.heading}>
                {tr('APP APDU TRANSCRIPT')} ({result.transcript.length})
              </Text>
              <Text style={styles.note}>{tr(traceNotice)}</Text>
              <Text style={styles.note}>
                {tr(
                  'Tap each exchange to inspect its full command, response, status word, and diagnostic.',
                )}
              </Text>
            </>
          )}
        </>
      }
      renderItem={({item}) => (
        <Type4TranscriptItem exchange={item} styles={styles} />
      )}
    />
  );
}

function createStyles({colors, spacing, type}) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    content: {padding: spacing.lg, paddingBottom: spacing.xxl},
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    heading: {
      color: colors.accent,
      fontSize: type.label,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.text,
      fontSize: type.body,
      lineHeight: 23,
      flexShrink: 1,
    },
    note: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 23,
      marginVertical: spacing.sm,
    },
    label: {
      color: colors.textMuted,
      fontSize: type.caption,
      marginBottom: spacing.xs,
    },
    field: {marginTop: spacing.md, minWidth: 0},
    technical: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 23,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
      flexShrink: 1,
    },
    warning: {
      color: colors.warning,
      fontSize: type.body,
      lineHeight: 23,
      marginTop: spacing.md,
    },
    progress: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    chunk: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.md,
    },
    exchange: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: spacing.md,
    },
    exchangeButton: {padding: spacing.lg, minHeight: 48},
    exchangeDetails: {paddingHorizontal: spacing.lg, paddingBottom: spacing.lg},
    disclosure: {
      minHeight: 48,
      justifyContent: 'center',
      paddingTop: spacing.md,
    },
  });
}

export {
  Type4InspectionResult,
  Type4TranscriptItem,
  Type4ExchangeDetails,
  createStyles,
};
export default Type4NdefScanScreen;
