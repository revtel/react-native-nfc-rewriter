function createType4Report(result) {
  const {
    status,
    cancelled,
    platform,
    metadataAcquisition,
    application,
    cc,
    file,
    consistency,
    scope,
    ndef,
    transcript,
    failure,
  } = result;
  return JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      kind: 'type4-ndef-inspection',
      status,
      cancelled,
      platform,
      metadataAcquisition,
      application,
      cc,
      file,
      consistency,
      scope,
      ndef,
      transcript,
      failure,
    }),
  );
}

export {createType4Report};
