import {
  getGenericType2Profile,
  getNtag21xProfile,
  getPreviewProfile,
} from './profiles';
import {decodeCapabilityContainer, getPageRegion} from './layout';
import {parseType2Tlvs} from './tlv';

function buildMemoryView(scan) {
  const pages = scan?.pages || [];
  const cc = decodeCapabilityContainer(pages[3]?.bytes);
  const profile =
    getNtag21xProfile(scan?.model) ||
    (scan?.scope === 'data_area'
      ? getGenericType2Profile(pages[3]?.bytes)
      : scan?.scope === 'preview'
      ? getPreviewProfile()
      : null);
  if (!profile) {
    return null;
  }

  const sections = profile.regions.map((region) => ({
    ...region,
    pages: pages.filter(
      (page) => page.address >= region.start && page.address <= region.end,
    ),
  }));
  const rows = [];
  for (let start = 0; start < profile.pageCount; start += 4) {
    const rowPages = Array.from({length: 4}, (_, index) => {
      const address = start + index;
      return address < profile.pageCount ? pages[address] || null : null;
    });
    rows.push({
      start,
      end: Math.min(start + 3, profile.lastPage),
      pages: rowPages,
    });
  }
  const rowSections = [];
  for (const row of rows) {
    const region = getPageRegion(profile, row.start);
    const titles = [
      ...new Set(
        row.pages
          .filter(Boolean)
          .map((page) => getPageRegion(profile, page.address)?.title)
          .filter(Boolean),
      ),
    ];
    const previous = rowSections[rowSections.length - 1];
    if (previous?.key === region.key) {
      previous.rows.push(row);
      previous.end = row.end;
    } else {
      rowSections.push({
        key: region.key,
        title: titles.join(' / '),
        start: row.start,
        end: row.end,
        rows: [row],
      });
    }
  }
  const userRegion = profile.regions.find(({key}) => key === 'user');
  const userBytes = [];
  for (let address = 4; userRegion && address <= userRegion.end; address++) {
    const page = pages[address];
    if (page?.address !== address || page.status !== 'read') {
      break;
    }
    userBytes.push(...page.bytes);
  }
  const tlvs = parseType2Tlvs(userBytes, {
    isComplete: Boolean(userRegion) && userBytes.length === profile.userBytes,
  });

  const uid =
    pages[0]?.status === 'read' && pages[1]?.status === 'read'
      ? [...pages[0].bytes.slice(0, 3), ...pages[1].bytes]
          .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
          .join(':')
      : null;

  return {profile, sections, rows, rowSections, cc, tlvs, uid};
}

export {buildMemoryView};
