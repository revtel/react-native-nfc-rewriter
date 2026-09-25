import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

function Section({title, children}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Code({children}) {
  return <Text style={styles.code}>{children}</Text>;
}

function Step({number, title, children}) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>{`${number}. ${title}`}</Text>
      {children}
    </View>
  );
}

function NfcScriptHelpScreen({route}) {
  const tech = route?.params?.tech;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Flow Script guide</Text>
      <Text style={styles.body}>
        A script runs only when you tap RUN. This page is an example; it does not
        communicate with a tag.
      </Text>

      <Section title="Complete example: read a dynamic Type 2 page">
        <Text style={styles.body}>
          Suppose a Type 2-compatible tag stores the page to read next in byte
          1 of a response. That pointer location is only an example of a
          tag-specific format, not a standard NTAG field. Choose NfcA as the
          script technology and add these three steps in order:
        </Text>
        <Step number="1" title="TRANSCEIVE — read the fixed location">
          <Text style={styles.body}>Command bytes:</Text>
          <Code>30 04</Code>
          <Text style={styles.body}>
            In this example, the tag returns 16 bytes. The first two are 04 10;
            byte offset 1 is 10 in hex.
          </Text>
          <Code>04 10 00 00 00 00 00 00 00 00 00 00 00 00 00 00</Code>
        </Step>
        <Step number="2" title="CAPTURE — save one response byte">
          <Code>{'Variable name:  targetPage\nResponse source: data\nByte offset:    1\nInterpret as:   u8'}</Code>
          <Text style={styles.body}>
            CAPTURE reads the latest TRANSCEIVE response. Offset is zero-based,
            so offset 1 selects the second byte, 10 in hex. As u8, targetPage
            becomes the number 16.
          </Text>
        </Step>
        <Step number="3" title="TRANSCEIVE — use the variable">
          <Text style={styles.body}>Command bytes:</Text>
          <Code>{'30 ${targetPage:u8}'}</Code>
          <Text style={styles.body}>
            The placeholder evaluates targetPage and writes it as one byte. With
            the captured value 16, the actual command sent is:
          </Text>
          <Code>30 10</Code>
          <Text style={styles.body}>
            The TRACE screen shows the captured value and resolved command
            bytes. If the byte is missing or the value does not fit u8, the run
            stops with an error instead of sending a guessed command.
          </Text>
        </Step>
      </Section>

      <Section title="Where expressions and placeholders go">
        <Text style={styles.body}>
          SET, IF, and REPEAT fields take a numeric expression directly. Only
          TRANSCEIVE Command bytes use the ${'{expression:format}'} wrapper.
          Literal command bytes must be two hex digits separated by spaces.
        </Text>
        <Text style={styles.body}>
          A TRANSCEIVE card has two editing modes. TEXT lets you edit the whole
          command directly. BUILDER uses the shared hex keypad and a variable
          picker to add segments in send order, without positioning a cursor.
          You can move or remove segments. Both modes edit the same command;
          switch to TEXT for arithmetic inside a placeholder.
        </Text>
        <Code>{'SET Numeric expression: targetPage + 4'}</Code>
        <Code>{'TRANSCEIVE Command bytes: 30 ${targetPage + 4:u8}'}</Code>
        <Text style={styles.body}>
          Expressions accept decimal integers, 0x-prefixed hex integers,
          existing numeric variables, +, -, *, and parentheses. Division,
          bitwise operators, and arbitrary JavaScript are not supported.
        </Text>
      </Section>

      <Section title="Command placeholder formats">
        <Code>{'${value:u8}     1 byte, 0–255'}</Code>
        <Code>{'${value:u16be}  2 bytes, high byte first'}</Code>
        <Code>{'${value:u16le}  2 bytes, low byte first'}</Code>
        <Code>{'${payload:bytes}  captured byte array'}</Code>
        <Text style={styles.body}>
          u16be and u16le accept 0–65535. For bytes, use a single byte-array
          variable name, not arithmetic. For example, CAPTURE with Interpret as
          bytes and Byte count 4 creates a four-byte variable that can be
          inserted with ${'{payload:bytes}'}. Values are never silently
          truncated.
        </Text>
      </Section>

      <Section title="Response source and ISO-DEP status">
        <Text style={styles.body}>
          CAPTURE always reads the most recent response. On NfcA, data and raw
          contain the same bytes. On IsoDep, data excludes the final SW1/SW2
          bytes, while raw includes them. After an IsoDep TRANSCEIVE, numeric sw
          holds those status bytes together.
        </Text>
        <Code>{'Example raw response: 6F 00 90 00\ndata: 6F 00\nsw: 0x9000'}</Code>
        <Code>{'IF Left expression: sw\nOperator: ==\nRight expression: 0x9000'}</Code>
        {tech === 'IsoDep' && (
          <Text style={styles.note}>
            Your current script uses IsoDep. For CAPTURE, choose data unless you
            intentionally need the SW1/SW2 bytes in raw.
          </Text>
        )}
      </Section>

      <Section title="Variable lifetime and safety">
        <Text style={styles.body}>
          Define a variable with SET or CAPTURE before using it later. Names
          start with a letter or _ and then contain letters, digits, or _;
          names are case-sensitive. A variable created inside an IF path or
          REPEAT body can be referenced by later steps in that same path or
          body, not by steps after the path or repeat. REPEAT provides a
          zero-based index during each iteration.
        </Text>
        <Code>{'30 ${targetPage + index * 4:u8}'}</Code>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 16, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '700', color: '#23436A', marginBottom: 12},
  section: {marginTop: 14, marginBottom: 4},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#23436A', marginBottom: 8},
  step: {
    backgroundColor: 'white',
    borderColor: '#D8E0EA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  stepTitle: {fontWeight: '700', color: '#355E89', marginBottom: 8},
  body: {color: '#34465B', lineHeight: 21, marginBottom: 9},
  code: {
    backgroundColor: '#EDF3FA',
    borderRadius: 4,
    color: '#172B4D',
    fontFamily: 'monospace',
    lineHeight: 20,
    padding: 8,
    marginBottom: 9,
  },
  note: {color: '#355E89', marginBottom: 9},
});

export default NfcScriptHelpScreen;
