function actionNotice(title) {
  if (title === 'Erase' || title === 'NDEF Format') {
    return 'ERASES DATA';
  }
  if (title === 'Make Read Only') {
    return 'PERMANENT CHANGE';
  }
  if (title.includes('Enable password')) {
    return 'CHANGES TAG';
  }
  return null;
}

export {actionNotice};
