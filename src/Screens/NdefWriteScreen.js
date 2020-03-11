import * as React from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import styled from 'styled-components';
import PopupSelector from '../Components/PopupSelector';
import NfcProxy from '../NfcProxy';

class NdefWriteScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      ndefType: 'TEXT',
    }
  }

  render() {
    let {navigation} = this.props;
    let {ndefType} = this.state;

    return (
      <View style={{flex: 1, padding: 20}}>
        <View style={{flexDirection: 'row', alignItems: 'center', alignSelf: 'center'}}>
          <Text style={{fontSize: 22, marginRight: 10}}>Type</Text>
          <ActionBtn onPress={() =>  this.ref && this.ref.open()}>
            <ActionBtnText>{ndefType}</ActionBtnText>
          </ActionBtn>
        </View>

        <View style={{alignSelf: 'center', marginTop: 20}}>
          {this._renderNdefWriter()}
        </View>

        <PopupSelector
          options={['TEXT', 'URI', 'WIFI_SIMPLE']}
          onSelect={
            ndefType => {
              this.ref.close();
              this.setState({ndefType});
            }
          }
          ref={ref => (this.ref = ref)}
        />
      </View>
    );
  }

  _renderNdefWriter = () => {
    let {ndefType} = this.state;
    if (ndefType === 'TEXT') {
      return <RtdTextWriter />;
    } else if (ndefType === 'URI') {
      return <RtdUriWriter />;
    } else if (ndefType === 'WIFI_SIMPLE') {
      return <WifiSimpleWriter />;
    }
    return null;
  }
}

class RtdTextWriter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: ''
    }
  }

  render() {
    let {value} = this.state;

    return (
      <View style={{width: 300}}>
        <TextInput 
          ref={ref => (this.inputRef = ref)}
          style={{
            padding: 8, borderRadius: 6, borderColor: 'grey', borderWidth: 1, 
            marginBottom: 20, height: 150, backgroundColor: 'white', color: 'black',
          }}
          value={value}
          autoCapitalize={false}
          onChangeText={value => this.setState({value})}
        />

        <ActionBtn onPress={this._writeNdef}>
          <ActionBtnText>Write TEXT</ActionBtnText>
        </ActionBtn>
      </View>
    )
  }

  _writeNdef = async () => {
    this.inputRef && this.inputRef.blur();

    let {value} = this.state;

    if (!value) {
      return;
    }

    let result = await NfcProxy.writeNdef({type: 'TEXT', value});
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  }
}

class RtdUriWriter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      prefix: 'https://',
    }
  }

  render() {
    let {value, prefix} = this.state;

    return (
      <View style={{width: 300}}>
        <View style={{flexDirection: 'row', marginBottom: 20}}>
          <TouchableOpacity 
            style={{paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'grey', alignSelf: 'flex-start', marginRight: 10}}
            onPress={() => this.ref.open()}
          >
            <Text style={{color: 'white'}}>{prefix}</Text>
          </TouchableOpacity>

          <TextInput 
            style={{
              flex: 1, padding: 8, borderRadius: 6, borderColor: 'grey', borderWidth: 1, height: 150,
              backgroundColor: 'white', color: 'black'
            }}
            autoCapitalize={false}
            value={value}
            onChangeText={value => this.setState({value})}
          />
        </View>

        <ActionBtn onPress={this._writeNdef}>
          <ActionBtnText>Write URI</ActionBtnText>
        </ActionBtn>

        <PopupSelector
          options={['https://', 'http://', '---']}
          onSelect={
            prefix => {
              this.ref.close();
              this.setState({prefix});
            }
          }
          ref={ref => (this.ref = ref)}
        />
      </View>
    )
  }

  _writeNdef = async () => {
    this.inputRef && this.inputRef.blur();

    let {value, prefix} = this.state;

    if (!value) {
      return;
    }

    if (prefix !== '---') {
      value = prefix + value;
    }

    let result = await NfcProxy.writeNdef({type: 'URI', value});
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  }
}

class WifiSimpleWriter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: {
        ssid: '',
        networkKey: '',
      } 
    }
  }

  render() {
    let {value} = this.state;

    return (
      <View style={{width: 300}}>
        <View style={{flexDirection: 'row'}}>
          <Text style={{marginRight: 10}}>SSID</Text>
          <TextInput 
            style={{
              padding: 8, borderRadius: 6, borderColor: 'grey', borderWidth: 1, 
              marginBottom: 20, flex: 1, backgroundColor: 'white', color: 'black',
            }}
            value={value.ssid}
            onChangeText={v => this.setState({value: {...value, ssid: v}})}
          />
        </View>

        <View style={{flexDirection: 'row'}}>
          <Text style={{marginRight: 10}}>Network Key</Text>
          <TextInput 
            style={{
              padding: 8, borderRadius: 6, borderColor: 'grey', borderWidth: 1, 
              marginBottom: 20, flex: 1, backgroundColor: 'white', color: 'black',
            }}
            value={value.networkKey}
            onChangeText={v => this.setState({value: {...value, networkKey: v}})}
          />
        </View>

        <ActionBtn onPress={this._writeNdef}>
          <ActionBtnText>Write Wifi Simple</ActionBtnText>
        </ActionBtn>
      </View>
    )
  }

  _writeNdef = async () => {
    this.inputRef && this.inputRef.blur();

    let {value} = this.state;

    if (!value) {
      return;
    }

    let result = await NfcProxy.writeNdef({type: 'WIFI_SIMPLE', value});
    Alert.alert(result ? 'Success' : 'Fail to write NDEF');
  }
}

const ActionBtn = styled.TouchableOpacity`
  padding-vertical: 6px;
  padding-horizontal: 10px;
  border-radius: 20px;
  border-width: 1px;
  border-color: black;
  min-width: 240px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: white;
`;

const ActionBtnText = styled.Text`
  font-size: 20px;
`;

export default NdefWriteScreen;