import React from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useVisualTheme} from '../visual/theme';

function PrettyCommandPayloadBytes({bytes, styles}) {
  const source = Array.isArray(bytes) ? bytes : [];
  const rows = [];
  for (let index = 0; index < source.length; index += 8) {
    rows.push(source.slice(index, index + 8));
  }

  if (rows.length === 0) {
    return <Text style={styles.emptyBytes}>No bytes</Text>;
  }
  return rows.map((row, index) => (
    <Text key={index} selectable style={styles.bytes}>
      {row.map((byte) => ('00' + byte.toString(16).toUpperCase()).slice(-2)).join(' ')}
    </Text>
  ));
}

function Action({label, icon, onPress, disabled, danger, styles, colors}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: Boolean(disabled)}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, danger && styles.dangerAction, disabled && styles.disabledAction]}>
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.accent} />
      <Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function CommandItem({cmd, resp, onDelete, onEdit, readOnly, onMoveUp, onMoveDown}) {
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);

  return (
    <View style={styles.card}>
      <Text style={styles.kind}>
        {cmd.type === 'command' ? 'TRANSCEIVE' : cmd.type.toUpperCase()}
      </Text>
      {cmd.type === 'command' ? (
        <PrettyCommandPayloadBytes bytes={cmd.payload} styles={styles} />
      ) : (
        <Text selectable style={styles.payload}>{String(cmd.payload ?? '')}</Text>
      )}
      {Array.isArray(resp) && (
        <View style={styles.response}>
          <Text style={styles.kind}>RESPONSE</Text>
          <PrettyCommandPayloadBytes bytes={resp} styles={styles} />
        </View>
      )}
      {!readOnly && (
        <View style={styles.actions}>
          <Action label="UP" icon="arrow-up" onPress={onMoveUp} disabled={!onMoveUp} styles={styles} colors={colors} />
          <Action label="DOWN" icon="arrow-down" onPress={onMoveDown} disabled={!onMoveDown} styles={styles} colors={colors} />
          <Action label="EDIT" icon="pencil-outline" onPress={onEdit} styles={styles} colors={colors} />
          <Action label="DELETE" icon="delete-outline" onPress={onDelete} danger styles={styles} colors={colors} />
        </View>
      )}
    </View>
  );
}

function createStyles(colors, spacing, type) {
  return StyleSheet.create({
    card: {backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.lg, marginBottom: spacing.md},
    kind: {color: colors.textMuted, fontSize: type.caption, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm},
    bytes: {color: colors.technical, fontSize: type.label, lineHeight: 24, fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'})},
    emptyBytes: {color: colors.textMuted, fontSize: type.body},
    payload: {color: colors.technical, fontSize: type.label, lineHeight: 22},
    response: {borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md},
    actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg},
    action: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 42, borderRadius: 10, borderColor: colors.border, borderWidth: 1, paddingHorizontal: spacing.md},
    actionText: {color: colors.accent, fontSize: type.caption, fontWeight: '700'},
    dangerAction: {borderColor: colors.danger},
    dangerText: {color: colors.danger},
    disabledAction: {opacity: 0.45},
  });
}

export default CommandItem;
