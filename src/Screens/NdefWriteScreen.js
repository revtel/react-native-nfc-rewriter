import * as React from 'react';
import {View, Text} from 'react-native';
import {Menu, Button} from 'react-native-paper';
import RtdTextWriter from '../Components/RtdTextWriter';
import RtdUriWriter from '../Components/RtdUriWriter';
import WifiSimpleWriter from '../Components/WifiSimpleWriter';

function NdefWriteScreen(props) {
  const [ndefType, setNdefType] = React.useState('TEXT');
  const [showMenu, setShowMenu] = React.useState(false);

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{marginRight: 10}}>TYPE</Text>
        <Menu
          visible={showMenu}
          onDismiss={() => setShowMenu(false)}
          anchor={
            <Button mode="outlined" onPress={() => setShowMenu(true)}>
              {ndefType}
            </Button>
          }>
          {['TEXT', 'URI', 'WIFI_SIMPLE'].map((type) => (
            <Menu.Item
              key={type}
              onPress={() => {
                setNdefType(type);
                setShowMenu(false);
              }}
              title={type}
            />
          ))}
        </Menu>
      </View>

      <View style={{marginTop: 20}}>{_renderNdefWriter()}</View>
    </View>
  );
}

export default NdefWriteScreen;
