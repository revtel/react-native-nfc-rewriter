import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import {runNfcSession} from './session';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeCommands(commands, transceive, beforeTransceive) {
  const responses = [];
  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const command = commands[cmdIdx];
    const modifiedCommand = beforeTransceive?.({
      cmdIdx,
      commands,
      responses,
    });
    const {type, payload} = modifiedCommand || command;
    let response = null;
    if (type === 'command') {
      response = await transceive(payload);
    } else if (type === 'delay') {
      await delay(payload);
    }
    responses.push(response);
  }
  return responses;
}

async function customTransceive(
  technology,
  handler,
  commands,
  onPostExecute,
  {beforeTransceive} = {},
) {
  const responses = [];
  const result = await runNfcSession({
    technology: [technology],
    operation: async () => {
      responses.push(
        ...(await executeCommands(
          commands,
          (payload) => handler.transceive(payload),
          beforeTransceive,
        )),
      );
      return responses;
    },
  });

  const output = [result.success, responses];
  if (result.success && typeof onPostExecute === 'function') {
    await onPostExecute(output);
  }
  return output;
}

const customTransceiveNfcA = (commands, onPostExecute, options) =>
  customTransceive(
    NfcTech.NfcA,
    NfcManager.nfcAHandler,
    commands,
    onPostExecute,
    options,
  );

const customTransceiveNfcV = (commands, onPostExecute, options) =>
  customTransceive(
    NfcTech.NfcV,
    NfcManager.nfcVHandler,
    commands,
    onPostExecute,
    options,
  );

const customTransceiveIsoDep = (commands, onPostExecute, options) =>
  customTransceive(
    NfcTech.IsoDep,
    NfcManager.isoDepHandler,
    commands,
    onPostExecute,
    options,
  );

async function eraseNfcA({format = false} = {}) {
  const result = await runNfcSession({
    technology: [NfcTech.NfcA],
    successMessage: format ? 'Success' : null,
    operation: async () => {
      const [, , size] = await NfcManager.nfcAHandler.transceive([0x30, 0x03]);
      const blocks = (size * 8) / 4;
      for (let i = 0; i < blocks; i++) {
        await NfcManager.nfcAHandler.transceive([
          0xa2,
          i + 0x04,
          0x0,
          0x0,
          0x0,
          0x0,
        ]);
      }
      if (format) {
        await NfcManager.nfcAHandler.transceive([
          0xa2,
          0x04,
          0x03,
          0x00,
          0xfe,
          0x00,
        ]);
      }
    },
  });
  return format && result.success;
}

export {
  customTransceiveIsoDep,
  customTransceiveNfcA,
  customTransceiveNfcV,
  eraseNfcA,
  executeCommands,
};
