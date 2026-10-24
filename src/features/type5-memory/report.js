function createType5Report(result) {
  // JSON cloning gives sharing an independent, plain data snapshot. Select only
  // inspection fields; caller extras must never become saved/executable records.
  const {
    status,
    cancelled,
    platform,
    metadataRead,
    tag,
    systemInfo,
    scope,
    blocks,
    failure,
    cc,
    ndef,
  } = result;
  return JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      kind: 'iso15693-inspection',
      status,
      cancelled,
      platform,
      metadataRead,
      tag,
      systemInfo,
      scope,
      blocks,
      failure,
      cc,
      ndef,
    }),
  );
}

export {createType5Report};
