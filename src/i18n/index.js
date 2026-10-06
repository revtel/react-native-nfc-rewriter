import i18next from 'i18next';
import {initReactI18next} from 'react-i18next';
import catalog from './catalog.json';

const resources = {};
const sourceKeys = Object.create(null);
for (const language of ['en', 'zh-Hant', 'ja']) {
  resources[language] = {translation: {}};
}
for (const [key, [source, chinese, japanese]] of Object.entries(catalog)) {
  sourceKeys[source] = key;
  resources.en.translation[key] = source;
  resources['zh-Hant'].translation[key] = chinese;
  resources.ja.translation[key] = japanese;
}

const i18n = i18next.createInstance();
i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh-Hant', 'ja'],
  load: 'currentOnly',
  initAsync: false,
  keySeparator: false,
  interpolation: {escapeValue: false},
  returnNull: false,
});

// Static domain labels remain stable. Translate only at their presentation boundary.
function translateText(source, values, language = i18n.language) {
  if (source == null) {
    return source;
  }
  const key =
    sourceKeys[source] ||
    (typeof source === 'string'
      ? sourceKeys[source.trim().replace(/\s+/g, ' ')]
      : null);
  return key ? i18n.t(key, {...values, lng: language}) : source;
}

function sessionTranslator() {
  const language = i18n.language;
  return (source, values) => translateText(source, values, language);
}

export {i18n, resources, translateText, sessionTranslator};
