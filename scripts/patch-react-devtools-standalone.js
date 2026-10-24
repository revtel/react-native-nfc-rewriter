// react-devtools-core 6.1.5 embeds dependencies in its Node-only standalone UI.
// Keep its React Native-compatible backend, but use the patched npm packages.
// The pinned source hashes deliberately require review on upstream upgrades.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const patch = require('./react-devtools-standalone-externals.json');

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
const corePackage = require.resolve('react-devtools-core/package.json');
const core = JSON.parse(fs.readFileSync(corePackage, 'utf8'));
const file = path.join(path.dirname(corePackage), 'dist', 'standalone.js');
const coreRequire = createRequire(file);

function atLeast(version, major, minor, patchVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [a, b, c] = match.slice(1).map(Number);
  return a === major && (b > minor || (b === minor && c >= patchVersion));
}

if (core.version !== patch.version) {
  throw new Error(
    'Review the DevTools standalone patch for the new core version.',
  );
}
const ws = coreRequire('ws/package.json');
const shellQuote = coreRequire('shell-quote/package.json');
if (!atLeast(ws.version, 7, 5, 13) || !atLeast(shellQuote.version, 1, 11, 0)) {
  throw new Error(
    'DevTools requires patched ws 7.x and shell-quote 1.x dependencies.',
  );
}

let code = fs.readFileSync(file, 'utf8');
const sourceMapText = fs.readFileSync(file + '.map', 'utf8');
if (
  sha256(code) === patch.patchedCodeSha256 &&
  sha256(sourceMapText) === patch.patchedMapSha256
) {
  console.log('DevTools standalone dependencies already externalized.');
} else {
  if (
    sha256(code) !== patch.codeSha256 ||
    sha256(sourceMapText) !== patch.mapSha256
  ) {
    throw new Error(
      'Unexpected DevTools standalone source; refusing an unchecked patch.',
    );
  }
  // Same-width, single-line replacements preserve other source-map positions.
  for (const module of [...patch.modules].sort((a, b) => b.start - a.start)) {
    const original = code.slice(module.start, module.end);
    const replacement = module.external
      ? `function(module){module.exports=require(${JSON.stringify(
          module.external,
        )})}`
      : 'function(){throw new Error("Unexpected internal DevTools dependency")}';
    if (/[\r\n]/.test(original) || replacement.length > original.length) {
      throw new Error('Invalid DevTools module replacement.');
    }
    code =
      code.slice(0, module.start) +
      replacement.padEnd(original.length, ' ') +
      code.slice(module.end);
  }
  const sourceMap = JSON.parse(sourceMapText);
  for (const index of patch.sourceIndices) {
    // Removed factories no longer have vendored sources. Other mappings stay intact.
    sourceMap.sources[index] = 'external:npm-dependency/' + index;
    sourceMap.sourcesContent[index] = null;
  }
  const mapped = JSON.stringify(sourceMap);
  if (
    sha256(code) !== patch.patchedCodeSha256 ||
    sha256(mapped) !== patch.patchedMapSha256
  ) {
    throw new Error('DevTools patch output did not match its reviewed hashes.');
  }
  fs.writeFileSync(file, code);
  fs.writeFileSync(file + '.map', mapped);
  console.log(
    'Externalized DevTools standalone ws and shell-quote dependencies.',
  );
}
