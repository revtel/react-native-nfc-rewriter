import * as React from 'react';
import NfcProxy from '../../NfcProxy';

function useTagScan(navigation) {
  return React.useCallback(async () => {
    const tag = await NfcProxy.readTag();
    if (tag) {
      navigation.navigate('Main', {screen: 'TagDetail', params: {tag}});
    }
    return tag;
  }, [navigation]);
}

export {useTagScan};
