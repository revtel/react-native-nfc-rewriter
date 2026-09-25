import * as React from 'react';
import {SectionList, Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcProxy from '../src/NfcProxy';
import Ntag21xMemoryScanScreen from '../src/Screens/Ntag21xMemoryScan';

jest.mock('../src/NfcProxy', () => ({scanNtag21x: jest.fn()}));
jest.mock('react-native', () => {
  // Jest hoists this factory, so JSX needs a local React binding.
  // eslint-disable-next-line no-shadow
  const React = require('react');
  const RN = jest.requireActual('react-native');
  const mocked = Object.create(RN);
  Object.defineProperty(mocked, 'SectionList', {value: (props) => (
      <RN.View>
        {props.ListHeaderComponent}
        {props.sections.map((section) => (
          <RN.View key={section.key}>
            {props.renderSectionHeader({section})}
            {section.data.map((item) => (
              <RN.View key={props.keyExtractor(item)}>
                {props.renderItem({item, section})}
              </RN.View>
            ))}
          </RN.View>
        ))}
      </RN.View>
    )});
  return mocked;
});

function visibleText(tree) {
  return tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .join(' ');
}

function makePartialScan() {
  const pages = Array.from({length: 45}, (_, address) => ({
    address,
    status: address < 5 ? 'read' : address === 5 ? 'unreadable' : 'not_scanned',
    bytes: address < 5 ? [0, 0, 0, 0] : null,
  }));
  pages[3].bytes = [0xe1, 0x10, 0x12, 0x00];
  pages[4].bytes = [0x03, 0x04, 0xaa, 0xbb];
  return {
    status: 'partial',
    model: 'NTAG213',
    pageCount: 45,
    readPages: 5,
    pages,
    failure: {address: 5, status: 'unreadable', cause: 'unknown'},
  };
}

describe('NTAG21x memory scan screen', () => {
  beforeEach(() => NfcProxy.scanNtag21x.mockReset());

  it('discloses read effects before a scan and shows an unsupported result', async () => {
    NfcProxy.scanNtag21x.mockResolvedValue({
      status: 'unsupported',
      model: null,
      pages: [],
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<Ntag21xMemoryScanScreen />);
    });
    expect(visibleText(tree)).toContain('counter may advance during reading');
    await act(async () => {
      await tree.root.findByType(Button).props.onPress();
    });
    expect(NfcProxy.scanNtag21x).toHaveBeenCalledTimes(1);
    expect(visibleText(tree)).toContain('UNSUPPORTED TAG');
    tree.unmount();
  });

  it('keeps raw pages and marks incomplete interpretations on a partial scan', async () => {
    NfcProxy.scanNtag21x.mockResolvedValue(makePartialScan());
    let tree;
    await act(async () => {
      tree = renderer.create(<Ntag21xMemoryScanScreen />);
    });
    await act(async () => {
      await tree.root.findByType(Button).props.onPress();
    });
    const list = tree.root.findByType(SectionList);
    const summary = visibleText(tree);
    expect(summary).toContain('NTAG213');
    expect(summary).toContain('PARTIAL');
    expect(summary).toContain('Page 05 unreadable');
    const ccRow = list.props.renderItem({
      item: makePartialScan().pages[3],
      section: list.props.sections[1],
    });
    const ccTree = renderer.create(ccRow);
    expect(visibleText(ccTree)).toContain('E1 10 12 00');
    expect(visibleText(ccTree).replace(/\s+/g, ' ')).toContain('144 B NDEF area');
    const userHeader = renderer.create(
      list.props.renderSectionHeader({section: list.props.sections[2]}),
    );
    expect(visibleText(userHeader).replace(/\s+/g, ' ')).toContain(
      'TLV incomplete',
    );
    tree.unmount();
  });
});
