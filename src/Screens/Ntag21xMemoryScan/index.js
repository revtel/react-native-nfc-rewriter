import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Button} from 'react-native-paper';
import NfcProxy from '../../NfcProxy';
import {
  formatPageAddress,
  formatPageBytes,
  getPageLabel,
} from '../../features/ntag21x-memory/layout';
import {buildMemoryView} from '../../features/ntag21x-memory/viewModel';

function accessLabel(value) {
  if (value === 0) {
    return 'free';
  }
  if (value === 15) {
    return 'prohibited';
  }
  return `reserved (${value.toString(16).toUpperCase()})`;
}

function PageRow({page, profile, regionTitle, view}) {
  const label = getPageLabel(profile, page.address);
  const isSecretPage = label === 'PWD' || label === 'PACK';
  const tlvs = view.tlvs.entries.filter(
    (entry) => entry.page === page.address && entry.type !== 0xfe,
  );
  return (
    <View style={styles.pageRow}>
      <Text style={styles.pageAddress}>{formatPageAddress(page.address)}</Text>
      <View style={styles.pageContent}>
        <Text style={styles.hexText}>{formatPageBytes(page.bytes)}</Text>
        {label !== regionTitle && <Text style={styles.pageLabel}>{label}</Text>}
        {page.address === 3 && view.cc.status === 'valid' && (
          <Text style={styles.pageLabel}>
            Type 2 v{view.cc.version} · {view.cc.dataAreaBytes} B NDEF area ·
            Read {accessLabel(view.cc.readAccess)} · Write{' '}
            {accessLabel(view.cc.writeAccess)}
          </Text>
        )}
        {page.address === 3 && view.cc.status !== 'valid' && (
          <Text style={styles.pageStatus}>
            {view.cc.status === 'unavailable'
              ? 'CC unavailable; meaning unknown.'
              : `CC invalid: ${view.cc.errors.join(', ')}`}
          </Text>
        )}
        {tlvs.map((entry, index) => (
          <Text key={`${entry.byteOffset}-${index}`} style={styles.pageLabel}>
            {entry.name} @ +{entry.pageByteOffset}
            {typeof entry.length === 'number' ? ` · ${entry.length} B` : ''}
            {entry.status !== 'valid' ? ` · ${entry.status}` : ''}
          </Text>
        ))}
        {page.status !== 'read' && (
          <Text style={styles.pageStatus}>
            {page.status === 'unreadable' ? 'Unreadable' : 'Not scanned'}
          </Text>
        )}
        {isSecretPage && page.status === 'read' && (
          <Text style={styles.pageStatus}>
            Readback does not reveal stored secret bytes.
          </Text>
        )}
      </View>
    </View>
  );
}

function ScanSummary({scan, view}) {
  if (!scan) {
    return null;
  }
  if (!view) {
    return (
      <View style={styles.card}>
        <Text style={styles.statusTitle}>
          {scan.status === 'unsupported' ? 'UNSUPPORTED TAG' : 'TAG NOT IDENTIFIED'}
        </Text>
        <Text style={styles.bodyText}>
          This scan supports NTAG213, NTAG215, and NTAG216. No memory size was
          inferred.
        </Text>
      </View>
    );
  }

  const failureAddress = scan.failure?.address;
  return (
    <View style={styles.card}>
      <Text style={styles.statusTitle}>
        {view.profile.model}  ·  {scan.status.toUpperCase()}
      </Text>
      <Text style={styles.bodyText}>
        {scan.readPages} / {scan.pageCount} pages read · {view.profile.pageCount * 4} bytes total
      </Text>
      {view.uid && <Text style={styles.bodyText}>UID  {view.uid}</Text>}
      {scan.status === 'partial' && (
        <Text style={styles.warningText}>
          {typeof failureAddress === 'number'
            ? `Page ${formatPageAddress(failureAddress)} unreadable. `
            : 'Scan interrupted. '}
          {scan.failure?.cause === 'invalid_response'
            ? 'Unexpected response length.'
            : scan.failure?.cause === 'session_error'
            ? 'NFC session ended.'
            : 'Cause unknown.'}{' '}
          Later pages were not scanned.
        </Text>
      )}
    </View>
  );
}

function Ntag21xMemoryScanScreen() {
  const [scan, setScan] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [expanded, setExpanded] = React.useState({
    manufacturer: true,
    cc: true,
    user: true,
    dynamicLock: false,
    configuration: false,
  });
  const mounted = React.useRef(true);

  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function startScan() {
    if (scanning) {
      return;
    }
    setScan(null);
    setProgress(null);
    setScanning(true);
    let result;
    try {
      result = await NfcProxy.scanNtag21x({
        onProgress: (update) => {
          if (mounted.current) {
            setProgress(update);
          }
        },
      });
    } catch (_) {
      result = {status: 'unidentified', model: null, pages: []};
    }
    if (mounted.current) {
      setScan(result);
      setScanning(false);
    }
  }

  const view = React.useMemo(() => buildMemoryView(scan), [scan]);
  const sections = view
    ? view.sections.map((region) => ({
        ...region,
        data: expanded[region.key] ? region.pages : [],
      }))
    : [];

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      sections={sections}
      keyExtractor={(page) => `${page.address}`}
      ListHeaderComponent={
        <>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              Inspect NTAG213, NTAG215, or NTAG216 memory page by page.
            </Text>
            <Text style={styles.noteText}>
              This scan sends no write or authentication commands. An enabled NFC
              counter may advance during reading.
            </Text>
            <Button mode="contained" disabled={scanning} onPress={startScan}>
              {scan ? 'SCAN AGAIN' : 'SCAN TAG'}
            </Button>
            {scanning && (
              <View style={styles.progressRow}>
                <ActivityIndicator />
                <Text style={styles.bodyText}>
                  {progress
                    ? `${progress.model}: ${progress.readPages} / ${progress.pageCount} pages`
                    : 'Identifying tag...'}
                </Text>
              </View>
            )}
          </View>
          <ScanSummary scan={scan} view={view} />
          {view && <Text style={styles.mapTitle}>MEMORY LAYOUT</Text>}
        </>
      }
      renderSectionHeader={({section}) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${section.title}, pages ${formatPageAddress(
            section.start,
          )} to ${formatPageAddress(section.end)}`}
          onPress={() =>
            setExpanded((current) => ({
              ...current,
              [section.key]: !current[section.key],
            }))
          }
          style={styles.regionHeader}>
          <View style={styles.regionText}>
            <Text style={styles.regionTitle}>
              {expanded[section.key] ? '▾' : '▸'} {section.title}
            </Text>
            {section.key === 'user' && view.tlvs.status !== 'complete' && (
              <Text style={styles.pageStatus}>
                TLV {view.tlvs.status}:{' '}
                {view.tlvs.error || 'later bytes unavailable'}
              </Text>
            )}
          </View>
          <Text style={styles.regionRange}>
            {formatPageAddress(section.start)}–{formatPageAddress(section.end)}
          </Text>
        </TouchableOpacity>
      )}
      renderItem={({item, section}) => (
        <PageRow
          page={item}
          profile={view.profile}
          regionTitle={section.title}
          view={view}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f5f7'},
  content: {padding: 12, paddingBottom: 28},
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  bodyText: {fontSize: 14, color: '#263238', lineHeight: 21, marginBottom: 4},
  noteText: {fontSize: 13, color: '#5d6870', lineHeight: 19, marginVertical: 12},
  warningText: {fontSize: 13, color: '#955300', lineHeight: 19, marginTop: 5},
  statusTitle: {fontSize: 18, fontWeight: '700', color: '#263238', marginBottom: 6},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12},
  mapTitle: {fontSize: 14, fontWeight: '700', color: '#52616b', margin: 8},
  regionHeader: {
    backgroundColor: '#e7edf2',
    padding: 12,
    marginTop: 8,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regionText: {flex: 1},
  regionTitle: {fontSize: 14, fontWeight: '700', color: '#263238'},
  regionRange: {fontSize: 12, color: '#52616b'},
  pageRow: {
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d3dbe0',
    flexDirection: 'row',
    padding: 10,
  },
  pageAddress: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#3985cb',
    width: 36,
  },
  pageContent: {flex: 1},
  hexText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: '#263238',
  },
  pageLabel: {fontSize: 12, color: '#52616b', marginTop: 3},
  pageStatus: {fontSize: 12, color: '#955300', marginTop: 3},
});

export default Ntag21xMemoryScanScreen;
