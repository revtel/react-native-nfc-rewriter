import {buildMemoryView} from '../src/features/ntag21x-memory/viewModel';

function makeScan(status = 'complete') {
  const pages = Array.from({length: 45}, (_, address) => ({
    address,
    status: 'read',
    bytes: [0, 0, 0, 0],
  }));
  pages[0].bytes = [0x04, 0xa2, 0xb3, 0x11];
  pages[1].bytes = [0xc4, 0xd5, 0xe6, 0xf7];
  pages[3].bytes = [0xe1, 0x10, 0x12, 0x00];
  pages[4].bytes = [0x03, 0x01, 0xaa, 0xfe];
  return {status, model: 'NTAG213', pages};
}

describe('NTAG21x memory view', () => {
  it('keeps addressable pages and derived interpretations together', () => {
    const view = buildMemoryView(makeScan());
    expect(view.uid).toBe('04:A2:B3:C4:D5:E6:F7');
    expect(view.cc).toMatchObject({status: 'valid', dataAreaBytes: 144});
    expect(view.sections.map(({pages}) => pages.length)).toEqual([3, 1, 36, 1, 4]);
    expect(view.sections[2].pages[0].bytes).toEqual([0x03, 0x01, 0xaa, 0xfe]);
    expect(view.tlvs.entries[0]).toMatchObject({name: 'NDEF Message', page: 4, length: 1});
  });

  it('does not parse across unreadable user pages', () => {
    const scan = makeScan('partial');
    scan.pages[5] = {address: 5, status: 'unreadable', bytes: null};
    const view = buildMemoryView(scan);
    expect(view.tlvs.entries[0]).toMatchObject({name: 'NDEF Message', length: 1});
    expect(view.tlvs.status).toBe('complete');
    expect(view.sections[2].pages[1].status).toBe('unreadable');
  });

  it('does not infer a profile for unsupported results', () => {
    expect(buildMemoryView({status: 'unsupported', model: null, pages: []})).toBeNull();
  });
});
