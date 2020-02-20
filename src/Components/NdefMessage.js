import React from 'react';
import {
  View, Text, Alert, TouchableOpacity, Linking,
} from 'react-native';
import {Ndef} from 'react-native-nfc-manager'

const TNF_MAP = {
  EMPTY: 0x0,
  WELL_KNOWN: 0x01,
  MIME_MEDIA: 0x02,
  ABSOLUTE_URI: 0x03,
  EXTERNAL_TYPE: 0x04,
  UNKNOWN: 0x05,
  UNCHANGED: 0x06,
  RESERVED: 0x07,
};

const RTD_MAP = {
  TEXT: 'T', // [0x54]
  URI: 'U', // [0x55]
  SMART_POSTER: 'Sp', // [0x53, 0x70]
  ALTERNATIVE_CARRIER: 'ac', //[0x61, 0x63]
  HANDOVER_CARRIER: 'Hc', // [0x48, 0x63]
  HANDOVER_REQUEST: 'Hr', // [0x48, 0x72]
  HANDOVER_SELECT: 'Hs', // [0x48, 0x73]
};

function tnfValueToName(value) {
  for (let name in TNF_MAP) {
    if (value === TNF_MAP[name]) {
      return name;
    }
  }
  return null;
}

function rtdValueToName(value) {
  value = value.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
  for (let name in RTD_MAP) {
    if (value === RTD_MAP[name]) {
      return name;
    }
  }
  return null;
}

class NdefMessage extends React.Component {
  render() {
    const {ndef} = this.props;
    const tnfName = tnfValueToName(ndef.tnf);
    const rtdName = rtdValueToName(ndef.type);

    return (
      <View>
        {tnfName && <Text>{`TNF: ${tnfName}`}</Text>}
        {rtdName && <Text>{`RTD: ${rtdName}`}</Text>}

        {this._renderPayload({ ndef, rtdName })}
      </View>
    )
  }

  _renderPayload = ({ndef, rtdName}) => {
    if (ndef.tnf === Ndef.TNF_WELL_KNOWN) {
      if (rtdName === 'URI') {
        return <RtdUriPayload ndef={ndef} />;
      } else if (rtdName === 'TEXT') {
        return <RtdTextPayload ndef={ndef} />;
      }
    }
    return null;
  }
}

class RtdTextPayload extends React.Component {
  render() {
    let {ndef} = this.props;
    let text = Ndef.text.decodePayload(ndef.payload);
    return (
      <Text style={{fontSize: 18}}>{text}</Text>
    )
  }
}

class RtdUriPayload extends React.Component {
  render() {
    let {ndef} = this.props;
    let uri = Ndef.uri.decodePayload(ndef.payload);
    return (
      <TouchableOpacity onPress={() => this._goToUri(uri)}>
        <Text style={{fontSize: 18, textDecorationLine: 'underline'}}>{uri}</Text>
      </TouchableOpacity>
    )
  }

  _goToUri = async (uri) => {
    try {
      await Linking.openURL(uri);
    } catch (ex) {
      console.warn(ex);
      Alert.alert(`Cannot open uri`);
    }
  }
}

export default NdefMessage;