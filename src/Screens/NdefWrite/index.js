import * as React from 'react';
import {View} from 'react-native';
import {NfcTech, Ndef} from 'react-native-nfc-manager';
import RtdTextWriter from '../../Components/RtdTextWriter';
import RtdUriWriter from '../../Components/RtdUriWriter';
import RtdUriShortcutWriter from '../../Components/RtdUriShortcutWriter';
import WifiSimpleWriter from '../../Components/WifiSimpleWriter';
import VCardWriter from '../../Components/VCardWriter';
import ScreenHeader from '../../Components/ScreenHeader';

function NdefWriteScreen(props) {
  const {params} = props.route;
  const handlerRef = React.useRef();

  function getNdefType() {
    const payload = params.savedRecord?.payload;
    if (payload && payload.tech === NfcTech.Ndef) {
      if (payload.tnf === Ndef.TNF_WELL_KNOWN) {
        if (payload.rtd === Ndef.RTD_TEXT) {
          return 'TEXT';
        } else if (payload.rtd === Ndef.RTD_URI) {
          return 'URI';
        }
      } else if (payload.tnf === Ndef.TNF_MIME_MEDIA) {
        if (payload.mimeType === Ndef.MIME_WFA_WSC) {
          return 'WIFI_SIMPLE';
        } else if (payload.mimeType === 'text/vcard') {
          return 'VCARD';
        }
      }
    }

    return params.ndefType;
  }

  function getSavedValue() {
    return params.savedRecord?.payload?.value;
  }

  const ndefType = getNdefType();

  function getRecordPayload() {
    if (handlerRef.current?.getValue) {
      const payload = {
        tech: NfcTech.Ndef,
        tnf: Ndef.TNF_WELL_KNOWN,
        value: handlerRef.current.getValue(),
      };

      if (ndefType === 'TEXT') {
        payload.rtd = Ndef.RTD_TEXT;
      } else if (ndefType === 'URI') {
        payload.rtd = Ndef.RTD_URI;
      } else if (ndefType === 'WIFI_SIMPLE') {
        payload.tnf = Ndef.TNF_MIME_MEDIA;
        payload.mimeType = Ndef.MIME_WFA_WSC;
      } else if (ndefType === 'VCARD') {
        payload.tnf = Ndef.TNF_MIME_MEDIA;
        payload.mimeType = 'text/vcard';
      } else {
        throw new Error('NdefWriteScreen: cannot persist this payload');
      }

      return payload;
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
        title={params.savedRecord?.name || 'WRITE NDEF'}
        navigation={props.navigation}
        getRecordPayload={getRecordPayload}
        savedRecord={params.savedRecord}
        savedRecordIdx={params.savedRecordIdx}
      />
      <View style={{flex: 1, padding: 20, backgroundColor: 'white'}}>
        {_renderNdefWriter()}
      </View>
    </>
  );
}

export default NdefWriteScreen;
