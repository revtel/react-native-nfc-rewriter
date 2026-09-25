import {getNtag21xProfile} from '../src/features/ntag21x-memory/profiles';
import {
  decodeCapabilityContainer,
  formatPageAddress,
  formatPageBytes,
  getPageLabel,
  getPageRegion,
} from '../src/features/ntag21x-memory/layout';

describe('NTAG21x memory layout', () => {
  it.each([
    ['NTAG213', 39, 40, 41, 44],
    ['NTAG215', 129, 130, 131, 134],
    ['NTAG216', 225, 226, 227, 230],
  ])('labels the boundaries of %s', (model, userEnd, lock, config, last) => {
    const profile = getNtag21xProfile(model);
    expect(getPageRegion(profile, 2).key).toBe('manufacturer');
    expect(getPageRegion(profile, 3).key).toBe('cc');
    expect(getPageRegion(profile, 4).key).toBe('user');
    expect(getPageRegion(profile, userEnd).key).toBe('user');
    expect(getPageRegion(profile, lock).key).toBe('dynamicLock');
    expect(getPageRegion(profile, config).key).toBe('configuration');
    expect(getPageRegion(profile, last + 1)).toBeNull();
    expect(getPageLabel(profile, config + 2)).toBe('PWD');
    expect(getPageLabel(profile, last)).toBe('PACK');
  });

  it('decodes the CC without hiding the physical page bytes', () => {
    expect(decodeCapabilityContainer([0xe1, 0x10, 0x12, 0x00])).toEqual({
      status: 'valid',
      version: '1.0',
      dataAreaBytes: 144,
      readAccess: 0,
      writeAccess: 0,
      errors: [],
    });
    expect(formatPageAddress(0x2c)).toBe('2C');
    expect(formatPageBytes([0xe1, 0x10, 0x12, 0])).toBe('E1 10 12 00');
  });

  it('reports missing and invalid capability containers', () => {
    expect(decodeCapabilityContainer(null).status).toBe('unavailable');
    expect(decodeCapabilityContainer([0xe1, 0x10, 0x12]).status).toBe('unavailable');
    expect(decodeCapabilityContainer([0, 0x10, 0, 0x22])).toMatchObject({
      status: 'invalid',
      errors: expect.arrayContaining(['Unexpected Type 2 magic byte']),
    });
  });
});
