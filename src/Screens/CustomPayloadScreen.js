import React from 'react';
import styled from 'styled-components';
import PopupHexEditor from '../Components/PopupHexEditor';
import {Button, Alert} from 'react-native-elements';
import Icon from 'react-native-vector-icons/MaterialIcons'
import { Alert } from 'react-native';
import NfcProxy from '../NfcProxy';

class CustomPayloadScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      payloads: [],
      currEditIdx: 0,
    }
  }

  render() {
    const { tag, techType } = this.props.route.params;
    const { payloads } = this.state;

    return (
      <Wrapper>
        <Title>{techType.toUpperCase()} Custom Payload</Title>
        <Content contentContainerStyle={{}}>
          {payloads.length === 0 && (
            <EmptyHint>
              {"No payloads.\n Please click \"Add payload\" to start."}
            </EmptyHint>
          )}
          {payloads.map((payload, idx) => (
            <Payload key={idx}>
              <PayloadIdx>{idx}</PayloadIdx>
              <PayloadText>{payload}</PayloadText>
              <BtnSmall onPress={this._openEditor({idx, payload})}>
                <Icon name='edit' size={22} />
              </BtnSmall>
              <BtnSmall onPress={
                () => {
                  Alert.alert('Confirm', 'Are you sure?', [
                    {
                      text: 'Yes', 
                      onPress: () => {
                        let nextPayloads = [...payloads]
                        nextPayloads.splice(idx, 1);
                        this.setState({payloads: nextPayloads});
                      }
                    },
                    {text: 'No', onPress: () => 0}
                  ])
                }
              }>
                <Icon name='delete' size={22} />
              </BtnSmall>
            </Payload>
          ))}
        </Content>

        <Button 
          title='Add payload' 
          containerStyle={{marginBottom: 10}}
          onPress={this._openEditor({idx: payloads.length, payload: ''})}
        />

        <Button 
          title='Execute' 
          containerStyle={{marginBottom: 10}}
          onPress={this._execute}
        />

        <PopupHexEditor 
          ref={this._onRef}
          onResult={this._onEditResult}
        />
      </Wrapper>
    )
  }

  _execute = () => {
    let {payloads} = this.state;

    if (payloads.length === 0) {
      return;
    }

    payloads = this._payloadsToBytesArr(payloads);
    let [result, respones] = await NfcProxy.customTransceiveNfcA(payloads);

    console.warn('result', result);
    console.warn('responses', respones);
  }

  _openEditor = ({idx, payload}) => () => {
    if (this.ref) {
      this.setState({currEditIdx: idx}, () => {
        this.ref.setValue(payload);
        this.ref.open();
      })
    }
  }

  _onEditResult = payload => {
    if (payload.length % 2 !== 0) {
      Alert.alert('Hex payload length should be even');
      return;
    }

    let {currEditIdx, payloads} = this.state;
    if (payloads.length === currEditIdx) { // create new one
      this.setState({
        payloads: [...payloads, payload]
      })
    } else { // edit existing one
      let nextPayloads = [...payloads];
      nextPayloads[currEditIdx] = payload;
      this.setState({ payloads: nextPayloads });
    }
  }

  _payloadsToBytesArr = payloads => {
    let bytesArr = [];
    for (const hex of payloads) {
        let bytes = [];
        for (let i = 0; i < hex.length; i = i + 2) {
          bytes.push(parseInt(hex.slice(i, i + 2), 16));
        }
        bytesArr.push(bytes);
    }
    return bytesArr;
  }

  _onRef = ref => {
    this.ref = ref;
  }
}

const Wrapper = styled.View`
  flex: 1;
  padding: 10px;
`;

const Title = styled.Text`
  font-size: 24px;
  text-align: center;
`;

const EmptyHint = styled.Text`
  color: #aaa;
  font-size: 18px;
  align-self: center;
  margin-top: 20px;
  text-align: center;
`;

const Content = styled.ScrollView`
  flex: 1;
`;

const Payload = styled.View`
  margin-vertical: 10px;
  flex-direction: row;
  align-items: center;
  padding-left: 6px;
  border-left-color: #ccc;
  border-left-width: 5px;
`

const PayloadIdx = styled.Text`
  color: gray;
`;

const PayloadText = styled.Text`
  margin-horizontal: 10px;
  flex: 1;
`;

const BtnSmall = styled.TouchableOpacity`
  padding: 5px;
`;


export default CustomPayloadScreen;