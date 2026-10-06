import catalog from '../src/i18n/catalog.json';
import {i18n, translateText as tr, sessionTranslator} from '../src/i18n';
import {classifyError, translateError} from '../src/i18n/errors';
import {
  createPreferences,
  resolveLanguage,
  LANGUAGE_KEY,
} from '../src/i18n/preferences';
import {encodeNdefValue} from '../src/services/nfc/ndefService';
import {executeScript} from '../src/features/nfc-script/interpreter';
import {newScript} from '../src/features/nfc-script/model';

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {},
  NfcError: {},
  NfcTech: {Ndef: 'Ndef'},
  Ndef: require('react-native-nfc-manager/ndef-lib'),
}));

afterEach(async () => {
  await i18n.changeLanguage('en');
});

test.each(['zh', 'zh-TW', 'zh-HK', 'zh-CN', 'zh-Hans', 'zh-Hant'])(
  'maps %s to Traditional Chinese',
  (tag) => {
    expect(resolveLanguage('system', [tag])).toBe('zh-Hant');
  },
);

test('resolves preferred locales in order and preserves manual overrides', () => {
  expect(resolveLanguage('system', ['fr-FR', 'ja-JP', 'en-US'])).toBe('ja');
  expect(resolveLanguage('system', [])).toBe('en');
  expect(resolveLanguage('system', ['fr'])).toBe('en');
  expect(resolveLanguage('invalid', [{languageCode: 'zh'}])).toBe('zh-Hant');
  expect(resolveLanguage('ja', ['zh-TW'])).toBe('ja');
});

test('preference writes are serialized and recover after a failed write', async () => {
  let finish;
  const storage = {
    getItem: jest.fn().mockResolvedValue('unknown'),
    setItem: jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined),
  };
  const preferences = createPreferences(storage);
  expect(await preferences.load()).toBe('system');
  storage.getItem.mockRejectedValueOnce(new Error('read'));
  expect(await preferences.load()).toBe('system');
  const first = preferences.save('zh-Hant');
  const second = preferences.save('en');
  const failure = second.catch((error) => error);
  const last = preferences.save('ja');
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  finish();
  await first;
  expect(await failure).toEqual(new Error('disk full'));
  await last;
  expect(storage.setItem.mock.calls).toEqual([
    [LANGUAGE_KEY, 'zh-Hant'],
    [LANGUAGE_KEY, 'en'],
    [LANGUAGE_KEY, 'ja'],
  ]);
});

test('all translations are complete and preserve interpolation parameters', () => {
  const parameters = (value) =>
    [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const values of Object.values(catalog)) {
    expect(values).toHaveLength(3);
    for (const value of values) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(parameters(value)).toEqual(parameters(values[0]));
    }
  }
});

test('translated dynamic values remain literal and session language stays fixed', async () => {
  await i18n.changeLanguage('zh-Hant');
  const translate = sessionTranslator();
  const name = '日本語 {{foo}} <tag>';
  expect(tr('Delete “{{name}}”?', {name})).toContain(name);
  await i18n.changeLanguage('ja');
  expect(tr('SCAN TAG')).toBe('タグをスキャン');
  expect(translate('Ready to scan NFC')).toBe('準備掃描 NFC');
  expect(tr('UID')).toBe('UID');
  const key = 'home.scan';
  const original = i18n.getResource('ja', 'translation', key);
  i18n.removeResourceBundle('ja', 'unused');
  i18n.addResource('ja', 'translation', key, undefined);
  expect(tr('SCAN NFC TAG')).toBe('SCAN NFC TAG');
  i18n.addResource('ja', 'translation', key, original);
});

test('error classification keeps original diagnostics and localizes presentation', async () => {
  const message = 'Undefined variable: page';
  expect(classifyError(message).code).toBe('errors.undefined');
  await i18n.changeLanguage('zh-Hant');
  expect(translateError('Step 2: ' + message)).toBe(
    '步驟 2： 未定義變數：page',
  );
  expect(translateError('opaque native error')).toContain(
    'opaque native error',
  );
  expect(message).toBe('Undefined variable: page');
});

test('language does not affect NDEF bytes, script commands or user stop messages', async () => {
  const inputs = [
    ['TEXT', '中文 English 日本語'],
    ['URI', 'https://example.com/中文'],
    ['URI', 'tel:+886123456789'],
    ['URI', 'sms:+886123456789'],
    ['URI', 'mailto:example@example.com'],
    ['WIFI_SIMPLE', {ssid: '中文 SSID', networkKey: 'secret'}],
    [
      'VCARD',
      {name: '日本語', tel: '123', org: '中文', email: 'a@example.com'},
    ],
  ];
  const baseline = inputs.map(([type, value]) => encodeNdefValue(type, value));
  for (const language of ['en', 'zh-Hant', 'ja']) {
    await i18n.changeLanguage(language);
    expect(inputs.map(([type, value]) => encodeNdefValue(type, value))).toEqual(
      baseline,
    );
    expect(tr('__proto__')).toBe('__proto__');
    const transceive = jest.fn().mockResolvedValue([1, 2]);
    const script = {
      ...newScript(),
      steps: [
        {type: 'transceive', template: '30 04'},
        {type: 'stop', outcome: 'failure', message: 'Completed'},
      ],
    };
    const result = await executeScript(script, {transceive});
    expect(transceive).toHaveBeenCalledWith([0x30, 4]);
    expect(result.error).toBe('Completed');
    expect(result.userMessage).toBe(true);
  }
});
