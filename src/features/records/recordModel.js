const RECORD_TECH = {
  NDEF: 'Ndef',
  NFC_A: 'NfcA',
  NFC_V: 'NfcV',
  ISO_DEP: 'IsoDep',
};

const RECORD_GROUPS = [
  {key: 'ndefRecords', tech: RECORD_TECH.NDEF},
  {key: 'nfcARecords', tech: RECORD_TECH.NFC_A},
  {key: 'nfcVRecords', tech: RECORD_TECH.NFC_V},
  {key: 'isoDepRecords', tech: RECORD_TECH.ISO_DEP},
];

function getRecordScreen(record) {
  const tech = record?.payload?.tech;
  if (tech === RECORD_TECH.NDEF) {
    return 'NdefWrite';
  }
  if (
    tech === RECORD_TECH.NFC_A ||
    tech === RECORD_TECH.NFC_V ||
    tech === RECORD_TECH.ISO_DEP
  ) {
    return 'CustomTransceive';
  }
  return null;
}

function getRecordNavigationTarget(record, savedRecordIdx) {
  const screen = getRecordScreen(record);
  if (!screen) {
    return null;
  }

  const params = {savedRecord: record};
  if (typeof savedRecordIdx === 'number') {
    params.savedRecordIdx = savedRecordIdx;
  }

  return {
    name: 'Main',
    params: {screen, params},
  };
}

function groupRecordsByTech(records) {
  const groups = Object.fromEntries(
    RECORD_GROUPS.map(({key}) => [key, []]),
  );

  records.forEach((record, idx) => {
    const group = RECORD_GROUPS.find(
      ({tech}) => tech === record?.payload?.tech,
    );
    if (group) {
      groups[group.key].push({record, idx});
    }
  });

  return groups;
}

function appendRecord(records, record) {
  return [...records, record];
}

function replaceRecord(records, idx, record) {
  return records.map((current, currentIdx) =>
    currentIdx === idx ? record : current,
  );
}

function removeRecord(records, idx) {
  return records.filter((_, currentIdx) => currentIdx !== idx);
}

export {
  RECORD_TECH,
  appendRecord,
  getRecordNavigationTarget,
  getRecordScreen,
  groupRecordsByTech,
  removeRecord,
  replaceRecord,
};
