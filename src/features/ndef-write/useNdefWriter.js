import * as React from 'react';
import NfcProxy from '../../NfcProxy';

function useNdefWriter(type) {
  return React.useCallback(
    async (value) => NfcProxy.writeNdef({type, value}),
    [type],
  );
}

export {useNdefWriter};
