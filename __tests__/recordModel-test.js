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
  const script = {name: 'flow', payload: {kind: 'nfc-script', version: 1, tech: 'IsoDep', steps: []}};

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
    expect(result.scriptRecords).toEqual([]);
  });

  it('selects the compatible workflow screen for a saved record', () => {
    expect(getRecordNavigationTarget(ndef, 3)).toEqual({
      name: 'NdefWrite',
      params: {savedRecord: ndef, savedRecordIdx: 3},
    });
    expect(getRecordNavigationTarget({payload: {tech: 'Unknown'}})).toBeNull();
    expect(getRecordNavigationTarget(script, 4)).toEqual({
      name: 'NfcScriptEditor',
      params: {savedRecord: script, savedRecordIdx: 4},
    });
    expect(groupRecordsByTech([nfcA, script]).scriptRecords).toEqual([{record: script, idx: 1}]);
    expect(groupRecordsByTech([nfcA, script]).isoDepRecords).toEqual([]);
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
