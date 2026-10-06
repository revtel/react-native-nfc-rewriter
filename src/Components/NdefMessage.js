import {withTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import React from 'react';
import {View, Text, Alert, TouchableOpacity, Linking} from 'react-native';
import {Ndef} from 'react-native-nfc-manager';

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
  value = value.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  for (let name in RTD_MAP) {
    if (value === RTD_MAP[name]) {
      return name;
    }
  }
  return null;
}

class NdefMessage extends React.Component {
  render() {
    const {ndef, colors} = this.props;
    const tnfName = tnfValueToName(ndef.tnf);
    const rtdName = rtdValueToName(ndef.type);

    return (
      <View>
        {tnfName && (
          <Text style={{color: colors.textMuted}}>{`TNF: ${tnfName}`}</Text>
        )}
        {rtdName && (
          <Text style={{color: colors.textMuted}}>{`RTD: ${rtdName}`}</Text>
        )}

        {this._renderPayload({ndef, rtdName, colors})}
      </View>
    );
  }

  _renderPayload = ({ndef, rtdName, colors}) => {
    if (ndef.tnf === Ndef.TNF_WELL_KNOWN) {
      if (rtdName === 'URI') {
        return <RtdUriPayload ndef={ndef} colors={colors} />;
      } else if (rtdName === 'TEXT') {
        return <RtdTextPayload ndef={ndef} colors={colors} />;
      }
    } else if (ndef.ntf === Ndef.MIME_MEDIA) {
      const mimeTypeStr = String.fromCharCode(...ndef.type);
      if (mimeTypeStr === Ndef.MIME_WFA_WSC) {
        return <WifiSimplePayload ndef={ndef} colors={colors} />;
      } else if (mimeTypeStr.indexOf('text') === 0) {
        return (
          <TextBasedMimePayload
            ndef={ndef}
            mimeType={mimeTypeStr}
            colors={colors}
          />
        );
      } else {
        return <Text style={{color: colors.text}}>{mimeTypeStr}</Text>;
      }
    }
    return null;
  };
}

class RtdTextPayload extends React.Component {
  render() {
    let {ndef, colors} = this.props;
    let text = Ndef.text.decodePayload(ndef.payload);
    return (
      <Text selectable style={{fontSize: 18, color: colors.text}}>
        {text}
      </Text>
    );
  }
}

class RtdUriPayload extends React.Component {
  render() {
    let {ndef, colors} = this.props;
    let uri = Ndef.uri.decodePayload(ndef.payload);
    return (
      <TouchableOpacity onPress={() => this._goToUri(uri)}>
        <Text
          style={{
            fontSize: 18,
            color: colors.accent,
            textDecorationLine: 'underline',
          }}
        >
          {uri}
        </Text>
      </TouchableOpacity>
    );
  }

  _goToUri = async (uri) => {
    try {
      await Linking.openURL(uri);
    } catch (ex) {
      console.warn(ex);
      Alert.alert(tr('Cannot open uri'));
    }
  };
}

class WifiSimplePayload extends React.Component {
  render() {
    let {ndef, colors} = this.props;
    let credentials = Ndef.wifiSimple.decodePayload(ndef.payload);
    return (
      <View style={{marginTop: 10}}>
        <Text style={{marginBottom: 5, color: colors.text}}>WIFI_SIMPLE</Text>
        <View style={{flexDirection: 'row', marginBottom: 5}}>
          <Text style={{color: colors.textMuted, marginRight: 5}}>SSID:</Text>
          <Text style={{fontSize: 16, flex: 1, color: colors.text}}>
            {credentials.ssid || '---'}
          </Text>
        </View>
        <View style={{flexDirection: 'row', marginBottom: 5}}>
          <Text style={{color: colors.textMuted, marginRight: 5}}>
            {tr('Network Key:')}
          </Text>
          <Text style={{fontSize: 16, flex: 1, color: colors.text}}>
            {credentials.networkKey || '---'}
          </Text>
        </View>
      </View>
    );
  }
}

class TextBasedMimePayload extends React.Component {
  render() {
    let {ndef, mimeType, colors} = this.props;
    let text = Ndef.util.bytesToString(ndef.payload);
    return (
      <View>
        <Text style={{fontSize: 16, color: colors.textMuted}}>{mimeType}</Text>
        <Text style={{fontSize: 16, color: colors.text}}>{text}</Text>
      </View>
    );
  }
}

export default withTranslation()(NdefMessage);
