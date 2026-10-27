jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {createStorage} from '../src/Utils/Storage';

beforeEach(() => jest.clearAllMocks());

test('only an absent key is a legitimate initial empty library', async () => {
  AsyncStorage.getItem.mockResolvedValue(null);
  await expect(createStorage('recordList').get(true)).resolves.toEqual([]);
});

test.each([
  ['null', 'STORAGE_INVALID_ROOT'],
  ['{}', 'STORAGE_INVALID_ROOT'],
  ['false', 'STORAGE_INVALID_ROOT'],
  ['{broken', 'STORAGE_INVALID_JSON'],
])('persisted %s cannot become an empty library', async (value, code) => {
  AsyncStorage.getItem.mockResolvedValue(value);
  await expect(createStorage('recordList').get(true)).rejects.toMatchObject({code});
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('read failure preserves last trusted cache and does not leak native details', async () => {
  const record = {name: 'PRIVATE-test-marker', payload: {tech: 'Ndef'}};
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const storage = createStorage('recordList');
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([record]));
    await storage.get(true);
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('PRIVATE-test-marker'));
    await expect(storage.get(true)).rejects.toMatchObject({code: 'STORAGE_READ_FAILED', message: 'STORAGE_READ_FAILED'});
    expect(await storage.get()).toEqual([record]);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
});

test('write does not publish a cache or read it back as successful by itself', async () => {
  const storage = createStorage('recordList');
  AsyncStorage.getItem.mockResolvedValueOnce('[{"name":"old"}]');
  await storage.get(true);
  await storage.set([{name: 'new'}]);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('recordList', '[{"name":"new"}]');
  expect(await storage.get()).toEqual([{name: 'old'}]);
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
});

test('native write rejection exposes a bounded code', async () => {
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('SECRET command bytes'));
  await expect(createStorage('recordList').set([])).rejects.toMatchObject({code: 'STORAGE_WRITE_FAILED', message: 'STORAGE_WRITE_FAILED'});
});
