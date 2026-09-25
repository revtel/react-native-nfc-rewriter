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
