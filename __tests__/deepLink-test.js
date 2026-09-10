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
        name: 'Main',
        params: {screen: 'NdefWrite', params: {savedRecord: record}},
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
});
