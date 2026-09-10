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
