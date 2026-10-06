import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import * as React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import {NfcTech, Ndef} from 'react-native-nfc-manager';
import RtdTextWriter from '../../Components/RtdTextWriter';
import RtdUriWriter from '../../Components/RtdUriWriter';
import RtdUriShortcutWriter from '../../Components/RtdUriShortcutWriter';
import WifiSimpleWriter from '../../Components/WifiSimpleWriter';
import VCardWriter from '../../Components/VCardWriter';
import ScreenHeader from '../../Components/ScreenHeader';
import {
  buildNdefRecordPayload,
  getNdefType,
} from '../../features/ndef-write/recordModel';
import {useVisualTheme} from '../../visual/theme';

const FORM_TITLE = {
  TEXT: 'Text record',
  URI: 'Link record',
  WIFI_SIMPLE: 'WiFi Simple Record',
  VCARD: 'vCard record',
};

function NdefWriteScreen(props) {
  useTranslation();
  const {colors, spacing, type} = useVisualTheme();
  const styles = createStyles(colors, spacing, type);
  const {params} = props.route;
  const handlerRef = React.useRef();

  function getSavedValue() {
    return params.savedRecord?.payload?.value;
  }

  const ndefType = getNdefType(params, {Ndef, NfcTech});
  const formTitle =
    ndefType === 'URI' &&
    (params.scheme || params.savedRecord?.payload?.value?.scheme)
      ? tr('Contact shortcut')
      : FORM_TITLE[ndefType] || tr('NDEF record');

  function getRecordPayload() {
    if (handlerRef.current?.getValue) {
      return buildNdefRecordPayload(ndefType, handlerRef.current.getValue(), {
        Ndef,
        NfcTech,
      });
    }

    return null;
  }

  const _renderNdefWriter = () => {
    const value = getSavedValue();
    if (ndefType === 'TEXT') {
      return <RtdTextWriter ref={handlerRef} value={value} />;
    } else if (ndefType === 'URI') {
      const scheme = value?.scheme || params.scheme;
      if (scheme) {
        return (
          <RtdUriShortcutWriter
            ref={handlerRef}
            value={value}
            scheme={scheme}
          />
        );
      }
      return <RtdUriWriter ref={handlerRef} value={value} />;
    } else if (ndefType === 'WIFI_SIMPLE') {
      return <WifiSimpleWriter ref={handlerRef} value={value} />;
    } else if (ndefType === 'VCARD') {
      return <VCardWriter ref={handlerRef} value={value} />;
    }
    return null;
  };

  return (
    <>
      <ScreenHeader
        title={params.savedRecord?.name || tr('WRITE NDEF')}
        navigation={props.navigation}
        getRecordPayload={getRecordPayload}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
      />
      <SafeAreaView edges={{bottom: true}} style={styles.safeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
        >
          <Text style={styles.eyebrow}>{tr('NDEF WRITER')}</Text>
          <Text style={styles.heading}>{tr(formTitle)}</Text>
          <Text style={styles.intro}>
            {tr(
              'Prepare the record below, then hold an NFC tag near your device to write it.',
            )}
          </Text>
          <View style={styles.formCard}>{_renderNdefWriter()}</View>
        </ScrollView>
      </SafeAreaView>
    </>
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
    heading: {
      color: colors.text,
      fontSize: type.hero,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    intro: {
      color: colors.textMuted,
      fontSize: type.label,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: spacing.lg,
    },
  });
}

export default NdefWriteScreen;
