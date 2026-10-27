import * as React from 'react';
import {FlatList, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import {useVisualTheme} from '../../visual/theme';

function PreviewButton({label, onPress, disabled, styles}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function ImportPreview({preview, committing, onConfirm, onCancel}) {
  useTranslation();
  const [showNames, setShowNames] = React.useState(false);
  const {colors, spacing, type} = useVisualTheme();
  const styles = React.useMemo(
    () => makeStyles(colors, spacing, type),
    [colors, spacing, type],
  );
  React.useEffect(() => {
    setShowNames(false);
  }, [preview?.plan.receipt]);
  if (!preview) return null;
  const {plan, summary, metadata} = preview;
  const countRows = [
    ['Current records: {{count}}', plan.currentCount],
    ['Records in file: {{count}}', plan.incomingCount],
    ['New records: {{count}}', plan.addedCount],
    ['Already present: {{count}}', plan.existingCount],
    ['Unsupported records: {{count}}', summary.unsupportedCount],
    ['After import: {{count}}', plan.finalCount],
  ];
  const header = (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        {tr('Import preview')}
      </Text>
      {!!preview.name && (
        <Text style={styles.body}>
          {tr('File: {{name}}', {name: preview.name})}
        </Text>
      )}
      {!!metadata.exportedAt && (
        <Text style={styles.body}>
          {tr('Backup time: {{time}}', {time: metadata.exportedAt})}
        </Text>
      )}
      {countRows.map(([label, count]) => (
        <Text key={label} style={styles.body}>
          {tr(label, {count})}
        </Text>
      ))}
      {Object.entries(summary.counts)
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => (
          <Text key={kind} style={styles.body}>
            {kind === 'script'
              ? tr('NFC Scripts')
              : kind === 'unsupported'
              ? tr('Other records')
              : kind}
            : {count}
          </Text>
        ))}
      {plan.incomingCount === 0 ? (
        <Text style={styles.body}>{tr('This backup has no records.')}</Text>
      ) : (
        plan.addedCount === 0 && (
          <Text style={styles.body}>
            {tr('All records in this backup are already present.')}
          </Text>
        )
      )}
      {plan.incomingCount > 0 && (
        <PreviewButton
          label={tr(showNames ? 'Hide record names' : 'Show record names')}
          onPress={() => setShowNames(!showNames)}
          styles={styles}
        />
      )}
    </View>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.panel}>
          <FlatList
            data={showNames ? summary.entries : []}
            keyExtractor={(item) => String(item.index)}
            ListHeaderComponent={header}
            renderItem={({item}) => (
              <View style={styles.nameRow}>
                <Text style={styles.body}>
                  {item.name ?? tr('Record {{index}}', {index: item.index + 1})}
                </Text>
                <Text style={styles.muted}>
                  {item.supported
                    ? item.kind === 'script'
                      ? tr('NFC Scripts')
                      : item.kind
                    : tr(
                        'Preserved for backup. This version cannot open this record.',
                      )}
                </Text>
              </View>
            )}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
          />
          <View style={styles.actions}>
            <PreviewButton
              label={tr('CANCEL')}
              disabled={committing}
              onPress={onCancel}
              styles={styles}
            />
            <PreviewButton
              label={
                committing
                  ? tr('Adding records…')
                  : tr('Add {{count}} records', {count: plan.addedCount})
              }
              disabled={committing || plan.addedCount === 0}
              onPress={onConfirm}
              styles={styles}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    panel: {
      height: '90%',
      flexShrink: 1,
      borderRadius: 14,
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: type.hero,
      color: colors.text,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    body: {
      fontSize: type.body,
      color: colors.text,
      marginBottom: spacing.sm,
      flexShrink: 1,
    },
    muted: {fontSize: type.caption, color: colors.textMuted},
    nameRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    button: {
      minHeight: 48,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 8,
      padding: spacing.sm,
      marginVertical: spacing.xs,
    },
    buttonText: {color: colors.accent, fontSize: type.body, fontWeight: '700'},
    disabled: {opacity: 0.45},
  });
}
export default ImportPreview;
