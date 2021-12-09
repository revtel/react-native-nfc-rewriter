const readSignature = {
  name: 'nxp424-read-sig',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 0],
      },
      {type: 'command', payload: [144, 60, 0, 0, 1, 0, 0]},
    ],
  },
};

const enableTemper = {
  name: 'nxp424-temper-enable',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 1],
      },
      {type: 'command', payload: [144, 92, 0, 0, 3, 7, 1, 14, 0]},
    ],
  },
};

const verifyTemperState = {
  name: 'nxp424-temper-detection',
  payload: {
    tech: 'IsoDep',
    value: [
      {
        type: 'command',
        payload: [0, 164, 4, 0, 7, 210, 118, 0, 0, 133, 1, 1],
      },
      {type: 'command', payload: [144, 247, 0, 0, 0]},
    ],
  },
};

export {readSignature, enableTemper, verifyTemperState};
