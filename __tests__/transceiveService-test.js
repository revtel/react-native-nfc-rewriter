jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {},
  NfcTech: {NfcA: 'NfcA', NfcV: 'NfcV', IsoDep: 'IsoDep'},
}));

jest.mock('../src/services/nfc/session', () => ({
  runNfcSession: jest.fn(),
}));

import {executeCommands} from '../src/services/nfc/transceiveService';

describe('transceive command execution', () => {
  it('applies a preprocessor only to its current invocation', async () => {
    const transceive = jest.fn(async (payload) => [...payload, 0x90]);
    const commands = [
      {type: 'command', payload: [1]},
      {type: 'command', payload: [2]},
    ];

    const first = await executeCommands(commands, transceive, ({cmdIdx}) =>
      cmdIdx === 1 ? {type: 'command', payload: [9]} : null,
    );
    const second = await executeCommands(commands, transceive);

    expect(first).toEqual([[1, 0x90], [9, 0x90]]);
    expect(second).toEqual([[1, 0x90], [2, 0x90]]);
  });
});
