function getNdefType(params, {Ndef, NfcTech}) {
  const payload = params.savedRecord?.payload;
  if (payload?.tech === NfcTech.Ndef) {
    if (payload.tnf === Ndef.TNF_WELL_KNOWN) {
      if (payload.rtd === Ndef.RTD_TEXT) {
        return 'TEXT';
      }
      if (payload.rtd === Ndef.RTD_URI) {
        return 'URI';
      }
    }
    if (payload.tnf === Ndef.TNF_MIME_MEDIA) {
      if (payload.mimeType === Ndef.MIME_WFA_WSC) {
        return 'WIFI_SIMPLE';
      }
      if (payload.mimeType === 'text/vcard') {
        return 'VCARD';
      }
    }
  }

  return params.ndefType;
}

function buildNdefRecordPayload(ndefType, value, {Ndef, NfcTech}) {
  const payload = {
    tech: NfcTech.Ndef,
    tnf: Ndef.TNF_WELL_KNOWN,
    value,
  };

  if (ndefType === 'TEXT') {
    return {...payload, rtd: Ndef.RTD_TEXT};
  }
  if (ndefType === 'URI') {
    return {...payload, rtd: Ndef.RTD_URI};
  }
  if (ndefType === 'WIFI_SIMPLE') {
    return {
      ...payload,
      tnf: Ndef.TNF_MIME_MEDIA,
      mimeType: Ndef.MIME_WFA_WSC,
    };
  }
  if (ndefType === 'VCARD') {
    return {
      ...payload,
      tnf: Ndef.TNF_MIME_MEDIA,
      mimeType: 'text/vcard',
    };
  }

  throw new Error(`Unsupported NDEF record type: ${ndefType}`);
}

export {buildNdefRecordPayload, getNdefType};
