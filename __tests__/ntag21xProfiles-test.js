import {
  getNtag21xProfile,
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
