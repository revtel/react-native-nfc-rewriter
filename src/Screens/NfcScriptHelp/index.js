import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../../i18n';
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useVisualTheme} from '../../visual/theme';

const HelpStylesContext = React.createContext(null);

function Section({title, children}) {
  useTranslation();
  const styles = React.useContext(HelpStylesContext);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Code({children}) {
  useTranslation();
  const styles = React.useContext(HelpStylesContext);
  return <Text style={styles.code}>{children}</Text>;
}

function Step({number, title, children}) {
  useTranslation();
  const styles = React.useContext(HelpStylesContext);
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>{`${number}. ${title}`}</Text>
      {children}
    </View>
  );
}

function NfcScriptHelpScreen({route}) {
  useTranslation();
  const tech = route?.params?.tech;
  const {colors} = useVisualTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <HelpStylesContext.Provider value={styles}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>{tr('Flow Script guide')}</Text>
        <Text style={styles.body}>
          {tr(
            'A script runs only when you tap RUN. This page is an example; it does not communicate with a tag.',
          )}
        </Text>

        <Section title={tr('Complete example: read a dynamic Type 2 page')}>
          <Text style={styles.body}>
            {tr(
              'Suppose a Type 2-compatible tag stores the page to read next in byte 1 of a response. That pointer location is only an example of a tag-specific format, not a standard NTAG field. Choose NfcA as the script technology and add these three steps in order:',
            )}
          </Text>
          <Step number="1" title={tr('TRANSCEIVE — read the fixed location')}>
            <Text style={styles.body}>{tr('Command bytes:')}</Text>
            <Code>30 04</Code>
            <Text style={styles.body}>
              {tr(
                'In this example, the tag returns 16 bytes. The first two are 04 10; byte offset 1 is 10 in hex.',
              )}
            </Text>
            <Code>04 10 00 00 00 00 00 00 00 00 00 00 00 00 00 00</Code>
          </Step>
          <Step number="2" title={tr('CAPTURE — save one response byte')}>
            <Code>
              {tr(
                'Variable name:  targetPage\nResponse source: data\nByte offset:    1\nInterpret as:   u8',
              )}
            </Code>
            <Text style={styles.body}>
              {tr(
                'CAPTURE reads the latest TRANSCEIVE response. Offset is zero-based, so offset 1 selects the second byte, 10 in hex. As u8, targetPage becomes the number 16.',
              )}
            </Text>
          </Step>
          <Step number="3" title={tr('TRANSCEIVE — use the variable')}>
            <Text style={styles.body}>{tr('Command bytes:')}</Text>
            <Code>{'30 ${targetPage:u8}'}</Code>
            <Text style={styles.body}>
              {tr(
                'The placeholder evaluates targetPage and writes it as one byte. With the captured value 16, the actual command sent is:',
              )}
            </Text>
            <Code>30 10</Code>
            <Text style={styles.body}>
              {tr(
                'The TRACE screen shows the captured value and resolved command bytes. If the byte is missing or the value does not fit u8, the run stops with an error instead of sending a guessed command.',
              )}
            </Text>
          </Step>
        </Section>

        <Section title={tr('Where expressions and placeholders go')}>
          <Text style={styles.body}>
            {tr(
              'SET, IF, and REPEAT fields take a numeric expression directly. Only TRANSCEIVE Command bytes use the ${expression:format} wrapper. Literal command bytes must be two hex digits separated by spaces.',
            )}
          </Text>
          <Text style={styles.body}>
            {tr(
              'A TRANSCEIVE card has two editing modes. TEXT lets you edit the whole command directly. BUILDER uses the shared hex keypad and a variable picker to add segments in send order, without positioning a cursor. You can move or remove segments. Both modes edit the same command; switch to TEXT for arithmetic inside a placeholder.',
            )}
          </Text>
          <Code>{tr('SET Numeric expression: targetPage + 4')}</Code>
          <Code>{tr('TRANSCEIVE Command bytes: 30 ${targetPage + 4:u8}')}</Code>
          <Text style={styles.body}>
            {tr(
              'Expressions accept decimal integers, 0x-prefixed hex integers, existing numeric variables, +, -, *, and parentheses. Division, bitwise operators, and arbitrary JavaScript are not supported.',
            )}
          </Text>
        </Section>

        <Section title={tr('Command placeholder formats')}>
          <Code>{tr('${value:u8}     1 byte, 0–255')}</Code>
          <Code>{tr('${value:u16be}  2 bytes, high byte first')}</Code>
          <Code>{tr('${value:u16le}  2 bytes, low byte first')}</Code>
          <Code>{tr('${payload:bytes}  captured byte array')}</Code>
          <Text style={styles.body}>
            {tr(
              'u16be and u16le accept 0\u201365535. For bytes, use a single byte-array variable name, not arithmetic. For example, CAPTURE with Interpret as bytes and Byte count 4 creates a four-byte variable that can be inserted with ${payload:bytes}. Values are never silently truncated.',
            )}
          </Text>
        </Section>

        <Section title={tr('Response source and ISO-DEP status')}>
          <Text style={styles.body}>
            {tr(
              'CAPTURE always reads the most recent response. On NfcA, data and raw contain the same bytes. On IsoDep, data excludes the final SW1/SW2 bytes, while raw includes them. After an IsoDep TRANSCEIVE, numeric sw holds those status bytes together.',
            )}
          </Text>
          <Code>
            {tr('Example raw response: 6F 00 90 00\ndata: 6F 00\nsw: 0x9000')}
          </Code>
          <Code>
            {tr(
              'IF Left expression: sw\nOperator: ==\nRight expression: 0x9000',
            )}
          </Code>
          {tech === 'IsoDep' && (
            <Text style={styles.note}>
              {tr(
                'Your current script uses IsoDep. For CAPTURE, choose data unless you intentionally need the SW1/SW2 bytes in raw.',
              )}
            </Text>
          )}
        </Section>

        <Section title={tr('ASSERT RESPONSE — require exact response values')}>
          <Text style={styles.body}>
            {tr(
              'Add assert-response immediately after a TRANSCEIVE to check its latest complete response without sending another command. A failed check stops the run before any later command.',
            )}
          </Text>
          <Text style={styles.body}>
            {tr(
              'Non-writing example: an IsoDep command is expected to return only status 9100. Its raw response is 91 00 and its data is empty. Add this assertion:',
            )}
          </Text>
          <Code>
            {tr(
              'Response source: data\nExact byte length: 0\nCheck exact bytes: on, leave bytes empty\nCheck status word: on, expected SW 9100',
            )}
          </Code>
          <Text style={styles.body}>
            {tr(
              'The empty byte field means an exact zero-byte expectation. Turning off a check omits that optional condition; leaving the required length blank is invalid. Literal bytes must be two-digit hex pairs, without variables or placeholders.',
            )}
          </Text>
          <Text style={styles.body}>
            {tr(
              'If the actual raw response is 00 91 00, data contains one byte. The assertion fails on length 1 versus 0 even though status 9100 matches, and the next command is not sent.',
            )}
          </Text>
          <Code>
            91 00 → data: [] · raw: [91 00]{'\n'}00 91 00 → data: [00] · raw:
            [00 91 00]
          </Code>
          <Text style={styles.body}>
            {tr(
              'On IsoDep, raw length includes SW1/SW2 and must be at least 2. A raw byte expectation and expected SW must agree. On NfcA, raw and data are the same bytes and status checking is unavailable.',
            )}
          </Text>
          <Text style={styles.body}>
            {tr(
              'TRACE shows each enabled comparison and expected/actual values. The assertion preview is limited to 4096 bytes, but matching uses the complete response and the preceding TRANSCEIVE keeps its full raw evidence.',
            )}
          </Text>
          <Text style={styles.body}>
            {tr(
              'Assertions verify response structure and values, not card authenticity or an atomic snapshot. Older app versions that do not support assert-response reject the script before running it.',
            )}
          </Text>
        </Section>

        <Section title={tr('Variable lifetime and safety')}>
          <Text style={styles.body}>
            {tr(
              'Define a variable with SET or CAPTURE before using it later. Names start with a letter or _ and then contain letters, digits, or _; names are case-sensitive. A variable created inside an IF path or REPEAT body can be referenced by later steps in that same path or body, not by steps after the path or repeat. REPEAT provides a zero-based index during each iteration.',
            )}
          </Text>
          <Code>{'30 ${targetPage + index * 4:u8}'}</Code>
        </Section>
      </ScrollView>
    </HelpStylesContext.Provider>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    content: {padding: 16, paddingBottom: 40},
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    section: {marginTop: 14, marginBottom: 4},
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    step: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
    },
    stepTitle: {fontWeight: '700', color: colors.accent, marginBottom: 8},
    body: {color: colors.textMuted, lineHeight: 21, marginBottom: 9},
    code: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 4,
      color: colors.technical,
      fontFamily: 'monospace',
      lineHeight: 20,
      padding: 8,
      marginBottom: 9,
    },
    note: {color: colors.accent, marginBottom: 9},
  });
}

export default NfcScriptHelpScreen;
