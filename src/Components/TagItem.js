import React from 'react';
import {TouchableOpacity, View, Text, Dimensions, Image} from 'react-native';
import styled from 'styled-components';
import LinearGradient from 'react-native-linear-gradient';

class CardItem extends React.Component {
  render() {
    let {card, onPress} = this.props;
    let width = Dimensions.get('window').width;

    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <View
          style={{
            width: width - 20,
            height: (width - 20) * (9 / 16),
            borderRadius: 10,
            overflow: 'hidden',
            alignItems: 'stretch',
            // android
            elevation: 3,
            // iOS
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
              width: '100%',
              height: '100%',
              backgroundColor: 'white',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: '#001A5C',
                fontSize: 16,
                position: 'absolute',
                top: 40,
                left: 15,
                letterSpacing: 1,
              }}>
              {`ID ${card.id || '---'}`}
            </Text>
            <Text
              style={{
                color: '#001A5C',
                fontSize: 16,
                fontWeight: 'bold',
                position: 'absolute',
                top: 15,
                left: 15,
                letterSpacing: 1,
              }}>
              {'NFC Tag'}
            </Text>

            <Image
              style={{
                position: 'absolute',
                bottom: 15,
                right: 12,
                width: 50,
                height: 50,
              }}
              source={require('../../images/nfc-512.png')}
            />
            <Image
              style={{
                position: 'absolute',
                top: 15,
                right: 15,
                width: 24,
                height: 29,
              }}
              source={require('../../images/wireless.png')}
            />
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }
}

export default CardItem;
