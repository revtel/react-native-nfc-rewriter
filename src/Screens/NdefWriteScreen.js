import * as React from 'react';
import {View} from 'react-native';
import RtdTextWriter from '../Components/RtdTextWriter';
import RtdUriWriter from '../Components/RtdUriWriter';
import WifiSimpleWriter from '../Components/WifiSimpleWriter';

function NdefWriteScreen(props) {
  const {ndefType} = props.route.params;

  const _renderNdefWriter = () => {
    if (ndefType === 'TEXT') {
      return <RtdTextWriter />;
    } else if (ndefType === 'URI') {
      return <RtdUriWriter />;
    } else if (ndefType === 'WIFI_SIMPLE') {
      return <WifiSimpleWriter />;
    }
    return null;
  };

  return (
    <View style={{flex: 1, padding: 20, backgroundColor: 'white'}}>
      {_renderNdefWriter()}
    </View>
  );
}

export default NdefWriteScreen;
