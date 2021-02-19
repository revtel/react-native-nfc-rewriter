import React from 'react';
import {StyleSheet, View, ScrollView, Text} from 'react-native';
import {Button} from 'react-native-paper';
import NdefMessage from '../../Components/NdefMessage';
import {getTechList} from '../../Utils/getTechList';

function TagDetailScreen(props) {
  const {tag} = props.route.params;

  const techs = getTechList(tag);
  const ndef =
    Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0
      ? tag.ndefMessage[0]
      : null;

  return (
    <ScrollView style={[styles.wrapper, {padding: 10}]}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>UID</Text>
        <Text>{tag.id || '---'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TECHNOLOGIES</Text>
        <View style={styles.row}>
          {techs.map((tech) => (
            <Button
              key={tech}
              mode="outlined"
              style={{marginRight: 5, marginBottom: 5}}>
              {tech}
            </Button>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NDEF</Text>
        {ndef ? <NdefMessage ndef={ndef} /> : <Text>---</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TAG OBJECT</Text>
        <Text>{JSON.stringify(tag, null, 2)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: 'gray',
  },
});

export default TagDetailScreen;
