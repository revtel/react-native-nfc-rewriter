import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import Clipboard from '@react-native-clipboard/clipboard';
import NdefMessage from '../../Components/NdefMessage';
import {createTagDiscovery} from '../../features/tag-discovery/model';
import {buildTagPresentation} from '../../features/tag-result-presentation/model';
import {useVisualTheme} from '../../visual/theme';

const EMPTY_TAG = Object.freeze({});
const TOOL_LABELS = {
  'nfc-a-transceive': 'Custom NFC-A Transceive',
  'nfc-a-script': 'NFC-A Flow Script',
  'iso-dep-transceive': 'Custom ISO-DEP Transceive',
  'iso-dep-script': 'ISO-DEP Flow Script',
  'type4-ndef-inspector': 'Type 4 NDEF / APDU Inspector',
  'nfc-v-transceive': 'Custom NFC-V Transceive',
  'iso15693-inspector': 'ISO 15693 / NFC-V Inspector',
  'type2-memory': 'Type 2 Memory Scan',
};
const LIMITATION_TEXT = {
  'type4-format-unconfirmed':
    'ISO-DEP alone does not confirm Type 4 formatting. The inspector checks NDEF application and file evidence.',
  'ios-detection-allowlists':
    'iOS discovery is limited by the app’s configured ISO-DEP application identifiers and FeliCa system codes.',
  'type5-format-unconfirmed':
    'Type 5 formatting is unconfirmed. The inspector checks available CC evidence.',
};
const RECORD_STATES = {
  'not-provided': 'No NDEF records were supplied by this scan.',
  unavailable:
    'NDEF data was not available in this scan. Its absence does not identify the cause.',
  invalid:
    'The supplied NDEF records field is invalid. Original data remains in Raw tag JSON.',
};
const NDEF_STATES = {
  'system-readwrite': 'System reports NDEF read/write',
  'system-readonly': 'System reports NDEF read-only',
  unconfirmed: 'NDEF support is unconfirmed',
  unknown: 'NDEF status is unavailable',
};

function DetailSection({title, children, styles}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}
function Disclosure({title, expanded, onPress, styles, children}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{expanded}}
        onPress={onPress}
        style={styles.disclosure}
      >
        <Text style={styles.disclosureLabel}>
          {expanded ? '▾' : '▸'} {title}
        </Text>
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
}
function technicalValue(value) {
  if (Array.isArray(value)) {
    let byteArray = true;
    for (let i = 0; i < value.length; i++) {
      if (
        !Object.prototype.hasOwnProperty.call(value, i) ||
        !Number.isInteger(value[i]) ||
        value[i] < 0 ||
        value[i] > 255
      ) {
        byteArray = false;
        break;
      }
    }
    return byteArray
      ? value.length === 0
        ? tr('(empty bytes)')
        : value
            .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
            .join(' ')
      : tr('Array: {{count}} items', {count: value.length});
  }
  if (value !== null && typeof value === 'object') {
    return tr('Object: {{count}} fields', {count: Object.keys(value).length});
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return tr('Value type: {{type}}', {type: typeof value});
  }
  return String(value);
}
function RawTagData({tag, styles, onCopy, feedback}) {
  const serialized = React.useMemo(() => {
    try {
      return {value: JSON.stringify(tag, null, 2), failed: false};
    } catch (_) {
      return {value: null, failed: true};
    }
  }, [tag]);
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={tr('Copy raw tag JSON')}
        style={styles.action}
        onPress={() => onCopy('raw', serialized.value)}
      >
        <Text style={styles.actionLabel}>{tr('Copy raw tag JSON')}</Text>
      </TouchableOpacity>
      {feedback?.target === 'raw' && (
        <CopyFeedback state={feedback.state} styles={styles} />
      )}
      {serialized.failed ? (
        <Text style={styles.notice}>
          {tr('Raw tag JSON could not be displayed.')}
        </Text>
      ) : (
        <Text selectable style={styles.rawData}>
          {serialized.value}
        </Text>
      )}
    </>
  );
}
function CopyFeedback({state, styles}) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={state === 'copied' ? styles.success : styles.error}
    >
      {tr(
        state === 'copied'
          ? 'Copied to clipboard.'
          : 'Could not copy. Try again.',
      )}
    </Text>
  );
}

function TagScanResult({tag, discovery, navigation}) {
  useTranslation();
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);
  const presentation = React.useMemo(
    () => buildTagPresentation(tag, discovery),
    [tag, discovery],
  );
  const [technicalExpanded, setTechnicalExpanded] = React.useState(false);
  const [rawExpanded, setRawExpanded] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);
  const mounted = React.useRef(false);
  const generation = React.useRef(0);
  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  async function copy(target, value) {
    const token = ++generation.current;
    setFeedback(null);
    try {
      if (typeof value !== 'string') {
        throw new Error('No copyable string');
      }
      await Clipboard.setString(value);
      if (mounted.current && generation.current === token) {
        setFeedback({target, state: 'copied'});
      }
    } catch (_) {
      if (mounted.current && generation.current === token) {
        setFeedback({target, state: 'failed'});
      }
    }
  }
  const {tools, limitations} = discovery;
  return (
    <SafeAreaView edges={{bottom: true}} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{tr('SCAN RESULT')}</Text>
        {presentation.recordsState === 'provided' ? (
          presentation.records.map((record) => (
            <NdefMessage
              key={record.index}
              presentation={record}
              colors={colors}
            />
          ))
        ) : (
          <DetailSection title="NDEF" styles={styles}>
            <Text style={styles.notice}>
              {tr(RECORD_STATES[presentation.recordsState])}
            </Text>
          </DetailSection>
        )}
        <DetailSection title={tr('SCAN SUMMARY')} styles={styles}>
          {presentation.identifiers.length === 0 && (
            <Text style={styles.notice}>{tr('Identifier unavailable')}</Text>
          )}
          {presentation.identifiers.map(({kind, value}, index) => {
            const identifierKind = kind === 'idm' ? 'IDm' : 'UID';
            const target = `${kind}:${index}`;
            return (
              <View key={target} style={styles.identifier}>
                <Text style={styles.fieldLabel}>{identifierKind}</Text>
                <Text selectable style={styles.technicalValue}>
                  {value}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={tr('Copy {{kind}}', {
                    kind: identifierKind,
                  })}
                  onPress={() => copy(target, value)}
                  style={styles.action}
                >
                  <Text style={styles.actionLabel}>
                    {tr('Copy {{kind}}', {kind: identifierKind})}
                  </Text>
                </TouchableOpacity>
                {feedback?.target === target && (
                  <CopyFeedback state={feedback.state} styles={styles} />
                )}
              </View>
            );
          })}
          <Text style={styles.fieldLabel}>{tr('Observed technologies')}</Text>
          <Text selectable style={styles.summaryValue}>
            {presentation.technologies.length
              ? presentation.technologies.join(' · ')
              : tr('Unavailable')}
          </Text>
          <Text style={styles.summaryValue}>
            {presentation.recordCount === null
              ? tr('Record count unavailable')
              : tr('Records supplied: {{count}}', {
                  count: presentation.recordCount,
                })}
          </Text>
          <Text style={styles.summaryValue}>
            {tr(NDEF_STATES[presentation.ndef.status])}
          </Text>
          {presentation.ndef.capacity !== null && (
            <Text style={styles.summaryValue}>
              {tr('System-reported capacity: {{bytes}} bytes', {
                bytes: presentation.ndef.capacity,
              })}
            </Text>
          )}
        </DetailSection>
        <DetailSection title={tr('AVAILABLE TOOLS')} styles={styles}>
          {limitations.map((reason) =>
            LIMITATION_TEXT[reason] ? (
              <Text key={reason} style={styles.notice}>
                {tr(LIMITATION_TEXT[reason])}
              </Text>
            ) : null,
          )}
          {tools.length ? (
            tools.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                accessibilityRole="button"
                accessibilityLabel={tr(TOOL_LABELS[tool.id])}
                style={styles.toolButton}
                onPress={() => navigation?.navigate(tool.screen, tool.params)}
              >
                <Text style={styles.actionLabel}>
                  {tr(TOOL_LABELS[tool.id])}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.notice}>
              {tr(
                'No compatible tool is available for the observed technologies.',
              )}
            </Text>
          )}
        </DetailSection>
        <Disclosure
          title={tr('Technical details')}
          expanded={technicalExpanded}
          onPress={() => setTechnicalExpanded((current) => !current)}
          styles={styles}
        >
          {technicalExpanded && (
            <>
              {presentation.ndefAcquisition && (
                <View style={styles.technicalField}>
                  <Text style={styles.fieldLabel}>
                    {tr('Additional NDEF read')}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {tr(
                      presentation.ndefAcquisition.source ===
                        'android-ndef-read'
                        ? 'Fresh Android NDEF read'
                        : 'Bounded Type 5 read',
                    )}
                  </Text>
                  <Text style={styles.fieldLabel}>
                    {tr('Additional read evidence')}
                  </Text>
                  <Text selectable style={styles.technicalValue}>
                    {JSON.stringify(presentation.ndefAcquisition, null, 2)}
                  </Text>
                </View>
              )}
              {presentation.tagFields.map(({name, value}, index) => (
                <View key={index} style={styles.technicalField}>
                  <Text style={styles.fieldLabel}>{name}</Text>
                  <Text selectable style={styles.technicalValue}>
                    {technicalValue(value)}
                  </Text>
                </View>
              ))}
              {presentation.records.map((record) => (
                <NdefMessage
                  key={record.index}
                  presentation={record}
                  technical
                  colors={colors}
                />
              ))}
            </>
          )}
        </Disclosure>
        <Disclosure
          title={tr('Raw tag JSON')}
          expanded={rawExpanded}
          onPress={() => setRawExpanded((current) => !current)}
          styles={styles}
        >
          {rawExpanded && (
            <RawTagData
              tag={tag}
              styles={styles}
              onCopy={copy}
              feedback={feedback}
            />
          )}
        </Disclosure>
      </ScrollView>
    </SafeAreaView>
  );
}

function TagDetailScreen({route, navigation}) {
  const tag = route?.params?.tag || EMPTY_TAG;
  const suppliedDiscovery = route?.params?.discovery;
  const routeKey = route?.key;
  const discovery = React.useMemo(
    () => suppliedDiscovery || createTagDiscovery(tag, Platform.OS),
    [tag, suppliedDiscovery],
  );
  // Key the whole result by incoming scan object identities, never UID or locale.
  const [scan, setScan] = React.useState({
    tag,
    suppliedDiscovery,
    routeKey,
    revision: 0,
  });
  if (
    scan.tag !== tag ||
    scan.suppliedDiscovery !== suppliedDiscovery ||
    scan.routeKey !== routeKey
  ) {
    setScan({tag, suppliedDiscovery, routeKey, revision: scan.revision + 1});
  }
  return (
    <TagScanResult
      key={scan.revision}
      tag={tag}
      discovery={discovery}
      navigation={navigation}
    />
  );
}

function createStyles(colors, spacing, type) {
  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: colors.background},
    content: {padding: spacing.lg, paddingBottom: spacing.xxl + spacing.lg},
    eyebrow: {
      color: colors.accent,
      fontSize: type.caption,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: type.caption,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    disclosure: {minHeight: 48, justifyContent: 'center'},
    disclosureLabel: {
      color: colors.accent,
      fontSize: type.label,
      fontWeight: '700',
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: type.caption,
      marginBottom: spacing.xs,
    },
    technicalValue: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 23,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
    summaryValue: {
      color: colors.text,
      fontSize: type.body,
      lineHeight: 23,
      marginTop: spacing.sm,
    },
    identifier: {marginBottom: spacing.md},
    notice: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    action: {
      minHeight: 48,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      padding: spacing.md,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
    },
    actionLabel: {color: colors.accent, fontSize: type.body, fontWeight: '600'},
    toolButton: {
      minHeight: 48,
      justifyContent: 'center',
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
    },
    technicalField: {marginTop: spacing.md, marginBottom: spacing.md},
    rawData: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 22,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
    success: {
      color: colors.success,
      fontSize: type.body,
      marginTop: spacing.sm,
    },
    error: {color: colors.danger, fontSize: type.body, marginTop: spacing.sm},
  });
}

export default TagDetailScreen;
