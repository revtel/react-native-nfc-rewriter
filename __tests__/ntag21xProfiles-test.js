import {
  getGenericType2Profile,
  getNtag21xProfile,
  getPreviewProfile,
  identifyNtag21x,
} from '../src/features/ntag21x-memory/profiles';

const version = (size) => [0x00, 0x04, 0x04, 0x02, 0x01, 0x00, size, 0x03];

describe('NTAG21x profiles', () => {
  it.each([
    [0x0f, 'NTAG213', 45, 39],
    [0x11, 'NTAG215', 135, 129],
    [0x13, 'NTAG216', 231, 225],
  ])('matches storage size %i to %s', (size, model, pageCount, userEnd) => {
    const profile = identifyNtag21x(version(size));
    expect(profile).toBe(getNtag21xProfile(model));
    expect(profile.pageCount).toBe(pageCount);
    expect(profile.lastPage).toBe(pageCount - 1);
    expect(profile.regions[2].end).toBe(userEnd);
    expect(profile.regions[4].end).toBe(pageCount - 1);
  });

  it('rejects incomplete and unrecognized version responses', () => {
    expect(identifyNtag21x(version(0x0f).slice(0, -1))).toBeNull();
    expect(identifyNtag21x([0x00, 0x05, ...version(0x0f).slice(2)])).toBeNull();
    expect(identifyNtag21x(version(0x10))).toBeNull();
    expect(identifyNtag21x([...version(0x0f).slice(0, 7), 0x00])).toBeNull();
    expect(getNtag21xProfile('NTAG999')).toBeNull();
  });
});

describe('generic Type 2 profile', () => {
  it('derives only the CC-declared data area', () => {
    const profile = getGenericType2Profile([0xe1, 0x10, 0x06, 0x00]);
    expect(profile).toMatchObject({
      model: 'Type 2',
      scope: 'data_area',
      userBytes: 48,
      pageCount: 16,
      lastPage: 15,
    });
    expect(profile.regions.map(({key}) => key)).toEqual([
      'manufacturer',
      'cc',
      'user',
    ]);
  });

  it('does not invent a bound for invalid, too-small, or unaddressable CCs', () => {
    expect(getGenericType2Profile([0, 0x10, 0x06, 0])).toBeNull();
    expect(getGenericType2Profile([0xe1, 0x10, 0x01, 0])).toBeNull();
    expect(getGenericType2Profile([0xe1, 0x10, 0x7f, 0])).toBeNull();
    expect(getPreviewProfile()).toMatchObject({pageCount: 4, scope: 'preview'});
  });
});
