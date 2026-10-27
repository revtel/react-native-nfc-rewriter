import * as React from 'react';
import {Linking} from 'react-native';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {createIncomingIntentController} from './incomingIntentController';

let runtimeController;
function getRuntimeController() {
  if (!runtimeController) {
    runtimeController = createIncomingIntentController({
      getInitialTag: () => NfcManager.getBackgroundTag(),
      clearInitialTag: () => NfcManager.clearBackgroundTag(),
      getInitialURL: () => Linking.getInitialURL(),
      subscribeTag(callback) {
        NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, callback);
        return () =>
          NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, null);
      },
      subscribeURL(callback) {
        const subscription = Linking.addEventListener('url', (event) =>
          callback(event.url),
        );
        return () => subscription.remove();
      },
      onError: (error) =>
        console.warn('Incoming NFC/link delivery failed', error),
    });
  }
  return runtimeController;
}

function isIncomingNavigationReady(navigation) {
  if (!navigation.isReady()) {
    return false;
  }
  const state = navigation.getRootState();
  // Landing resets this root only after storage and NFC initialization finish.
  return !!state?.routes?.some((route) => route.name === 'MainTabs');
}

function useIncomingIntentNavigation(navigation) {
  const owner = React.useRef(null);
  React.useEffect(() => {
    const attachment = getRuntimeController().attach((name, params) =>
      navigation.navigate(name, params),
    );
    owner.current = attachment;
    attachment.setReady(isIncomingNavigationReady(navigation));
    return () => {
      attachment.dispose();
      if (owner.current === attachment) owner.current = null;
    };
  }, [navigation]);
  return React.useCallback(() => {
    owner.current?.setReady(isIncomingNavigationReady(navigation));
  }, [navigation]);
}

export {useIncomingIntentNavigation, isIncomingNavigationReady};
