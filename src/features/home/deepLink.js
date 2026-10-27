import qs from 'query-string';
import {getRecordNavigationTarget} from '../records/recordModel';

const APP_SCHEMES = [
  'com.washow.nfcopenrewriter://',
  'com.revteltech.nfcopenrewriter://',
];

function parseShareDeepLink(url) {
  if (typeof url !== 'string') {
    return null;
  }

  const scheme = APP_SCHEMES.find((candidate) => url.startsWith(candidate));
  if (!scheme) {
    return null;
  }

  const pathAndQuery = url.slice(scheme.length);
  const splitIdx = pathAndQuery.indexOf('?');
  const action = splitIdx < 0 ? pathAndQuery : pathAndQuery.slice(0, splitIdx);
  if (action !== 'share') {
    return null;
  }

  const query = splitIdx < 0 ? '' : pathAndQuery.slice(splitIdx);
  const data = qs.parse(query).data;
  if (typeof data !== 'string') {
    return null;
  }

  try {
    const record = JSON.parse(data);
    const target = getRecordNavigationTarget(record);
    return target ? {...target, record} : null;
  } catch (_) {
    return null;
  }
}

export {APP_SCHEMES, parseShareDeepLink};

const PROMOTION_ORIGIN = 'https://revtel.github.io';
const PROMOTION_PATHS = [
  '/react-native-nfc-rewriter/',
  '/react-native-nfc-rewriter/index.html',
  '/react-native-nfc-rewriter/zh-Hant/',
  '/react-native-nfc-rewriter/zh-Hant/index.html',
  '/react-native-nfc-rewriter/ja/',
  '/react-native-nfc-rewriter/ja/index.html',
];

function parseIncomingLink(url) {
  if (typeof url !== 'string') {
    return null;
  }
  // Exact origin/path matching also rejects userinfo, suffix hosts and ports.
  // Queries/fragments do not carry commands and do not change the chosen locale.
  const address = url.split(/[?#]/, 1)[0];
  if (PROMOTION_PATHS.some((path) => address === PROMOTION_ORIGIN + path)) {
    return {name: 'MainTabs', params: {screen: 'HomeTab'}};
  }
  return parseShareDeepLink(url);
}

export {PROMOTION_ORIGIN, PROMOTION_PATHS, parseIncomingLink};
