jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {createRecordRepository} from '../src/services/records/recordRepository';

describe('record repository', () => {
  function createFakeStorage(initial = []) {
    let data = initial;
    return {
      get: jest.fn(async () => data),
      set: jest.fn(async (next) => {
        data = next;
      }),
    };
  }

  it('loads records without exposing its internal list', async () => {
    const record = {name: 'saved', payload: {tech: 'Ndef'}};
    const repository = createRecordRepository(createFakeStorage([record]));

    const records = await repository.load();
    records.push({name: 'local mutation'});

    expect(repository.getAll()).toEqual([record]);
  });

  it('persists immutable append, update, and remove operations', async () => {
    const first = {name: 'first'};
    const second = {name: 'second'};
    const storage = createFakeStorage([first]);
    const repository = createRecordRepository(storage);
    await repository.load();

    expect(await repository.append(second)).toEqual([first, second]);
    expect(await repository.update(0, {name: 'updated'})).toEqual([
      {name: 'updated'},
      second,
    ]);
    expect(await repository.remove(1)).toEqual([{name: 'updated'}]);
    expect(storage.set).toHaveBeenCalledTimes(3);
  });
});
