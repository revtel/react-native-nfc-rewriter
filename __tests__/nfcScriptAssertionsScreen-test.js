import React from 'react';
import {Switch, Text, TextInput} from 'react-native';
import {Button, IconButton} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcProxy from '../src/NfcProxy';
import NfcScriptEditorScreen, {TraceView} from '../src/Screens/NfcScriptEditor';
import NfcScriptHelpScreen from '../src/Screens/NfcScriptHelp';
import {executeScript} from '../src/features/nfc-script/interpreter';
import {newScript} from '../src/features/nfc-script/model';
import {i18n, translateText as tr} from '../src/i18n';
import {translateError} from '../src/i18n/errors';
import catalog from '../src/i18n/catalog.json';

jest.mock('../src/NfcProxy', () => ({runNfcScript: jest.fn()}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));
jest.mock('../src/Components/ScreenHeader', () => 'ScreenHeader');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({bottom: 0}),
}));

const command = {type: 'transceive', template: '90 6A 00 00 00'};
const assertion = {type: 'assert-response', source: 'data', length: 0};
const button = (tree, title) =>
  tree.root.findAllByType(Button).find((node) => node.props.children === title);
const field = (tree, title) =>
  tree.root
    .findAllByType(TextInput)
    .find((node) => node.props.accessibilityLabel === title);
const toggle = (tree, title) =>
  tree.root
    .findAllByType(Switch)
    .find((node) => node.props.accessibilityLabel === title);
const saved = (tree) =>
  tree.root.findByType('ScreenHeader').props.getRecordPayload();
function text(tree) {
  return tree.root
    .findAllByType(Text)
    .flatMap((node) => [node.props.children].flat(Infinity))
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .replace(/\s+/g, ' ');
}
async function open(script) {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <NfcScriptEditorScreen
        route={{params: {savedRecord: {name: 'Assertions', payload: script}}}}
        navigation={{navigate: jest.fn()}}
      />,
    );
  });
  return tree;
}
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await i18n.changeLanguage('en');
});

test('assertion can be added, moved, removed and saved without enabling optional comparisons', async () => {
  const tree = await open({...newScript('IsoDep'), steps: [command]});
  await act(async () => button(tree, '+ ADD STEP').props.onPress());
  await act(async () => button(tree, 'assert-response').props.onPress());
  expect(saved(tree).steps[1]).toEqual(assertion);
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  const move = (label, index) =>
    tree.root
      .findAllByType(IconButton)
      .filter((node) => node.props.accessibilityLabel === label)[index];
  await act(async () => move('Move step up', 1).props.onPress());
  expect(saved(tree).steps[0]).toEqual(assertion);
  expect(button(tree, 'RUN').props.disabled).toBe(true);
  expect(text(tree)).toContain('no previous response to assert');
  await act(async () => move('Move step down', 0).props.onPress());
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  await act(async () => move('Remove step', 1).props.onPress());
  expect(saved(tree).steps).toEqual([command]);
  expect(NfcProxy.runNfcScript).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('empty bytes stay explicit, disabled checks delete properties, and blank length cannot become zero', async () => {
  const tree = await open({
    ...newScript('IsoDep'),
    steps: [command, assertion],
  });
  await act(async () =>
    toggle(tree, 'Check exact bytes').props.onValueChange(true),
  );
  expect(saved(tree).steps[1]).toEqual({...assertion, expectedHex: ''});
  expect(JSON.parse(JSON.stringify(saved(tree))).steps[1]).toHaveProperty(
    'expectedHex',
    '',
  );
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  await act(async () =>
    toggle(tree, 'Check status word').props.onValueChange(true),
  );
  expect(saved(tree).steps[1].expectedSw).toBe('9000');
  await act(async () =>
    field(tree, 'Expected SW (four hex digits)').props.onChangeText('9100'),
  );
  await act(async () =>
    field(tree, 'Exact byte length (0–4096)').props.onChangeText(''),
  );
  expect(saved(tree).steps[1].length).toBe('');
  expect(button(tree, 'RUN').props.disabled).toBe(true);
  await act(async () =>
    field(tree, 'Exact byte length (0–4096)').props.onChangeText('0'),
  );
  expect(saved(tree).steps[1].length).toBe(0);
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  await act(async () =>
    toggle(tree, 'Check exact bytes').props.onValueChange(false),
  );
  await act(async () =>
    toggle(tree, 'Check status word').props.onValueChange(false),
  );
  expect(
    Object.prototype.hasOwnProperty.call(saved(tree).steps[1], 'expectedHex'),
  ).toBe(false);
  expect(
    Object.prototype.hasOwnProperty.call(saved(tree).steps[1], 'expectedSw'),
  ).toBe(false);
  expect(saved(tree).steps[1]).toEqual(assertion);
  await act(async () => tree.unmount());
});

test('invalid imported values remain repairable and changing technology preserves a removable SW check', async () => {
  const tree = await open({
    ...newScript('IsoDep'),
    steps: [
      command,
      {
        ...assertion,
        source: 'other',
        length: null,
        expectedHex: null,
        expectedSw: '',
      },
    ],
  });
  expect(button(tree, 'RUN').props.disabled).toBe(true);
  expect(toggle(tree, 'Check exact bytes').props.value).toBe(true);
  expect(toggle(tree, 'Check status word').props.value).toBe(true);
  await act(async () => button(tree, 'data').props.onPress());
  await act(async () =>
    field(tree, 'Exact byte length (0–4096)').props.onChangeText('0'),
  );
  await act(async () =>
    field(tree, 'Expected literal hex bytes').props.onChangeText(''),
  );
  await act(async () =>
    field(tree, 'Expected SW (four hex digits)').props.onChangeText('9100'),
  );
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  await act(async () => button(tree, 'NfcA').props.onPress());
  expect(saved(tree).steps[1].expectedSw).toBe('9100');
  expect(button(tree, 'RUN').props.disabled).toBe(true);
  expect(text(tree)).toContain('Status checks require IsoDep.');
  await act(async () =>
    toggle(tree, 'Check status word').props.onValueChange(false),
  );
  expect(saved(tree).steps[1]).not.toHaveProperty('expectedSw');
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  expect(NfcProxy.runNfcScript).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('raw/SW contradictions disable RUN until the imported assertion is repaired', async () => {
  const raw = {
    ...assertion,
    source: 'raw',
    length: 2,
    expectedHex: '91 00',
    expectedSw: '9000',
  };
  const tree = await open({...newScript('IsoDep'), steps: [command, raw]});
  expect(button(tree, 'RUN').props.disabled).toBe(true);
  expect(text(tree)).toContain('assertion bytes conflict with expected status');
  await act(async () =>
    field(tree, 'Expected SW (four hex digits)').props.onChangeText('9100'),
  );
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  expect(saved(tree).steps[1]).toEqual({...raw, expectedSw: '9100'});
  await act(async () => tree.unmount());
});

test('assertion authoring works inside inherited-response branches without adding variables', async () => {
  const branch = {
    type: 'if',
    left: '1',
    operator: '==',
    right: '1',
    then: [],
    else: [],
  };
  const tree = await open({...newScript('IsoDep'), steps: [command, branch]});
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === '+ ADD STEP')[0]
      .props.onPress(),
  );
  await act(async () => button(tree, 'assert-response').props.onPress());
  expect(saved(tree).steps[1].then).toEqual([assertion]);
  expect(saved(tree).steps[1].else).toEqual([]);
  expect(button(tree, 'RUN').props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'trace, empty versus absent conditions, help and diagnostics are localized: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    for (const raw of [
      [0x91, 0],
      [0, 0x91, 0],
    ]) {
      const result = await executeScript(
        {
          ...newScript('IsoDep'),
          steps: [command, {...assertion, expectedHex: '', expectedSw: '9100'}],
        },
        {transceive: async () => raw},
      );
      let tree;
      await act(async () => {
        tree = renderer.create(<TraceView result={result} />);
      });
      expect(text(tree)).toContain(
        tr(result.success ? 'ASSERTION PASSED' : 'ASSERTION FAILED'),
      );
      expect(text(tree)).toContain(
        tr('Status check: {{result}}', {result: tr('PASS')}),
      );
      expect(text(tree)).toContain('9100');
      expect(text(tree)).toContain(tr('(empty bytes)'));
      expect(text(tree)).toContain(
        tr('Expected length: {{expected}} · Actual length: {{actual}}', {
          expected: 0,
          actual: raw.length - 2,
        }),
      );
      for (const node of tree.root
        .findAllByType(Text)
        .filter((candidate) => candidate.props.selectable)) {
        expect(node.props.numberOfLines).toBeUndefined();
        expect(node.props.allowFontScaling).not.toBe(false);
      }
      await act(async () => tree.unmount());
    }
    const absent = await executeScript(
      {...newScript('IsoDep'), steps: [command, assertion]},
      {transceive: async () => [0x91, 0]},
    );
    let tree;
    await act(async () => {
      tree = renderer.create(<TraceView result={absent} />);
    });
    expect(text(tree)).toContain(
      tr('Exact bytes check: {{result}}', {result: tr('Not checked')}),
    );
    expect(text(tree)).not.toContain(tr('Expected bytes:'));
    await act(async () => tree.unmount());
    await act(async () => {
      tree = renderer.create(
        <NfcScriptHelpScreen route={{params: {tech: 'IsoDep'}}} />,
      );
    });
    expect(text(tree)).toContain(
      tr('ASSERT RESPONSE — require exact response values'),
    );
    expect(text(tree)).toContain('00 91 00');
    expect(NfcProxy.runNfcScript).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    for (const [key, values] of Object.entries(catalog).filter(([code]) =>
      code.startsWith('errors.assertion_'),
    )) {
      const message = values[0]
        .replace('{{expected}}', '9100')
        .replace('{{actual}}', '919D');
      const translated = translateError(message);
      expect(translated).not.toContain('Technical details:');
      if (language !== 'en') expect(translated).not.toBe(message);
      expect(key).toBeTruthy();
    }
    tree = await open({
      ...newScript('IsoDep'),
      steps: [command, {...assertion, expectedHex: '', expectedSw: '9100'}],
    });
    expect(text(tree)).toContain(tr('assert-response'));
    expect(field(tree, tr('Exact byte length (0–4096)')).props.value).toBe('0');
    expect(toggle(tree, tr('Check exact bytes')).props.value).toBe(true);
    expect(field(tree, tr('Expected literal hex bytes')).props.value).toBe('');
    expect(field(tree, tr('Expected SW (four hex digits)')).props.value).toBe(
      '9100',
    );
    expect(saved(tree).steps[1]).toEqual({
      ...assertion,
      expectedHex: '',
      expectedSw: '9100',
    });
    await act(async () => tree.unmount());
  },
);

test('assertion preview truncation never replaces the complete original TRANSCEIVE trace', async () => {
  const raw = [...Array(4096).fill(0xab), 0xcd, 0x91, 0];
  const result = await executeScript(
    {...newScript('IsoDep'), steps: [command, assertion]},
    {transceive: async () => raw},
  );
  let tree;
  await act(async () => {
    tree = renderer.create(<TraceView result={result} />);
  });
  expect(text(tree)).toContain(
    'Assertion preview shows only the first 4096 bytes.',
  );
  expect(result.trace[0].response.raw).toEqual(raw);
  expect(result.trace[1].assertion.actualHex.split(' ')).toHaveLength(4096);
  const responseLine = tree.root
    .findAllByType(Text)
    .find((node) => node.props.selectable && node.props.children?.[0] === '← ');
  expect(responseLine.props.children.join('')).toContain('CD 91 00');
  await act(async () => tree.unmount());
});
