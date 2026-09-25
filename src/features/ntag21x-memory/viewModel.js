import {getNtag21xProfile} from './profiles';
import {decodeCapabilityContainer} from './layout';
import {parseType2Tlvs} from './tlv';

function buildMemoryView(scan) {
  const profile = getNtag21xProfile(scan?.model);
  if (!profile) {
    return null;
  }

  const pages = scan.pages || [];
  const sections = profile.regions.map((region) => ({
    ...region,
    pages: pages.filter(
      (page) => page.address >= region.start && page.address <= region.end,
    ),
  }));
  const cc = decodeCapabilityContainer(pages[3]?.bytes);

  const userBytes = [];
  for (let address = 4; address <= profile.regions[2].end; address++) {
    const page = pages[address];
    if (page?.address !== address || page.status !== 'read') {
      break;
    }
    userBytes.push(...page.bytes);
  }
  const tlvs = parseType2Tlvs(userBytes, {
    isComplete: userBytes.length === profile.userBytes,
  });

  const uid =
    pages[0]?.status === 'read' && pages[1]?.status === 'read'
      ? [...pages[0].bytes.slice(0, 3), ...pages[1].bytes]
          .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
          .join(':')
      : null;

  return {profile, sections, cc, tlvs, uid};
}

export {buildMemoryView};
