import * as React from 'react';

// Lock reader work synchronously before React renders.
function useTagActions(navigation) {
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const mounted = React.useRef(true);
  const focused = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    focused.current = navigation.isFocused?.() ?? true;
    const onFocus = navigation.addListener?.('focus', () => {
      focused.current = true;
      setBusy(inFlight.current);
    });
    const onBlur = navigation.addListener?.('blur', () => { focused.current = false; });
    return () => {
      mounted.current = false;
      focused.current = false;
      onFocus?.();
      onBlur?.();
    };
  }, [navigation]);

  const run = React.useCallback(async (action) => {
    if (inFlight.current || !mounted.current || !focused.current) {
      return null;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      inFlight.current = false;
      if (mounted.current && focused.current) {
        setBusy(false);
      }
    }
  }, []);
  return {busy, run};
}

export {useTagActions};
