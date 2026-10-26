import {
  executeScript,
  normalizeResponse,
} from '../src/features/nfc-script/interpreter';
import {newScript} from '../src/features/nfc-script/model';

test('captures dynamic NFC-A page and resolves a later command', async () => {
  const sent = [];
  const script = {
    ...newScript(),
    steps: [
      {type: 'transceive', template: '30 04'},
      {
        type: 'capture',
        name: 'startPage',
        source: 'data',
        offset: 2,
        format: 'u8',
      },
      {type: 'transceive', template: '30 ${startPage:u8}'},
    ],
  };
  const result = await executeScript(script, {
    transceive: async (bytes) => {
      sent.push(bytes);
      return sent.length === 1 ? [0, 0, 0x28, 0] : [1, 2, 3, 4];
    },
  });
  expect(result.success).toBe(true);
  expect(sent).toEqual([
    [0x30, 4],
    [0x30, 0x28],
  ]);
  expect(result.variables.startPage).toBe(0x28);
  expect(result.trace[2].command).toEqual([0x30, 0x28]);
});

describe('response assertion execution', () => {
  const check = (fields = {}) => ({type: 'assert-response', source: 'data', length: 0, ...fields});
  const read = {type: 'transceive', template: '90 60 00 00 00'};
  const later = {type: 'transceive', template: '90 CA 00 00 00'};
  const script = (steps, tech = 'IsoDep') => ({...newScript(tech), steps});

  test.each([
    {raw: [1, 2, 0x91, 0], check: check({length: 1, expectedHex: '01'}), failure: 'length'},
    {raw: [0x04, 0x40, 0x29, 0x6a, 0x5d, 0x6b, 0x81, 0x91, 0],
      check: check({length: 7, expectedHex: '04 40 29 6A 5D 6B 80', expectedSw: '9100'}), failure: 'bytes'},
    {raw: [0x6a, 0x82], check: check({expectedHex: '', expectedSw: '9100'}), failure: 'status'},
  ])('stops before a later mocked write on $failure mismatch', async ({raw, check: guard, failure}) => {
    const send = jest.fn().mockResolvedValue(raw);
    const result = await executeScript(script([read, guard, later]), {transceive: send});
    expect(result.success).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0].response.raw).toEqual(raw);
    expect(result.trace[1].assertion.failure).toBe(failure);
    expect(result.trace[1].error).toBeTruthy();
    expect(result.error).toBe(`1: ${result.trace[1].error}`);
  });

  test('passing assertions preserve variables and latest response for capture/branch', async () => {
    const send = jest.fn().mockResolvedValue([0x04, 0x91, 0]);
    const result = await executeScript(script([
      {type: 'set', name: '__response', expression: '9'}, read,
      check({length: 1, expectedHex: '04', expectedSw: '9100'}),
      {type: 'capture', name: 'value', source: 'data', offset: 0, format: 'u8'},
      {type: 'if', left: 'sw', operator: '==', right: '0x9100', then: [check({source: 'raw', length: 3})], else: []},
    ]), {transceive: send});
    expect(result.success).toBe(true);
    expect(result.variables).toEqual({__response: 9, sw: 0x9100, value: 4});
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.trace[2].assertion.passed).toBe(true);
    expect(result.trace[5]).toMatchObject({location: '4/then/0', type: 'assert-response', assertion: {passed: true}});
  });

  test('empty data passes and consumes one step without invoking transport or delay', async () => {
    const send = jest.fn().mockResolvedValue([0x91, 0]);
    const delay = jest.fn();
    const result = await executeScript(script([read, check({expectedHex: '', expectedSw: '9100'}), later]), {transceive: send, delay, maxSteps: 2});
    expect(result.trace[1].assertion.passed).toBe(true);
    expect(result.trace[2].error).toBe('Execution exceeded 2 steps');
    expect(send).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  test('repeated assertions use the latest exchange in each iteration', async () => {
    const send = jest.fn().mockResolvedValueOnce([4]).mockResolvedValueOnce([5]);
    const result = await executeScript(script([{
      type: 'repeat', count: '3', maxIterations: 3,
      steps: [read, check({length: 1, expectedHex: '04'})],
    }, later], 'NfcA'), {transceive: send});
    expect(result.success).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.trace[result.trace.length - 1]).toMatchObject({location: '0/repeat:1/1', assertion: {actualHex: '05', failure: 'bytes'}});
    expect(result.variables.index).toBeUndefined();
  });

  test('full prevalidation prevents even an earlier command on invalid unreachable assertions', async () => {
    const send = jest.fn();
    const result = await executeScript(script([read, {type: 'if', left: '0', operator: '==', right: '1', then: [check({expectedSw: null})], else: []}]), {transceive: send});
    expect(result.success).toBe(false);
    expect(result.trace).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  test('preview truncation never truncates the preceding transport evidence', async () => {
    const raw = [...Array(4096).fill(0xaa), 0xbb, 0x91, 0];
    const result = await executeScript(script([read, check({length: 4096}), later]), {transceive: async () => raw});
    expect(result.trace[1].assertion).toMatchObject({actualLength: 4097, actualHexTruncated: true, passed: false});
    expect(result.trace[0].response.raw).toEqual(raw);
    expect(result.trace[0].response.data).toHaveLength(4097);
  });
});

test('repeats a response-derived count with scoped index', async () => {
  const sent = [];
  const script = {
    ...newScript(),
    steps: [
      {type: 'set', name: 'base', expression: '0x10'},
      {type: 'set', name: 'count', expression: '3'},
      {
        type: 'repeat',
        count: 'count',
        maxIterations: 4,
        steps: [{type: 'transceive', template: '30 ${base + index * 4:u8}'}],
      },
    ],
  };
  const result = await executeScript(script, {
    transceive: async (bytes) => {
      sent.push(bytes);
      return [];
    },
  });
  expect(result.success).toBe(true);
  expect(sent).toEqual([
    [0x30, 0x10],
    [0x30, 0x14],
    [0x30, 0x18],
  ]);
  expect(result.variables.index).toBeUndefined();
});

test('branches on ISO-DEP status and preserves response data separately', async () => {
  const script = {
    ...newScript('IsoDep'),
    steps: [
      {type: 'transceive', template: '00 A4 04 00'},
      {
        type: 'if',
        left: 'sw',
        operator: '==',
        right: '0x9000',
        then: [
          {
            type: 'capture',
            name: 'fileId',
            source: 'data',
            offset: 0,
            format: 'u16be',
          },
        ],
        else: [{type: 'stop', outcome: 'failure', message: 'SELECT failed'}],
      },
    ],
  };
  const result = await executeScript(script, {
    transceive: async () => [0x12, 0x34, 0x90, 0x00],
  });
  expect(result.success).toBe(true);
  expect(result.variables).toMatchObject({sw: 0x9000, fileId: 0x1234});
  expect(result.trace[0].response).toEqual({
    raw: [0x12, 0x34, 0x90, 0],
    data: [0x12, 0x34],
    sw: 0x9000,
  });
  expect(result.trace[1].branch).toBe('then');
  expect(normalizeResponse('NfcA', [0x0a]).sw).toBeUndefined();
});

test('does not send on malformed script or excessive repeat', async () => {
  const send = jest.fn(async () => []);
  expect(
    (await executeScript({...newScript(), version: 2}, {transceive: send}))
      .success,
  ).toBe(false);
  const result = await executeScript(
    {
      ...newScript(),
      steps: [
        {
          type: 'repeat',
          count: '5',
          maxIterations: 2,
          steps: [{type: 'transceive', template: '30 04'}],
        },
      ],
    },
    {transceive: send},
  );
  expect(result.success).toBe(false);
  expect(result.trace[0].error).toContain('exceeds maximum');
  expect(send).not.toHaveBeenCalled();
});

test('returns partial trace and stops on transport error', async () => {
  const send = jest
    .fn()
    .mockResolvedValueOnce([1])
    .mockRejectedValueOnce(new Error('tag lost'));
  const script = {
    ...newScript(),
    steps: [
      {type: 'transceive', template: '30 04'},
      {type: 'transceive', template: '30 08'},
      {type: 'transceive', template: '30 0C'},
    ],
  };
  const result = await executeScript(script, {transceive: send});
  expect(result.success).toBe(false);
  expect(result.trace).toHaveLength(2);
  expect(result.trace[1].error).toBe('tag lost');
  expect(send).toHaveBeenCalledTimes(2);
});
