import React from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import NdefMessage from '../../Components/NdefMessage';
import {getTechList} from '../../Utils/getTechList';
import {useVisualTheme} from '../../visual/theme';

function DetailSection({title, children, styles}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function TagDetailScreen({route}) {
  const {tag} = route.params;
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);
  const techs = getTechList(tag);
  const ndef =
    Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0
      ? tag.ndefMessage[0]
      : null;

  return (
    <SafeAreaView edges={{bottom: true}} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SCAN RESULT</Text>
        <Text style={styles.intro}>Identity, technologies, and raw tag data.</Text>

        <DetailSection title="UID" styles={styles}>
          <Text selectable style={styles.technicalValue}>{tag.id || '---'}</Text>
        </DetailSection>

        <DetailSection title="TECHNOLOGIES" styles={styles}>
          {techs.length > 0 ? (
            <View style={styles.techList}>
              {techs.map((tech) => (
                <View key={tech} style={styles.techChip}>
                  <Text style={styles.techText}>{tech}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyValue}>---</Text>
          )}
        </DetailSection>

        <DetailSection title="NDEF" styles={styles}>
          {ndef ? (
            <NdefMessage ndef={ndef} colors={colors} />
          ) : (
            <Text style={styles.emptyValue}>No NDEF message</Text>
          )}
        </DetailSection>

        <DetailSection title="TAG OBJECT" styles={styles}>
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
    rawData: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 21,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
  });
}

export default TagDetailScreen;
