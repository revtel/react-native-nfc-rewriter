import {parseType2Tlvs} from '../src/features/ntag21x-memory/tlv';

describe('Type 2 TLV parsing', () => {
  it('locates a regular NDEF TLV after NULL bytes', () => {
    const result = parseType2Tlvs([0x00, 0x03, 0x03, 0xd1, 0x01, 0x00, 0xfe]);
    expect(result.status).toBe('complete');
    expect(result.entries).toEqual([
      {
        type: 0x03,
        name: 'NDEF Message',
        byteOffset: 17,
        page: 4,
        pageByteOffset: 1,
        length: 3,
        status: 'valid',
      },
      {
        type: 0xfe,
        name: 'Terminator',
        byteOffset: 22,
        page: 5,
        pageByteOffset: 2,
        status: 'valid',
      },
    ]);
  });

  it('reads extended TLV length', () => {
    const result = parseType2Tlvs([0x03, 0xff, 0x00, 0x02, 0xaa, 0xbb, 0xfe]);
    expect(result.entries[0]).toMatchObject({
      name: 'NDEF Message',
      length: 2,
      status: 'valid',
    });
    expect(result.status).toBe('complete');
  });

  it('distinguishes truncated memory from malformed complete memory', () => {
    const bytes = [0x03, 0x05, 0xaa];
    expect(parseType2Tlvs(bytes, {isComplete: false})).toMatchObject({
      status: 'incomplete',
      entries: [{status: 'truncated'}],
    });
    expect(parseType2Tlvs(bytes)).toMatchObject({status: 'malformed'});
    expect(parseType2Tlvs([0xff])).toMatchObject({status: 'malformed'});
    expect(parseType2Tlvs([0x03], {isComplete: false})).toMatchObject({
      status: 'incomplete',
    });
  });

  it('does not infer missing TLVs from an incomplete user area', () => {
    expect(parseType2Tlvs([0x00, 0x00], {isComplete: false})).toEqual({
      status: 'incomplete',
      entries: [],
    });
  });
});
