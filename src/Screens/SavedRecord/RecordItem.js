import * as React from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useVisualTheme} from '../../visual/theme';

function RecordAction({label, accessibilityLabel, icon, onPress, danger, colors, styles}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        danger && styles.dangerAction,
        pressed && {backgroundColor: colors.surfaceMuted},
      ]}>
      <Icon name={icon} size={17} color={danger ? colors.danger : colors.accent} />
      <Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function RecordItem({record, removeIdx, goToHandler, onCopy, idx}) {
  const {colors, spacing, type} = useVisualTheme();
  const styles = React.useMemo(() => makeStyles(colors, spacing, type), [colors, spacing, type]);

  function shareRecord() {
    Share.share({
      title: 'My NFC Record',
      url: `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(
        JSON.stringify(record),
      )}`,
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.recordHeader}>
        <Icon name="file-document-outline" size={23} color={colors.accent} />
        <Text style={styles.recordName}>{record.name}</Text>
      </View>
      <View style={styles.actions}>
        <RecordAction label="OPEN" accessibilityLabel={`Open ${record.name}`} icon="arrow-right" onPress={() => goToHandler(record)} colors={colors} styles={styles} />
        <RecordAction label="COPY" accessibilityLabel={`Copy ${record.name}`} icon="content-copy" onPress={onCopy} colors={colors} styles={styles} />
        <RecordAction label="SHARE" accessibilityLabel={`Share ${record.name}`} icon="share-variant-outline" onPress={shareRecord} colors={colors} styles={styles} />
        <RecordAction label="DELETE" accessibilityLabel={`Delete ${record.name}`} icon="delete-outline" onPress={() => removeIdx(idx, record.name)} danger colors={colors} styles={styles} />
      </View>
    </View>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: spacing.md, overflow: 'hidden'},
    recordHeader: {flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm},
    recordName: {flex: 1, flexShrink: 1, color: colors.text, fontSize: type.label, fontWeight: '700'},
    actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md},
    action: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 40, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8},
    actionText: {color: colors.accent, fontSize: type.caption, fontWeight: '700'},
    dangerAction: {borderColor: colors.danger},
    dangerText: {color: colors.danger},
  });
}

export default RecordItem;
