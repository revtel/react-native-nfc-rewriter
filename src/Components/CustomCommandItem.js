import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useVisualTheme} from '../visual/theme';

function PrettyCommandPayloadBytes({bytes, styles, compact = false}) {
  useTranslation();
  const source = Array.isArray(bytes) ? bytes : [];
  const formatBytes = (values) =>
    values
      .map((byte) => ('00' + byte.toString(16).toUpperCase()).slice(-2))
      .join(' ');
  if (compact) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text
          selectable
          style={source.length ? styles.bytes : styles.emptyBytes}
        >
          {source.length ? formatBytes(source) : tr('No bytes')}
        </Text>
      </ScrollView>
    );
  }
  const rows = [];
  for (let index = 0; index < source.length; index += 8) {
    rows.push(source.slice(index, index + 8));
  }

  if (rows.length === 0) {
    return <Text style={styles.emptyBytes}>{tr('No bytes')}</Text>;
  }
  return rows.map((row, index) => (
    <Text key={index} selectable style={styles.bytes}>
      {formatBytes(row)}
    </Text>
  ));
}

function Action({label, icon, onPress, disabled, danger, styles, colors}) {
  useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: Boolean(disabled)}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        pressed && styles.pressedAction,
        disabled && styles.disabledAction,
      ]}
    >
      <Icon
        name={icon}
        size={22}
        color={danger ? colors.danger : colors.accent}
      />
    </Pressable>
  );
}

function CommandItem({
  cmd,
  resp,
  onDelete,
  onEdit,
  readOnly,
  onMoveUp,
  onMoveDown,
  onDrag,
  isActive,
}) {
  useTranslation();
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);

  return (
    <View style={[styles.card, isActive && styles.activeCard]}>
      <View style={styles.row}>
        <View style={styles.command}>
          <Text style={styles.kind}>
            {cmd.type === 'command' ? 'TRANSCEIVE' : tr(cmd.type.toUpperCase())}
          </Text>
          {cmd.type === 'command' ? (
            <PrettyCommandPayloadBytes
              bytes={cmd.payload}
              styles={styles}
              compact
            />
          ) : (
            <Text selectable style={styles.payload}>
              {String(cmd.payload ?? '')}
            </Text>
          )}
        </View>
        {!readOnly && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Reorder command')}
              accessibilityHint={tr(
                'Long press and drag to change the command order',
              )}
              accessibilityState={{disabled: !onMoveUp && !onMoveDown}}
              accessibilityActions={[
                ...(onMoveUp ? [{name: 'moveUp', label: tr('Move up')}] : []),
                ...(onMoveDown
                  ? [{name: 'moveDown', label: tr('Move down')}]
                  : []),
              ]}
              onAccessibilityAction={({nativeEvent}) => {
                if (nativeEvent.actionName === 'moveUp') {
                  onMoveUp?.();
                } else if (nativeEvent.actionName === 'moveDown') {
                  onMoveDown?.();
                }
              }}
              disabled={isActive || (!onMoveUp && !onMoveDown)}
              onLongPress={onDrag}
              delayLongPress={200}
              style={[
                styles.action,
                !onMoveUp && !onMoveDown && styles.disabledAction,
              ]}
            >
              <Icon name="drag-horizontal" size={22} color={colors.textMuted} />
            </Pressable>
            <Action
              label={tr('EDIT')}
              icon="pencil-outline"
              onPress={onEdit}
              disabled={isActive}
              styles={styles}
              colors={colors}
            />
            <Action
              label={tr('DELETE')}
              icon="delete-outline"
              onPress={onDelete}
              disabled={isActive}
              danger
              styles={styles}
              colors={colors}
            />
          </View>
        )}
      </View>
      {Array.isArray(resp) && (
        <View style={styles.response}>
          <Text style={styles.kind}>{tr('RESPONSE')}</Text>
          <PrettyCommandPayloadBytes bytes={resp} styles={styles} />
        </View>
      )}
    </View>
  );
}

function createStyles(colors, spacing, type) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    activeCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.accent,
      elevation: 4,
    },
    row: {flexDirection: 'row', alignItems: 'center', minHeight: 48},
    command: {flex: 1, minWidth: 0, marginRight: spacing.xs},
    kind: {
      color: colors.textMuted,
      fontSize: type.caption,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    bytes: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 22,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
    emptyBytes: {color: colors.textMuted, fontSize: type.body},
    payload: {color: colors.technical, fontSize: type.label, lineHeight: 22},
    response: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },
    actions: {flexDirection: 'row', flexShrink: 0},
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      borderRadius: 8,
    },
    pressedAction: {backgroundColor: colors.surfaceMuted},
    disabledAction: {opacity: 0.45},
  });
}

export default CommandItem;
