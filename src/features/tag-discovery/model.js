import {normalizeType5Uid} from '../type5-memory/protocol';

const TECH_ALIASES = {
  mifare: 'NfcA',
  MifareIOS: 'NfcA',
  iso15693: 'NfcV',
  Iso15693IOS: 'NfcV',
  felica: 'NfcF',
  FelicaIOS: 'NfcF',
};

function getObservedTechnologies(tag) {
  const values = [
    ...(Array.isArray(tag?.techTypes) ? tag.techTypes : []),
    ...(Array.isArray(tag?.tech) ? tag.tech : [tag?.tech]),
  ];
  return [
    ...new Set(
      values
        .filter((tech) => typeof tech === 'string' && tech.length > 0)
        .map((tech) => tech.replace(/^android\.nfc\.tech\./, ''))
        .map((tech) => TECH_ALIASES[tech] || tech),
    ),
  ];
}

function createTagDiscovery(tag, platform, ndefAcquisition = null) {
  const technologies = getObservedTechnologies(tag);
  const capabilities = [];
  const tools = [];
  const limitations = platform === 'ios' ? ['ios-detection-allowlists'] : [];
  const has = (technology) => technologies.includes(technology);
  const transportTool = (id, screen, nfcTech) => ({
    id,
    screen,
    params: {nfcTech},
  });

  if (has('NfcA')) {
    capabilities.push('nfc-a');
    if (!has('IsoDep')) {
      tools.push(transportTool('nfc-a-transceive', 'CustomTransceive', 'NfcA'));
      tools.push(transportTool('nfc-a-script', 'NfcScriptEditor', 'NfcA'));
    }
  }
  if (has('IsoDep')) {
    capabilities.push('iso-dep');
    tools.push(
      transportTool('iso-dep-transceive', 'CustomTransceive', 'IsoDep'),
    );
    tools.push(transportTool('iso-dep-script', 'NfcScriptEditor', 'IsoDep'));
    tools.push({id: 'type4-ndef-inspector', screen: 'Type4NdefScan'});
    limitations.push('type4-format-unconfirmed');
  }
  if (has('NfcV')) {
    capabilities.push('iso15693');
    tools.push({id: 'iso15693-inspector', screen: 'Type5MemoryScan'});
    // The existing iOS custom NFC-V adapter is not used by the inspector.
    if (platform === 'android') {
      tools.push(transportTool('nfc-v-transceive', 'CustomTransceive', 'NfcV'));
    }
    if (!(ndefAcquisition?.source === 'type5-raw-read' &&
        ndefAcquisition.evidence?.cc?.status === 'supported' &&
        ['decoded', 'empty'].includes(ndefAcquisition.evidence?.ndef?.status))) {
      limitations.push('type5-format-unconfirmed');
    }
  }
  if (has('NfcF')) {
    capabilities.push('felica');
  }
  if (platform === 'android' && tag?.type === 'NFC Forum Type 2') {
    capabilities.push('type2-memory');
    tools.push({id: 'type2-memory', screen: 'Ntag21xMemoryScan'});
  }

  const type5Uid = has('NfcV') ? normalizeType5Uid(tag?.id, platform) : null;
  const acquired =
    ndefAcquisition?.status === 'available' &&
    Array.isArray(ndefAcquisition.records);
  return {
    source: 'native-discovery',
    platform,
    technologies,
    identifiers: ['id', 'idm']
      .filter(
        (kind) =>
          (kind === 'id' && type5Uid?.uidDisplayBE) ||
          (typeof tag?.[kind] === 'string' && tag[kind].length > 0),
      )
      .map((kind) => ({
        kind,
        value:
          kind === 'id' && type5Uid?.uidDisplayBE
            ? type5Uid.uidDisplayBE
            : tag[kind],
      })),
    ...(type5Uid ? {type5Uid} : {}),
    ...(ndefAcquisition ? {ndefAcquisition} : {}),
    ndef: {
      status:
        acquired || Array.isArray(tag?.ndefMessage) ? 'available' : 'unknown',
      records: acquired
        ? ndefAcquisition.records.slice()
        : Array.isArray(tag?.ndefMessage)
        ? tag.ndefMessage.slice()
        : [],
      ...(acquired ? {source: ndefAcquisition.source} : {}),
    },
    capabilities,
    tools,
    limitations,
  };
}

export {createTagDiscovery, getObservedTechnologies};
