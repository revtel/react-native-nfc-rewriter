import * as React from 'react';
import {SectionList, Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcProxy from '../src/NfcProxy';
import Ntag21xMemoryScanScreen from '../src/Screens/Ntag21xMemoryScan';

jest.mock('../src/NfcProxy', () => ({scanType2Memory: jest.fn()}));
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

describe('Type 2 memory scan screen', () => {
  beforeEach(() => NfcProxy.scanType2Memory.mockReset());

  it('discloses read effects before a scan and shows an unsupported result', async () => {
    NfcProxy.scanType2Memory.mockResolvedValue({
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
    expect(NfcProxy.scanType2Memory).toHaveBeenCalledTimes(1);
    expect(visibleText(tree)).toContain('UNSUPPORTED TAG');
    tree.unmount();
  });

  it('keeps raw pages and marks incomplete interpretations on a partial scan', async () => {
    NfcProxy.scanType2Memory.mockResolvedValue(makePartialScan());
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
    const firstSection = list.props.sections[0];
    expect(firstSection.data[0].pages.map(({address}) => address)).toEqual([
      0, 1, 2, 3,
    ]);
    const ccRow = list.props.renderItem({item: firstSection.data[0]});
    const ccTree = renderer.create(ccRow);
    expect(visibleText(ccTree)).toContain('E1 10 12 00');
    expect(visibleText(ccTree).replace(/\s+/g, ' ')).toContain('144 B NDEF area');
    const userHeader = renderer.create(
      list.props.renderSectionHeader({
        section: list.props.sections.find(({key}) => key === 'user'),
      }),
    );
    expect(visibleText(userHeader).replace(/\s+/g, ' ')).toContain(
      'TLV incomplete',
    );
    tree.unmount();
  });

  it('labels a generic scan as data-area only and leaves final slots empty', async () => {
    const scan = makePartialScan();
    scan.status = 'complete';
    scan.scope = 'data_area';
    scan.model = 'Type 2';
    scan.pages[3].bytes = [0xe1, 0x10, 0x07, 0x00];
    scan.pages = Array.from({length: 18}, (_, address) => ({
      address,
      status: 'read',
      bytes: address === 3 ? scan.pages[3].bytes : [0, 0, 0, 0],
    }));
    scan.pageCount = 18;
    scan.readPages = 18;
    NfcProxy.scanType2Memory.mockResolvedValue(scan);
    let tree;
    await act(async () => {
      tree = renderer.create(<Ntag21xMemoryScanScreen />);
    });
    await act(async () => {
      await tree.root.findByType(Button).props.onPress();
    });
    expect(visibleText(tree)).toContain('DATA AREA COMPLETE');
    expect(visibleText(tree)).toContain('Vendor memory beyond');
    const list = tree.root.findByType(SectionList);
    const lastRow = list.props.sections.at(-1).data.at(-1);
    expect(lastRow.pages.map((page) => page?.address ?? null)).toEqual([
      16,
      17,
      null,
      null,
    ]);
    tree.unmount();
  });

  it('shows a four-page limited preview without claiming total capacity', async () => {
    const scan = makePartialScan();
    scan.status = 'limited';
    scan.scope = 'preview';
    scan.model = 'Type 2';
    scan.pageCount = 4;
    scan.readPages = 4;
    scan.pages = scan.pages.slice(0, 4);
    scan.pages[3].bytes = [0, 0, 0, 0];
    NfcProxy.scanType2Memory.mockResolvedValue(scan);
    let tree;
    await act(async () => {
      tree = renderer.create(<Ntag21xMemoryScanScreen />);
    });
    await act(async () => {
      await tree.root.findByType(Button).props.onPress();
    });
    expect(visibleText(tree)).toContain('LIMITED PREVIEW');
    expect(visibleText(tree)).toContain('Capacity unknown');
    expect(tree.root.findByType(SectionList).props.sections).toHaveLength(1);
    tree.unmount();
  });
});
