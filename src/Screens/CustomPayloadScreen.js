import React from 'react';
import styled from 'styled-components';
import PopupHexEditor from '../Components/PopupHexEditor';
import Icon from 'react-native-vector-icons/MaterialIcons'
import NfcProxy from '../NfcProxy';
import {Alert} from 'react-native';
import * as Widget from '../Components/Widget';

const toHex = num => {
  return ('00' + num.toString(16)).slice(-2);
};

const arrToHex = arr => {
  let hex = '';
  for (let byte of arr) {
    hex += toHex(byte);
  }
  return hex;
};

class CustomPayloadScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      payloads: [],
      resps: [],
      currEditIdx: 0,
    }
  }

  render() {
    const { techType } = this.props.route.params;
    const { payloads, resps } = this.state;
    const payloadAndRespArr = payloads.map((payload, idx) => ({
      payload, resp: resps[idx] 
    }));

    return (
      <Wrapper>
        <Title>{techType.toUpperCase()} Custom Payload</Title>
        <Content contentContainerStyle={{}}>
          {payloads.length === 0 && (
            <EmptyHint>
              {"No payloads.\n Please click \"Add payload\" to start."}
            </EmptyHint>
          )}
          {payloadAndRespArr.map(({payload, resp}, idx) => {
            return (
            <PayloadAndResp key={`${idx}-${payload}`}>
              <Payload>
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

              { resp && (
                <RespText>
                  {`RESP: ${arrToHex(resps[idx])}`}
                </RespText>
              )}
            </PayloadAndResp>
          )
          })}
        </Content>

        <Widget.PrimaryBtn
          onPress={this._openEditor({idx: payloads.length, payload: ''})}
        >
          <Widget.PrimaryBtnText>Add payload</Widget.PrimaryBtnText>
        </Widget.PrimaryBtn>

        <Widget.PrimaryBtn
          onPress={this._execute}
        >
          <Widget.PrimaryBtnText>Execute</Widget.PrimaryBtnText>
        </Widget.PrimaryBtn>

        <PopupHexEditor 
          ref={this._onRef}
          onResult={this._onEditResult}
        />
      </Wrapper>
    )
  }

  _execute = async () => {
    let {payloads} = this.state;

    if (payloads.length === 0) {
      return;
    }

    payloads = this._payloadsToBytesArr(payloads);
    let [err, resps] = await NfcProxy.customTransceiveNfcA(payloads);

    this.setState({resps});

    if (err) {
      Alert.alert('Transceive error!');
    }
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
  border-left-color: #aaa;
  border-left-width: 5px;
`

const PayloadAndResp = styled.View``;

const PayloadText = styled.Text`
  margin-horizontal: 10px;
  flex: 1;
`;

const RespText = styled.Text`
  color: grey;
`;

const BtnSmall = styled.TouchableOpacity`
  padding: 5px;
`;


export default CustomPayloadScreen;