import {decodeCapabilityContainer} from './layout';

const VERSION_PREFIX = [0x00, 0x04, 0x04, 0x02, 0x01, 0x00];
const PROTOCOL_TYPE = 0x03;
const MAX_READ_PAGE = 0xff;

function makeProfile(model, storageSize, pageCount, userEndPage) {
  return Object.freeze({
    model,
    storageSize,
    pageCount,
    lastPage: pageCount - 1,
    userBytes: (userEndPage - 3) * 4,
    regions: Object.freeze([
      {key: 'manufacturer', title: 'Manufacturer / static lock', start: 0, end: 2},
      {key: 'cc', title: 'Capability Container', start: 3, end: 3},
      {key: 'user', title: 'User memory', start: 4, end: userEndPage},
      {
        key: 'dynamicLock',
        title: 'Dynamic lock',
        start: userEndPage + 1,
        end: userEndPage + 1,
      },
      {
        key: 'configuration',
        title: 'Configuration',
        start: userEndPage + 2,
        end: pageCount - 1,
      },
    ]),
  });
}

const PROFILES = Object.freeze({
  NTAG213: makeProfile('NTAG213', 0x0f, 45, 39),
  NTAG215: makeProfile('NTAG215', 0x11, 135, 129),
  NTAG216: makeProfile('NTAG216', 0x13, 231, 225),
});

const PROFILES_BY_SIZE = Object.freeze(
  Object.fromEntries(
    Object.values(PROFILES).map((profile) => [profile.storageSize, profile]),
  ),
);

function identifyNtag21x(versionBytes) {
  if (
    !Array.isArray(versionBytes) ||
    versionBytes.length !== 8 ||
    !VERSION_PREFIX.every((byte, index) => versionBytes[index] === byte) ||
    versionBytes[7] !== PROTOCOL_TYPE
  ) {
    return null;
  }
  return PROFILES_BY_SIZE[versionBytes[6]] || null;
}

function getNtag21xProfile(model) {
  return PROFILES[model] || null;
}

function getGenericType2Profile(ccBytes) {
  const cc = decodeCapabilityContainer(ccBytes);
  if (cc.status !== 'valid' || cc.dataAreaBytes < 16) {
    return null;
  }

  const lastPage = 3 + cc.dataAreaBytes / 4;
  if (lastPage > MAX_READ_PAGE) {
    return null;
  }

  return {
    model: 'Type 2',
    scope: 'data_area',
    pageCount: lastPage + 1,
    lastPage,
    userBytes: cc.dataAreaBytes,
    regions: [
      {key: 'manufacturer', title: 'Manufacturer / static lock', start: 0, end: 2},
      {key: 'cc', title: 'Capability Container', start: 3, end: 3},
      {key: 'user', title: 'CC-declared data area', start: 4, end: lastPage},
    ],
  };
}

const PREVIEW_PROFILE = Object.freeze({
  model: 'Type 2',
  scope: 'preview',
  pageCount: 4,
  lastPage: 3,
  userBytes: 0,
  regions: Object.freeze([
    {key: 'manufacturer', title: 'Manufacturer / static lock', start: 0, end: 2},
    {key: 'cc', title: 'Capability Container', start: 3, end: 3},
  ]),
});

function getPreviewProfile() {
  return PREVIEW_PROFILE;
}

export {
  getGenericType2Profile,
  getNtag21xProfile,
  getPreviewProfile,
  identifyNtag21x,
};
