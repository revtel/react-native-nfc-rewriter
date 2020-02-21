import * as React from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
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
          options={['TEXT', 'URI']}
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
            marginBottom: 20, height: 150
          }}
          value={value}
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
      value: ''
    }
  }

  render() {
    let {value} = this.state;

    return (
      <View style={{width: 300}}>
        <TextInput 
          style={{
            padding: 8, borderRadius: 6, borderColor: 'grey', borderWidth: 1, 
            marginBottom: 20, height: 150
          }}
          value={value}
          onChangeText={value => this.setState({value})}
        />

        <ActionBtn onPress={this._writeNdef}>
          <ActionBtnText>Write URI</ActionBtnText>
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

    let result = await NfcProxy.writeNdef({type: 'URI', value});
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