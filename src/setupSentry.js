import * as Sentry from '@sentry/react-native';
import {version, revAppId, revSentryDsn} from '../package.json';

function shouldEnableSentry() {
  return !__DEV__ && revSentryDsn;
}

if (shouldEnableSentry()) {
  Sentry.init({
    dsn: revSentryDsn,
    release: `${revAppId}@${version}`,
    dist: version,
  });
}

function captureException(ex, {section, extra, clear} = {}) {
  if (shouldEnableSentry()) {
    Sentry.captureException(ex, (scope) => {
      if (clear) {
        scope.clear();
      }

      if (section) {
        scope.setTag('section', section);
      }

      if (extra) {
        for (const key in extra) {
          scope.setExtra(key, extra[key]);
        }
      }

      return scope;
    });
  }
}

export {captureException};
