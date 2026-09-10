import * as React from 'react';
import {View} from 'react-native';
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

function NdefWriteScreen(props) {
  const {params} = props.route;
  const handlerRef = React.useRef();

  function getSavedValue() {
    return params.savedRecord?.payload?.value;
  }

  const ndefType = getNdefType(params, {Ndef, NfcTech});

  function getRecordPayload() {
    if (handlerRef.current?.getValue) {
      return buildNdefRecordPayload(
        ndefType,
        handlerRef.current.getValue(),
        {Ndef, NfcTech},
      );
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
