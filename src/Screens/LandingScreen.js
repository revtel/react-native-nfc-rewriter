import React from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function LandingScreen(props) {
  React.useEffect(() => {
    async function initialize() {
      await delay(1000);

      props.navigation.reset({
        index: 0,
        routes: [{name: 'Main'}],
      });
    }

    initialize();
  }, [props.navigation]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../images/nfc-512.png')}
        resizeMode="contain"
        style={styles.image}
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
