import {
  buildNdefRecordPayload,
  getNdefType,
} from '../src/features/ndef-write/recordModel';

const Ndef = {
  TNF_WELL_KNOWN: 1,
  TNF_MIME_MEDIA: 2,
  RTD_TEXT: 'T',
  RTD_URI: 'U',
  MIME_WFA_WSC: 'application/vnd.wfa.wsc',
};
const NfcTech = {Ndef: 'Ndef'};
const dependencies = {Ndef, NfcTech};

describe('NDEF record model', () => {
  it.each([
    ['TEXT', {tnf: Ndef.TNF_WELL_KNOWN, rtd: Ndef.RTD_TEXT}],
    ['URI', {tnf: Ndef.TNF_WELL_KNOWN, rtd: Ndef.RTD_URI}],
    [
      'WIFI_SIMPLE',
      {tnf: Ndef.TNF_MIME_MEDIA, mimeType: Ndef.MIME_WFA_WSC},
    ],
    ['VCARD', {tnf: Ndef.TNF_MIME_MEDIA, mimeType: 'text/vcard'}],
  ])('detects and rebuilds %s records', (type, metadata) => {
    const params = {
      savedRecord: {payload: {tech: NfcTech.Ndef, ...metadata}},
    };

    expect(getNdefType(params, dependencies)).toBe(type);
    expect(buildNdefRecordPayload(type, 'value', dependencies)).toEqual({
      tech: NfcTech.Ndef,
      value: 'value',
      ...metadata,
    });
  });

  it('falls back to the requested type and rejects unknown output types', () => {
    expect(getNdefType({ndefType: 'TEXT'}, dependencies)).toBe('TEXT');
    expect(() =>
      buildNdefRecordPayload('UNKNOWN', null, dependencies),
    ).toThrow('Unsupported NDEF record type');
  });
});
