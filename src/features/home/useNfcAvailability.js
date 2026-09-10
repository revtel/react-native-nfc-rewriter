import * as React from 'react';
import {Platform} from 'react-native';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import NfcProxy from '../../NfcProxy';

function useNfcAvailability() {
  const [enabled, setEnabled] = React.useState(null);

  const refresh = React.useCallback(async () => {
    const nextEnabled = await NfcProxy.isEnabled();
    setEnabled(nextEnabled);
    return nextEnabled;
  }, []);

  React.useEffect(() => {
    refresh();
    if (Platform.OS !== 'android') {
      return undefined;
    }

    NfcManager.setEventListener(NfcEvents.StateChanged, ({state} = {}) => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
      if (state === 'off') {
        setEnabled(false);
      } else if (state === 'on') {
        setEnabled(true);
      }
    });

    return () => NfcManager.setEventListener(NfcEvents.StateChanged, null);
  }, [refresh]);

  return {enabled, refresh};
}

export {useNfcAvailability};
