import React from 'react';
import {TouchableOpacity, View, Dimensions, Platform} from 'react-native';
import styled from 'styled-components';
import LinearGradient from 'react-native-linear-gradient';
import {getTechList} from '../Utils/getTechList';

class TagBanner extends React.Component {
  render() {
    let {tag, width, onPress} = this.props;
    let techs = getTechList(tag);

    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <View
          style={{
            width,
            height: width * (9 / 16),
            borderRadius: 10,
            overflow: 'hidden',
            alignItems: 'stretch',
            elevation: 3,
            shadowColor: '#000000',
            shadowOpacity: 0.4,
            shadowRadius: 1,
            shadowOffset: {
              height: 1,
              width: 0,
            },
          }}>
          <LinearGradient
            useAngle
            angle={40}
            angleCenter={{x: 0.5, y: 0.5}}
            locations={[0.2, 0.5, 0.6, 1]}
            colors={['#eaeaea', '#fefefe', '#fefefe', '#dddddd']}
            style={{
              padding: 10,
              width: '100%',
              height: '100%',
              backgroundColor: 'white',
            }}>
            <NfcTagText>NFC Tag</NfcTagText>

            <UidText>{`ID ${tag.id || '---'}`}</UidText>

            <LogoImage source={require('../../images/nfc-512.png')} />

            <LeftBottomArea>
              <TechList>
                {techs.map((tech) => (
                  <TechItem key={tech}>
                    <TechItemText>{tech}</TechItemText>
                  </TechItem>
                ))}
              </TechList>
            </LeftBottomArea>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }
}

const NfcTagText = styled.Text`
  color: #001a5c;
  font-size: 16px;
  font-weight: bold;
`;

const UidText = styled.Text`
  color: #001a5c;
  font-size: 16px;
`;

const LeftBottomArea = styled.View`
  flex: 1;
  justify-content: flex-end;
  align-items: flex-start;
  width: 70%;
`;

const TechList = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
`;

const TechItem = styled.View`
  padding-vertical: 3px;
  padding-horizontal: 8px;
  border-radius: 12px;
  border-width: 1px;
  border-color: #001a5c;
  margin-right: 10px;
  margin-top: 5px;
`;

const TechItemText = styled.Text`
  color: #001a5c;
`;

const LogoImage = styled.Image`
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 50px;
  height: 50px;
`;

export default TagBanner;
