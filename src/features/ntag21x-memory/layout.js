function getPageRegion(profile, address) {
  if (!profile || !Number.isInteger(address)) {
    return null;
  }
  return (
    profile.regions.find(
      (region) => address >= region.start && address <= region.end,
    ) || null
  );
}

function getPageLabel(profile, address) {
  const region = getPageRegion(profile, address);
  if (!region) {
    return null;
  }
  if (address === 0) {
    return 'UID / BCC0';
  }
  if (address === 1) {
    return 'UID';
  }
  if (address === 2) {
    return 'BCC1 / internal / static lock';
  }
  if (region.key === 'configuration') {
    return ['CFG0', 'CFG1', 'PWD', 'PACK'][address - region.start];
  }
  return region.title;
}

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function decodeCapabilityContainer(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 4 || !bytes.every(isByte)) {
    return {status: 'unavailable'};
  }

  const [magic, version, size, access] = bytes;
  const readAccess = Math.floor(access / 16);
  const writeAccess = access % 16;
  const errors = [];
  if (magic !== 0xe1) {
    errors.push('Unexpected Type 2 magic byte');
  }
  if (size === 0) {
    errors.push('Zero-sized NDEF data area');
  }
  if (![0, 0x0f].includes(readAccess) || ![0, 0x0f].includes(writeAccess)) {
    errors.push('Reserved access bits');
  }

  return {
    status: errors.length ? 'invalid' : 'valid',
    version: `${Math.floor(version / 16)}.${version % 16}`,
    dataAreaBytes: size * 8,
    readAccess,
    writeAccess,
    errors,
  };
}

function formatPageAddress(address) {
  return address.toString(16).toUpperCase().padStart(2, '0');
}

function formatPageBytes(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 4) {
    return '-- -- -- --';
  }
  return bytes
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export {
  decodeCapabilityContainer,
  formatPageAddress,
  formatPageBytes,
  getPageLabel,
  getPageRegion,
};
