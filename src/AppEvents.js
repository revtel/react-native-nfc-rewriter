import AppEventRegistry from './AppEventRegistry';

const AppEventName = {
  NFC_SCAN_UI: 'NFC_SCAN_UI',
  LOG_RECORD: 'LOG_RECORD',
};

const AppEvents = new AppEventRegistry(
  Object.keys(AppEventName).map(key => AppEventName[key]),
);

export {AppEventName, AppEvents};
