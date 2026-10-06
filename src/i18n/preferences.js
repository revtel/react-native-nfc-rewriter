const LANGUAGE_KEY = '@nfc-rewriter/language';
const LANGUAGE_MODES = ['system', 'zh-Hant', 'en', 'ja'];

function normalizeMode(mode) {
  return LANGUAGE_MODES.includes(mode) ? mode : 'system';
}

function resolveLanguage(mode, locales = []) {
  if (normalizeMode(mode) !== 'system') {
    return mode;
  }
  for (const locale of locales) {
    const tag =
      typeof locale === 'string'
        ? locale
        : locale?.languageTag || locale?.languageCode;
    const language = tag?.toLowerCase().split(/[-_]/)[0];
    if (language === 'zh') {
      return 'zh-Hant';
    }
    if (language === 'en' || language === 'ja') {
      return language;
    }
  }
  return 'en';
}

function createPreferences(storage) {
  let pending = Promise.resolve();
  return {
    async load() {
      try {
        return normalizeMode(await storage.getItem(LANGUAGE_KEY));
      } catch (_) {
        return 'system';
      }
    },
    save(mode) {
      const write = pending.then(() =>
        storage.setItem(LANGUAGE_KEY, normalizeMode(mode)),
      );
      pending = write.catch(() => {});
      return write;
    },
  };
}

export {
  LANGUAGE_KEY,
  LANGUAGE_MODES,
  normalizeMode,
  resolveLanguage,
  createPreferences,
};
