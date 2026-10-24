import * as React from 'react';
import NfcManager from 'react-native-nfc-manager';
import NfcProxy from '../../NfcProxy';

function useTagExplore(navigation) {
  const [exploring, setExploring] = React.useState(false);
  const state = React.useRef({mounted: true, focused: true, run: 0, inFlight: false});

  const cancel = React.useCallback(() => {
    const current = state.current;
    current.run += 1;
    if (current.inFlight) {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  }, []);

  React.useEffect(() => {
    const current = state.current;
    current.mounted = true;
    current.focused = navigation.isFocused?.() ?? true;
    const onFocus = navigation.addListener?.('focus', () => {
      current.focused = true;
      setExploring(current.inFlight);
    });
    const onBlur = navigation.addListener?.('blur', () => {
      current.focused = false;
      cancel();
    });
    return () => {
      current.mounted = false;
      current.focused = false;
      cancel();
      onFocus?.();
      onBlur?.();
    };
  }, [navigation, cancel]);

  const explore = React.useCallback(async () => {
    const current = state.current;
    if (current.inFlight || !current.mounted || !current.focused) {
      return null;
    }
    const run = ++current.run;
    current.inFlight = true;
    setExploring(true);
    const shouldContinue = () => current.mounted && current.focused && current.run === run;
    try {
      const result = await NfcProxy.exploreTag({shouldContinue});
      if (shouldContinue() && result) {
        navigation.navigate('TagDetail', result);
        return result;
      }
      return null;
    } finally {
      current.inFlight = false;
      if (current.mounted && current.focused) {
        setExploring(false);
      }
    }
  }, [navigation]);

  return {explore, exploring, cancel};
}

export {useTagExplore};
