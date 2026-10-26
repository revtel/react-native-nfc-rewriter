import React from 'react';
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ActivityIndicator, Button} from 'react-native-paper';
import NfcManager, {Ndef} from 'react-native-nfc-manager';
import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import NfcProxy from '../../NfcProxy';
import {createType5Report} from '../../features/type5-memory/report';
import {useVisualTheme} from '../../visual/theme';

const iosMetadataNotice =
  'iOS may read NDEF while obtaining the tag identifier. The block limits apply only to this inspector’s raw reads.';

const statusLabels = {
  complete: 'Reported range complete',
  partial: 'Partial inspection',
  limited: 'Limited inspection',
  unidentified: 'No verified memory',
  valid: 'Available',
  unavailable: 'Unavailable',
  malformed: 'Malformed',
  unsupported: 'Unsupported interpretation',
  supported: 'Supported Type 5 CC',
  incomplete: 'Incomplete',
  'not-type5': 'Type 5 format not established',
  inconsistent: 'CC conflicts with reported geometry',
  decoded: 'Decoded',
  empty: 'Empty NDEF message',
  absent: 'No NDEF TLV in the verified data area',
};
const scopeLabels = {
  'reported-range': 'System-reported range',
  'bounded-range': 'Bounded range',
  'block-zero-preview': 'Block zero preview · capacity unknown',
  none: 'No memory read',
};
const failureLabels = {
  'uid-unusable': 'The identifier cannot safely address this tag.',
  'identity-mismatch':
    'System information returned a different UID. Reading stopped.',
  'tag-error': 'The tag returned an error. Its cause is not inferred.',
  'transport-error': 'Communication failed. Its cause is unknown.',
  'malformed-response': 'The response was malformed. Reading stopped.',
  'block-size-mismatch': 'The block length changed. Reading stopped.',
};
const hex = (bytes) =>
  (bytes || [])
    .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
const ascii = (bytes) =>
  bytes
    .map((value) =>
      value >= 32 && value <= 126 ? String.fromCharCode(value) : '.',
    )
    .join('');
const known = (value) => (value == null ? tr('Unknown') : String(value));

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
    // Raw record evidence remains visible even if a content-specific decoder fails.
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

function Field({label, value, styles, technical = false}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={technical ? styles.technical : styles.body}>
        {known(value)}
      </Text>
    </View>
  );
}

// Exported presentation boundary also supports deterministic, RF-free fixture review.
function Type5InspectionResult({result, styles}) {
  const {scope, tag, systemInfo, failure, cc, ndef} = result;
  return (
    <>
      <Section title={tr(statusLabels[result.status])} styles={styles}>
        <Text style={styles.body}>{tr(scopeLabels[scope.kind])}</Text>
        {result.metadataRead?.mayReadNdef && (
          <Text style={styles.note}>{tr(iosMetadataNotice)}</Text>
        )}
        <Text style={styles.body}>
          {tr('{{read}} / {{planned}} blocks · {{bytes}} bytes verified', {
            read: scope.readBlocks,
            planned: scope.plannedBlocks,
            bytes: scope.readBytes,
          })}
        </Text>
        {result.cancelled && (
          <Text style={styles.warning}>
            {tr('Cancelled; verified bytes retained.')}
          </Text>
        )}
        {scope.limits.length > 0 && (
          <Field
            label={tr('Scan limits')}
            value={scope.limits.join(', ')}
            styles={styles}
            technical
          />
        )}
        <Field label="UID" value={tag.uidDisplayBE} styles={styles} technical />
        <Field
          label={tr('Platform identifier')}
          value={tag.platformTagIdRaw}
          styles={styles}
          technical
        />
        <Field
          label={tr('Wire UID (LE)')}
          value={tag.uidWireLE == null ? null : hex(tag.uidWireLE)}
          styles={styles}
          technical
        />
        {failure && (
          <View style={styles.failure}>
            <Text style={styles.warning}>
              {tr(failureLabels[failure.kind])}
            </Text>
            {failure.blockAddress != null && (
              <Field
                label={tr('Failed block')}
                value={failure.blockAddress}
                styles={styles}
              />
            )}
            <Field
              label={tr('Response flags')}
              value={failure.responseFlags}
              styles={styles}
            />
            <Field
              label={tr('Tag error code')}
              value={failure.tagErrorCode}
              styles={styles}
            />
            {failure.message != null && (
              <Field
                label={tr('Native diagnostic')}
                value={failure.message}
                styles={styles}
                technical
              />
            )}
            {failure.rawResponse != null && (
              <Field
                label={tr('Raw response')}
                value={hex(failure.rawResponse)}
                styles={styles}
                technical
              />
            )}
            <Text style={styles.body}>{tr('Later blocks were not read.')}</Text>
          </View>
        )}
      </Section>
      <Section title={tr('SYSTEM INFORMATION')} styles={styles}>
        <Text style={styles.body}>{tr(statusLabels[systemInfo.status])}</Text>
        <Field label="DSFID" value={systemInfo.dsfid} styles={styles} />
        <Field label="AFI" value={systemInfo.afi} styles={styles} />
        <Field
          label={tr('IC reference')}
          value={systemInfo.icReference}
          styles={styles}
        />
        <Field
          label={tr('Reported blocks')}
          value={systemInfo.blockCount}
          styles={styles}
        />
        <Field
          label={tr('Reported block size (bytes)')}
          value={systemInfo.blockSize}
          styles={styles}
        />
        <Field
          label={tr('Observed block size (bytes)')}
          value={scope.blockSize}
          styles={styles}
        />
        {systemInfo.reason && (
          <Field
            label={tr('Technical reason')}
            value={systemInfo.reason}
            styles={styles}
            technical
          />
        )}
        {systemInfo.rawResponse && (
          <Field
            label={tr('Raw response')}
            value={hex(systemInfo.rawResponse)}
            styles={styles}
            technical
          />
        )}
      </Section>
      <Section title={tr('TYPE 5 CAPABILITY CONTAINER')} styles={styles}>
        <Text style={styles.body}>{tr(statusLabels[cc.status])}</Text>
        {cc.rawBytes.length > 0 && (
          <Field
            label={tr('CC bytes')}
            value={hex(cc.rawBytes)}
            styles={styles}
            technical
          />
        )}
        <Field
          label={tr('Mapping version')}
          value={
            cc.mappingVersion
              ? `${cc.mappingVersion.major}.${cc.mappingVersion.minor}`
              : null
          }
          styles={styles}
        />
        <Field
          label={tr('Read access bits')}
          value={cc.readAccess}
          styles={styles}
        />
        <Field
          label={tr('Write access bits')}
          value={cc.writeAccess}
          styles={styles}
        />
        {cc.dataStart != null && (
          <Text style={styles.body}>
            {tr(
              'CC-declared data area: [{{start}}, {{end}}) · {{bytes}} bytes',
              {start: cc.dataStart, end: cc.dataEnd, bytes: cc.dataLength},
            )}
          </Text>
        )}
        {cc.reason && (
          <Field
            label={tr('Technical reason')}
            value={cc.reason}
            styles={styles}
            technical
          />
        )}
      </Section>
      <Section title="NDEF / TLV" styles={styles}>
        <Text style={styles.body}>{tr(statusLabels[ndef.status])}</Text>
        {ndef.reason && (
          <Field
            label={tr('Technical reason')}
            value={ndef.reason}
            styles={styles}
            technical
          />
        )}
        {ndef.records.map((record, index) => (
          <View key={index}>
            <Field
              label={tr('NDEF record {{number}}', {number: index + 1})}
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
        {ndef.tlvs.map((tlv, index) => (
          <Field
            key={`${tlv.offset}-${index}`}
            label={`TLV @ ${tlv.offset}`}
            value={JSON.stringify(tlv)}
            styles={styles}
            technical
          />
        ))}
      </Section>
      <Section title={tr('VERIFIED MEMORY BLOCKS')} styles={styles}>
        {result.blocks.length === 0 && (
          <Text style={styles.body}>{tr('No verified memory')}</Text>
        )}
        {result.blocks.map((block) => (
          <View
            key={block.address}
            testID={`type5-block-${block.address}`}
            style={styles.block}
          >
            <Text style={styles.label}>
              {tr('Block {{address}} · {{bytes}} bytes', {
                address: block.address,
                bytes: block.bytes.length,
              })}
            </Text>
            <Field
              label="Hex"
              value={hex(block.bytes)}
              styles={styles}
              technical
            />
            <Field
              label="ASCII"
              value={ascii(block.bytes)}
              styles={styles}
              technical
            />
          </View>
        ))}
      </Section>
    </>
  );
}

function Type5MemoryScanScreen({navigation}) {
  useTranslation();
  const theme = useVisualTheme();
  const styles = createStyles(theme);
  const [result, setResult] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [error, setError] = React.useState(null);
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
      const next = await NfcProxy.scanType5Memory({
        shouldContinue,
        onProgress: (update) => {
          if (shouldContinue()) {
            setProgress(update);
          }
        },
      });
      if (active() && next && (!cancelled.current || next.blocks.length > 0)) {
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
        message: JSON.stringify(createType5Report(result), null, 2),
      });
    } catch (cause) {
      if (mounted.current && focused.current) {
        setError(String(cause));
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title={tr('ISO 15693 / NFC-V Inspector')} styles={styles}>
        <Text style={styles.body}>
          {tr('Read system information and bounded memory blocks')}
        </Text>
        <Text style={styles.note}>
          {tr(
            'Read-only inspection. Unknown geometry permits only block zero. Type 5 formatting requires a supported CC.',
          )}
        </Text>
        {Platform.OS === 'ios' && (
          <Text style={styles.note}>{tr(iosMetadataNotice)}</Text>
        )}
        <Button
          mode="contained"
          disabled={scanning}
          onPress={startScan}
          accessibilityLabel={tr('Start ISO 15693 inspection')}
        >
          {result ? tr('SCAN AGAIN') : tr('SCAN TAG')}
        </Button>
        {scanning && (
          <>
            <View style={styles.progress}>
              <ActivityIndicator />
              <Text style={styles.body}>
                {progress?.phase === 'reading'
                  ? tr('{{read}} / {{planned}} blocks read', {
                      read: progress.blocksRead,
                      planned: progress.plannedBlocks ?? tr('Unknown'),
                    })
                  : tr('Reading tag information...')}
              </Text>
            </View>
            <Button
              onPress={cancelScan}
              accessibilityLabel={tr('Cancel ISO 15693 inspection')}
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
        {error && (
          <Text selectable style={styles.warning}>
            {tr('Technical details: {{details}}', {details: error})}
          </Text>
        )}
      </Section>
      {result && <Type5InspectionResult result={result} styles={styles} />}
    </ScrollView>
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
      marginBottom: spacing.md,
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
      marginVertical: spacing.md,
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
    failure: {marginTop: spacing.sm},
    progress: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    block: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.md,
    },
  });
}

export {Type5InspectionResult, createStyles};
export default Type5MemoryScanScreen;
