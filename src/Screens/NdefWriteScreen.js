import * as React from 'react';
import {View} from 'react-native';
import {NfcTech, Ndef} from 'react-native-nfc-manager';
import RtdTextWriter from '../Components/RtdTextWriter';
import RtdUriWriter from '../Components/RtdUriWriter';
import WifiSimpleWriter from '../Components/WifiSimpleWriter';
import {Appbar} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SaveRecordModal from '../Components/SaveRecordModal';
import {recordListHandler} from '../Utils/Storage';

function ScreenHeader(props) {
  const {navigation, title, getRecordPayload} = props;
  const [visible, setVisible] = React.useState(false);

  async function onPersistRecord(name) {
    const payload = getRecordPayload();
    const nextList = await recordListHandler.get();
    nextList.push({
      name,
      payload,
    });
    recordListHandler.set(nextList);
  }

  return (
    <>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={title} />
        <Appbar.Action
          icon={() => <Icon name="save" size={22} />}
          onPress={() => setVisible(true)}
        />
      </Appbar.Header>

      <SaveRecordModal
        visible={visible}
        onClose={() => setVisible(false)}
        onPersistRecord={onPersistRecord}
      />
    </>
  );
}

function NdefWriteScreen(props) {
  const {ndefType} = props.route.params;
  const handlerRef = React.useRef();

  function getRecordPayload() {
    if (handlerRef.current?.getValue) {
      const record = {
        tech: NfcTech.Ndef,
        tnf: Ndef.TNF_WELL_KNOWN,
        value: handlerRef.current.getValue(),
      };

      if (ndefType === 'TEXT') {
        record.rtd = Ndef.RTD_TEXT;
      } else if (ndefType === 'URI') {
        record.rtd = Ndef.RTD_URI;
      } else if (ndefType === 'WIFI_SIMPLE') {
        record.tnf = Ndef.TNF_MIME_MEDIA;
        record.mimeType = Ndef.MIME_WFA_WSC;
      } else {
        throw new Error('NdefWriteScreen: cannot persist this record');
      }

      return record;
    }

    return null;
  }

  const _renderNdefWriter = () => {
    if (ndefType === 'TEXT') {
      return <RtdTextWriter ref={handlerRef} />;
    } else if (ndefType === 'URI') {
      return <RtdUriWriter />;
    } else if (ndefType === 'WIFI_SIMPLE') {
      return <WifiSimpleWriter />;
    }
    return null;
  };

  return (
    <>
      <ScreenHeader
        navigation={props.navigation}
        title="WRITE NDEF"
        getRecordPayload={getRecordPayload}
      />
      <View style={{flex: 1, padding: 20, backgroundColor: 'white'}}>
        {_renderNdefWriter()}
      </View>
    </>
  );
}

export default NdefWriteScreen;
