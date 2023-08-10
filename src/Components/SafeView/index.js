import React from 'react';
import {SafeAreaView, View, StatusBar} from 'react-native';
import DeviceInfo from 'react-native-device-info';

export default function SafeView(props) {
  const {
    topColor = 'white',
    bottomColor = 'white',
    viewColor = 'white',
    showTop = true,
    showBottom = true,
    children,
  } = props;
  return (
    <>
      {showTop && (
        <>
          <SafeAreaView
            style={{
              backgroundColor: topColor,
              height: DeviceInfo.hasNotch() ? 40 : 0,
            }}
          />
          <StatusBar barStyle={'dark-content'} />
        </>
      )}
      <View style={{flex: 1, backgroundColor: viewColor}}>{children}</View>
      {showBottom && <SafeAreaView style={{backgroundColor: bottomColor}} />}
    </>
  );
}
