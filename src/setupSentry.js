import * as Sentry from '@sentry/react-native';
import {version, revAppId, revSentryDsn} from '../package.json';

if (!__DEV__) {
  Sentry.init({
    dsn: revSentryDsn,
    release: `${revAppId}@${version}`,
    dist: version,
  });
}
