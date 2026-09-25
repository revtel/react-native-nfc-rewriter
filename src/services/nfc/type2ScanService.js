import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import {
  getGenericType2Profile,
  getPreviewProfile,
  identifyNtag21x,
} from '../../features/ntag21x-memory/profiles';
import {decodeCapabilityContainer} from '../../features/ntag21x-memory/layout';
import {runNfcSession} from './session';

const READ = 0x30;
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
    scope: profile.scope || 'full',
    model: profile.model,
    pageCount: profile.pageCount,
    readPages: verifiedPages.length,
    pages,
    failure,
  };
}

function parsePages(response, start, end) {
  if (
    !Array.isArray(response) ||
    response.length !== (end - start + 1) * 4 ||
    !response.every(isByte)
  ) {
    const error = new Error('Unexpected read response');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }
  return Array.from({length: end - start + 1}, (_, index) => ({
    address: start + index,
    status: 'read',
    bytes: response.slice(index * 4, index * 4 + 4),
  }));
}

async function readFourPages(start) {
  const response = await NfcManager.nfcAHandler.transceive([READ, start]);
  return parsePages(response, start, start + PAGES_PER_READ - 1);
}

async function readExactPages(start, end) {
  const response = await NfcManager.nfcAHandler.transceive([
    FAST_READ,
    start,
    end,
  ]);
  return parsePages(response, start, end);
}

function failureAt(address, error) {
  return {
    address,
    status: 'unreadable',
    cause: error?.code === 'INVALID_RESPONSE' ? 'invalid_response' : 'unknown',
  };
}

async function scanType2Memory({onProgress} = {}) {
  let activeScan = null;

  try {
    const sessionResult = await runNfcSession({
      technology: [NfcTech.NfcA],
      successMessage: null,
      operation: async () => {
        let firstPages;
        try {
          firstPages = await readFourPages(0);
        } catch (_) {
          return {status: 'unidentified', model: null, pages: []};
        }

        let versionBytes;
        try {
          versionBytes = await NfcManager.nfcAHandler.transceive([GET_VERSION]);
        } catch (_) {
          // GET_VERSION is optional for generic Type 2-compatible products.
        }

        const ntagProfile = identifyNtag21x(versionBytes);
        const profile =
          ntagProfile || getGenericType2Profile(firstPages[3].bytes);
        if (!profile) {
          const cc = decodeCapabilityContainer(firstPages[3].bytes);
          return {
            ...makeResult(getPreviewProfile(), firstPages, 'limited'),
            limitReason:
              cc.status === 'valid' ? 'unaddressable_cc' : 'invalid_cc',
          };
        }

        const verifiedPages = [...firstPages];
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

        if (ntagProfile) {
          for (let start = 4; start <= profile.lastPage; start += PAGES_PER_READ) {
            const end = Math.min(start + PAGES_PER_READ - 1, profile.lastPage);
            let group;
            try {
              group = await readExactPages(start, end);
            } catch (_) {
              for (let address = start; address <= end; address++) {
                let page;
                try {
                  page = await readExactPages(address, address);
                } catch (error) {
                  return makeResult(
                    profile,
                    verifiedPages,
                    'partial',
                    failureAt(address, error),
                  );
                }
                verifiedPages.push(page[0]);
                progress();
              }
              continue;
            }
            verifiedPages.push(...group);
            progress();
          }
        } else {
          for (let nextPage = 4; nextPage <= profile.lastPage; ) {
            const start = Math.min(nextPage, profile.lastPage - 3);
            let group;
            try {
              group = await readFourPages(start);
              for (const page of group) {
                if (
                  page.address < nextPage &&
                  page.bytes.some(
                    (byte, index) =>
                      byte !== verifiedPages[page.address].bytes[index],
                  )
                ) {
                  const error = new Error('Overlapping READ bytes changed');
                  error.code = 'INVALID_RESPONSE';
                  throw error;
                }
              }
            } catch (error) {
              return makeResult(
                profile,
                verifiedPages,
                'partial',
                failureAt(nextPage, error),
              );
            }
            const newPages = group.filter((page) => page.address >= nextPage);
            verifiedPages.push(...newPages);
            nextPage += newPages.length;
            progress();
          }
        }

        return makeResult(profile, verifiedPages, 'complete');
      },
    });

    if (sessionResult.success) {
      return sessionResult.value;
    }
  } catch (_) {
    // A session can fail after some pages were already verified.
  }

  if (activeScan) {
    return makeResult(activeScan.profile, activeScan.verifiedPages, 'partial', {
      address: activeScan.verifiedPages.length,
      status: 'unreadable',
      cause: 'session_error',
    });
  }
  return {status: 'unidentified', model: null, pages: []};
}

export {scanType2Memory};
