import {Platform} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {PRIMARY_TABS} from './primaryTabs';

function nativeTabIcon(routeName, platform = Platform.OS) {
  const names = PRIMARY_TABS.find(({name}) => name === routeName)?.icons;
  if (!names) {
    return undefined;
  }

  if (platform === 'android') {
    return {
      type: 'image',
      source: MaterialIcons.getImageSourceSync(names.android, 24, '#000000'),
    };
  }

  return {type: 'sfSymbol', name: names.ios};
}

export {nativeTabIcon};
