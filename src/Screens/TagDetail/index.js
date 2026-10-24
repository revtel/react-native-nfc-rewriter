import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import React from 'react';
import {Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import NdefMessage from '../../Components/NdefMessage';
import {createTagDiscovery} from '../../features/tag-discovery/model';
import {useVisualTheme} from '../../visual/theme';

function DetailSection({title, children, styles}) {
  useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

const TOOL_LABELS = {
  'nfc-a-transceive': 'Custom NFC-A Transceive',
  'nfc-a-script': 'NFC-A Flow Script',
  'iso-dep-transceive': 'Custom ISO-DEP Transceive',
  'iso-dep-script': 'ISO-DEP Flow Script',
  'nfc-v-transceive': 'Custom NFC-V Transceive',
  'iso15693-inspector': 'ISO 15693 / NFC-V Inspector',
  'type2-memory': 'Type 2 Memory Scan',
};

const LIMITATION_TEXT = {
  'ios-detection-allowlists': 'iOS discovery is limited by the app’s configured ISO-DEP application identifiers and FeliCa system codes.',
  'type5-format-unconfirmed': 'Type 5 formatting is unconfirmed. The inspector checks available CC evidence.',
};

// A malformed native NDEF record must not hide the rest of the observations.
class RecordPreview extends React.Component {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  render() {
    const {record, colors} = this.props;
    const bytes = (value) => Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);
    if (this.state.failed || !record || !Number.isInteger(record.tnf) || !bytes(record.type) || !bytes(record.payload)) {
      return null;
    }
    return <NdefMessage ndef={record} colors={colors} />;
  }
}

function TagDetailScreen({route, navigation}) {
  useTranslation();
  const tag = route?.params?.tag || {};
  const discovery = route?.params?.discovery || createTagDiscovery(tag, Platform.OS);
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);
  const {technologies: techs, identifiers, ndef, tools, limitations} = discovery;

  return (
    <SafeAreaView edges={{bottom: true}} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{tr('SCAN RESULT')}</Text>
        <Text style={styles.intro}>
          {tr('Identity, technologies, and raw tag data.')}
        </Text>

        <DetailSection title={tr('Identifiers')} styles={styles}>
          {identifiers.length ? identifiers.map(({kind, value}) => (
            <View key={kind} style={styles.identifier}>
              <Text style={styles.sectionLabel}>{kind === 'idm' ? 'IDm' : 'UID'}</Text>
              <Text selectable style={styles.technicalValue}>{value}</Text>
            </View>
          )) : <Text style={styles.emptyValue}>{tr('Unavailable')}</Text>}
        </DetailSection>

        <DetailSection title={tr('TECHNOLOGIES')} styles={styles}>
          {techs.length > 0 ? (
            <View style={styles.techList}>
              {techs.map((tech) => (
                <View key={tech} style={styles.techChip}>
                  <Text style={styles.techText}>{tech}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyValue}>{tr('Unavailable')}</Text>
          )}
        </DetailSection>

        <DetailSection title="NDEF" styles={styles}>
          {ndef.records.length > 0 ? (
            ndef.records.map((record, index) => (
              <View key={index} style={styles.record}>
                <Text style={styles.sectionLabel}>{tr('NDEF record {{number}}', {number: index + 1})}</Text>
                <RecordPreview record={record} colors={colors} />
                <Text selectable style={styles.rawData}>{JSON.stringify(record, null, 2)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyValue}>{tr(ndef.status === 'unknown'
              ? 'NDEF data was not available in this scan. Its absence does not identify the cause.'
              : 'No NDEF records were supplied by this scan.')}</Text>
          )}
        </DetailSection>

        <DetailSection title={tr('AVAILABLE TOOLS')} styles={styles}>
          {limitations.map((reason) => LIMITATION_TEXT[reason] ? (
            <Text key={reason} style={styles.notice}>{tr(LIMITATION_TEXT[reason])}</Text>
          ) : null)}
          {tools.length ? tools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              accessibilityRole="button"
              accessibilityLabel={tr(TOOL_LABELS[tool.id])}
              style={styles.toolButton}
              onPress={() => navigation?.navigate(tool.screen, tool.params)}
            >
              <Text style={styles.toolLabel}>{tr(TOOL_LABELS[tool.id])}</Text>
            </TouchableOpacity>
          )) : (
            <Text style={styles.emptyValue}>{tr('No compatible tool is available for the observed technologies.')}</Text>
          )}
        </DetailSection>

        <DetailSection title={tr('TAG OBJECT')} styles={styles}>
          <Text selectable style={styles.rawData}>
            {JSON.stringify(tag, null, 2)}
          </Text>
        </DetailSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors, spacing, type) {
  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: colors.background},
    content: {padding: spacing.xl, paddingBottom: spacing.xxl + spacing.xl},
    eyebrow: {
      color: colors.accent,
      fontSize: type.caption,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    intro: {
      color: colors.textMuted,
      fontSize: type.label,
      marginBottom: spacing.xl,
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
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    technicalValue: {
      color: colors.technical,
      fontSize: type.label,
      lineHeight: 23,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
    techList: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
    techChip: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    techText: {color: colors.accent, fontSize: type.body, fontWeight: '600'},
    emptyValue: {color: colors.textMuted, fontSize: type.body},
    identifier: {marginBottom: spacing.sm},
    record: {marginBottom: spacing.md},
    notice: {color: colors.textMuted, fontSize: type.body, marginBottom: spacing.md},
    toolButton: {minHeight: 48, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8},
    toolLabel: {color: colors.accent, fontSize: type.label, fontWeight: '600'},
    rawData: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 21,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
  });
}

export default TagDetailScreen;
