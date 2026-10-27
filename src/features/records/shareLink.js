function createRecordShareLink(record) {
  return `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(
    JSON.stringify(record),
  )}`;
}

function createRecordShareContent(record, platform, title = 'My NFC Record') {
  const url = createRecordShareLink(record);
  return platform === 'android'
    ? {title, message: url}
    : {title, url};
}

export {
  createRecordShareLink,
  createRecordShareContent,
};
