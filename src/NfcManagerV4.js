import NativeNfcManager from '../specs/NativeNfcManager';

function callNative(name, params = []) {
  const nativeMethod = NativeNfcManager[name];

  if (!nativeMethod) {
    throw new Error(`no such native method: "${name}"`);
  }

  if (!Array.isArray(params)) {
    throw new Error('params must be an array');
  }

  const createCallback = (resolve, reject) => (err, result) => {
    if (err) {
      reject(err);
    } else {
      resolve(result);
    }
  };

  return new Promise((resolve, reject) => {
    const callback = createCallback(resolve, reject);
    const inputParams = [...params, callback];
    nativeMethod(...inputParams);
  });
}

const NfcManagerV4 = {
  echo: (msg) => {
    return callNative('echo', [msg]);
  },
};

export default NfcManagerV4;
