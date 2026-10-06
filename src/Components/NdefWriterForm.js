import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button} from 'react-native-paper';
import {useVisualTheme} from '../visual/theme';

function NdefWriterForm({children, hint, onWrite}) {
  useTranslation();
  const {colors, spacing, type} = useVisualTheme();
  const styles = StyleSheet.create({
    hint: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    fields: {marginBottom: spacing.sm},
    writeButton: {borderRadius: 12},
    writeContent: {minHeight: 48},
  });

  return (
    <View>
      <Text style={styles.hint}>{tr(hint)}</Text>
      <View style={styles.fields}>{children}</View>
      <Button
        mode="contained"
        style={styles.writeButton}
        contentStyle={styles.writeContent}
        accessibilityLabel={tr('Write record to NFC tag')}
        onPress={onWrite}
      >
        {tr('WRITE TO TAG')}
      </Button>
    </View>
  );
}

export default NdefWriterForm;
