import {
  appendRecord,
  getRecordNavigationTarget,
  groupRecordsByTech,
  removeRecord,
  replaceRecord,
} from '../src/features/records/recordModel';

describe('record model', () => {
  const ndef = {name: 'text', payload: {tech: 'Ndef'}};
  const nfcA = {name: 'commands', payload: {tech: 'NfcA'}};

  it('groups known records while retaining their storage indexes', () => {
    const result = groupRecordsByTech([
      ndef,
      {payload: {tech: 'Unknown'}},
      nfcA,
    ]);

    expect(result.ndefRecords).toEqual([{record: ndef, idx: 0}]);
    expect(result.nfcARecords).toEqual([{record: nfcA, idx: 2}]);
    expect(result.nfcVRecords).toEqual([]);
    expect(result.isoDepRecords).toEqual([]);
  });

  it('selects the compatible nested screen for a saved record', () => {
    expect(getRecordNavigationTarget(ndef, 3)).toEqual({
      name: 'Main',
      params: {
        screen: 'NdefWrite',
        params: {savedRecord: ndef, savedRecordIdx: 3},
      },
    });
    expect(getRecordNavigationTarget({payload: {tech: 'Unknown'}})).toBeNull();
  });

  it('updates record lists immutably', () => {
    const records = [ndef, nfcA];
    const replacement = {name: 'replacement'};

    expect(appendRecord(records, replacement)).toEqual([
      ndef,
      nfcA,
      replacement,
    ]);
    expect(replaceRecord(records, 0, replacement)).toEqual([
      replacement,
      nfcA,
    ]);
    expect(removeRecord(records, 1)).toEqual([ndef]);
    expect(records).toEqual([ndef, nfcA]);
  });
});
