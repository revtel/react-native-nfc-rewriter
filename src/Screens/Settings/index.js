import React from 'react';
import {Image, Linking, View, ScrollView, Text, StyleSheet} from 'react-native';
import {List} from 'react-native-paper';
import {version} from '../../../package.json';

const generalText = `
NfcReWriter is an open source project built on-top-of react-native. 

As an open source project, any kind of contributions and suggestions are always welcome!
`;

function SettingsScreen(props) {
  return (
    <ScrollView style={[styles.wrapper]}>
      <View style={styles.topBanner}>
        <Text style={{lineHeight: 16}}>{generalText}</Text>
      </View>
      <List.Section>
        <List.Item title="Version" description={version} />
        <List.Item
          title="Repository"
          description="https://github.com/revteltech/react-native-nfc-rewriter"
          onPress={() => {
            Linking.openURL(
              'https://github.com/revteltech/react-native-nfc-rewriter',
            );
          }}
        />
        <List.Subheader>Creators</List.Subheader>
        <List.Item
          title="Revteltech 忻旅科技"
          left={() => (
            <Image
              source={require('../../../images/revicon_512.png')}
              style={styles.maintainerIcon}
              resizeMode="contain"
            />
          )}
          description="https://www.revtel.tech"
          onPress={() => {
            Linking.openURL('https://www.revtel.tech');
          }}
        />
        <List.Item
          title="Washow 萬象創造"
          left={() => (
            <Image
              source={require('../../../images/washow_icon.png')}
              style={styles.maintainerIcon}
              resizeMode="contain"
            />
          )}
          description="http://www.washow.cc"
          onPress={() => {
            Linking.openURL('http://www.washow.cc');
          }}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  topBanner: {
    borderRadius: 6,
    margin: 10,
    paddingHorizontal: 15,
    backgroundColor: 'white',
  },
  maintainerIcon: {
    width: 54,
    height: 54,
    overflow: 'hidden',
    borderRadius: 4,
  },
});

export default SettingsScreen;
