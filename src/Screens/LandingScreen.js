import React from 'react';
import {View, StyleSheet, ActivityIndicator, Animated} from 'react-native';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function LandingScreen(props) {
  const opacityAnimValue = React.useRef(new Animated.Value(0)).current;
  const scaleAnimValue = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    async function initialize() {
      Animated.timing(opacityAnimValue, {
        duration: 1000,
        toValue: 1,
        useNativeDriver: true,
      }).start();

      await delay(1000);

      Animated.parallel([
        Animated.timing(opacityAnimValue, {
          duration: 800,
          toValue: 0.2,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimValue, {
          duration: 800,
          toValue: 4,
          useNativeDriver: true,
        }),
      ]).start();

      await delay(600);

      props.navigation.reset({
        index: 0,
        routes: [{name: 'Main'}],
      });
    }

    initialize();
  }, [props.navigation, opacityAnimValue, scaleAnimValue]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../images/nfc-512.png')}
        resizeMode="contain"
        style={[
          styles.image,
          {opacity: opacityAnimValue, transform: [{scale: scaleAnimValue}]},
        ]}
      />

      <ActivityIndicator size="large" style={{marginTop: 50}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
  },
});

export default LandingScreen;
