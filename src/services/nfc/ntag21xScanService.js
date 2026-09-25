import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import {identifyNtag21x} from '../../features/ntag21x-memory/profiles';
import {runNfcSession} from './session';

const FAST_READ = 0x3a;
const GET_VERSION = 0x60;
const PAGES_PER_READ = 4;

function isByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function makeUnavailablePages(fromAddress, lastPage, firstStatus) {
  const pages = [];
  for (let address = fromAddress; address <= lastPage; address++) {
    pages.push({
      address,
      status: address === fromAddress ? firstStatus : 'not_scanned',
      bytes: null,
    });
  }
  return pages;
}

function makeResult(profile, verifiedPages, status, failure = null) {
  const pages = [...verifiedPages];
  if (status === 'partial' && pages.length < profile.pageCount) {
    pages.push(
      ...makeUnavailablePages(
        pages.length,
        profile.lastPage,
        failure?.status || 'unreadable',
      ),
    );
  }
  return {
    status,
    model: profile.model,
    pageCount: profile.pageCount,
    readPages: verifiedPages.length,
    pages,
    failure,
  };
}

async function readExactPages(transceive, start, end) {
  const response = await transceive([FAST_READ, start, end]);
  const expectedLength = (end - start + 1) * 4;
  if (
    !Array.isArray(response) ||
    response.length !== expectedLength ||
    !response.every(isByte)
  ) {
    const error = new Error('Unexpected FAST_READ response');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }
  return Array.from({length: end - start + 1}, (_, index) => ({
    address: start + index,
    status: 'read',
    bytes: response.slice(index * 4, index * 4 + 4),
  }));
}

async function scanNtag21x({onProgress} = {}) {
  let activeScan = null;

  try {
    const sessionResult = await runNfcSession({
      technology: [NfcTech.NfcA],
      successMessage: null,
      operation: async () => {
        let versionBytes;
        try {
          versionBytes = await NfcManager.nfcAHandler.transceive([GET_VERSION]);
        } catch (_) {
          return {status: 'unidentified', model: null, pages: []};
        }

        const profile = identifyNtag21x(versionBytes);
        if (!profile) {
          return {status: 'unsupported', model: null, pages: []};
        }

        const verifiedPages = [];
        activeScan = {profile, verifiedPages};
        const progress = () => {
          if (typeof onProgress === 'function') {
            onProgress({
              model: profile.model,
              readPages: verifiedPages.length,
              pageCount: profile.pageCount,
            });
          }
        };
        progress();

        for (let start = 0; start <= profile.lastPage; start += PAGES_PER_READ) {
          const end = Math.min(start + PAGES_PER_READ - 1, profile.lastPage);
          let group;
          try {
            group = await readExactPages(
              (bytes) => NfcManager.nfcAHandler.transceive(bytes),
              start,
              end,
            );
          } catch (_) {
            for (let address = start; address <= end; address++) {
              let page;
              try {
                page = await readExactPages(
                  (bytes) => NfcManager.nfcAHandler.transceive(bytes),
                  address,
                  address,
                );
              } catch (error) {
                return makeResult(profile, verifiedPages, 'partial', {
                  address,
                  status: 'unreadable',
                  cause:
                    error.code === 'INVALID_RESPONSE'
                      ? 'invalid_response'
                      : 'unknown',
                });
              }
              verifiedPages.push(page[0]);
              progress();
            }
            continue;
          }
          verifiedPages.push(...group);
          progress();
        }

        return makeResult(profile, verifiedPages, 'complete');
      },
    });

    if (sessionResult.success) {
      return sessionResult.value;
    }
  } catch (_) {
    // The session may fail after some pages have already been verified.
  }

  if (activeScan) {
    return makeResult(
      activeScan.profile,
      activeScan.verifiedPages,
      'partial',
      {
        address: activeScan.verifiedPages.length,
        status: 'unreadable',
        cause: 'session_error',
      },
    );
  }
  return {status: 'unidentified', model: null, pages: []};
}

export {scanNtag21x};
