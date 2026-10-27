import {parseShareDeepLink} from '../src/features/home/deepLink';

describe('share deep links', () => {
  it('parses both supported application schemes', () => {
    const record = {name: 'example', payload: {tech: 'Ndef'}};
    const data = encodeURIComponent(JSON.stringify(record));

    for (const scheme of [
      'com.washow.nfcopenrewriter://',
      'com.revteltech.nfcopenrewriter://',
    ]) {
      expect(parseShareDeepLink(`${scheme}share?data=${data}`)).toEqual({
        name: 'NdefWrite',
        params: {savedRecord: record},
        record,
      });
    }
  });

  it('rejects malformed, unsupported, and incomplete links', () => {
    expect(parseShareDeepLink('https://example.com/share')).toBeNull();
    expect(
      parseShareDeepLink('com.washow.nfcopenrewriter://unknown?data={}'),
    ).toBeNull();
    expect(
      parseShareDeepLink('com.washow.nfcopenrewriter://share?data=nope'),
    ).toBeNull();
  });

  it('loads a shared versioned NFC script without executing it', () => {
    const record = {
      name: 'Read & inspect',
      payload: {
        kind: 'nfc-script',
        version: 1,
        tech: 'NfcA',
        steps: [{type: 'stop', outcome: 'success', message: 'A & B'}],
      },
    };
    const url = `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(
      JSON.stringify(record),
    )}`;
    expect(parseShareDeepLink(url)).toEqual({
      name: 'NfcScriptEditor',
      params: {savedRecord: record},
      record,
    });
  });
});

describe('incoming promotion links', () => {
  const {
    parseIncomingLink,
    PROMOTION_PATHS,
  } = require('../src/features/home/deepLink');
  test.each(PROMOTION_PATHS)(
    'opens Home for the exact promotion path %s',
    (path) => {
      expect(parseIncomingLink(`https://revtel.github.io${path}`)).toEqual({
        name: 'MainTabs',
        params: {screen: 'HomeTab'},
      });
      expect(
        parseIncomingLink(`https://revtel.github.io${path}?source=nfc#intro`),
      ).toEqual({
        name: 'MainTabs',
        params: {screen: 'HomeTab'},
      });
    },
  );
  test.each([
    null,
    '',
    'http://revtel.github.io/react-native-nfc-rewriter/',
    'https://revtel.github.io.evil.test/react-native-nfc-rewriter/',
    'https://revtel.github.io@evil.test/react-native-nfc-rewriter/',
    'https://revtel.github.io:444/react-native-nfc-rewriter/',
    'https://revtel.github.io/other-project/',
    'https://revtel.github.io/react-native-nfc-rewriter/unknown/',
    'https://revtel.github.io/react-native-nfc-rewriter/%2e%2e/',
    'com.revteltech.nfcopenrewriter://share?data=nope',
  ])('ignores unsupported or malformed input %s', (url) => {
    expect(parseIncomingLink(url)).toBeNull();
  });
});
