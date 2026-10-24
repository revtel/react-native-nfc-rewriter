// Exercise the libraries used by the patched standalone bundle, not just the lockfile.
const assert = require('node:assert/strict');
const {Buffer} = require('node:buffer');
const crypto = require('node:crypto');
const {once} = require('node:events');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const patch = require('./react-devtools-standalone-externals.json');

const corePackage = require.resolve('react-devtools-core/package.json');
const file = path.join(path.dirname(corePackage), 'dist', 'standalone.js');
const code = fs.readFileSync(file, 'utf8');
const coreRequire = createRequire(file);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function bundledExport(name) {
  assert.equal(
    hash(code),
    patch.patchedCodeSha256,
    'Run npm ci with install scripts enabled.',
  );
  const entry = patch.modules.find((module) => module.external === name);
  const factory = vm.runInNewContext(
    '(' + code.slice(entry.start, entry.end).trim() + ')',
    {
      require: coreRequire,
    },
  );
  const module = {exports: {}};
  factory(module);
  assert.equal(module.exports, coreRequire(name));
  return module.exports;
}

async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Security check timed out.')),
          3000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const quote = bundledExport('shell-quote');
  assert.throws(
    () => quote.quote(['echo', {comment: 'test'}, 'value\nnot-executed']),
    TypeError,
  );
  assert.deepEqual(quote.parse('code --goto "file with spaces.js:2:3"'), [
    'code',
    '--goto',
    'file with spaces.js:2:3',
  ]);

  const WebSocket = bundledExport('ws');
  const server = new WebSocket.Server({
    host: '127.0.0.1',
    port: 0,
    maxPayload: 1024,
    maxFragments: 4,
  });
  let client;
  try {
    assert.ok(server.options.maxBufferedChunks > 0);
    assert.ok(new WebSocket.Server({noServer: true}).options.maxFragments > 0);
    await bounded(once(server, 'listening'));
    const connected = once(server, 'connection');
    client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    await bounded(once(client, 'open'));
    const [peer] = await bounded(connected);
    peer.on('message', (message) => peer.send(message));
    const echoed = once(client, 'message');
    client.send('devtools-transport-check');
    assert.equal((await bounded(echoed))[0], 'devtools-transport-check');

    const failure = once(peer, 'error');
    const closed = once(client, 'close');
    for (let i = 0; i < 6; i++) client.send('x', {fin: false});
    assert.equal(
      (await bounded(failure))[0].code,
      'WS_ERR_TOO_MANY_BUFFERED_PARTS',
    );
    assert.equal((await bounded(closed))[0], 1008);
  } finally {
    if (client) client.terminate();
    await new Promise((resolve) => server.close(resolve));
  }

  const receiver = new WebSocket.Receiver('nodebuffer', {}, false, 1024, 4, 10);
  const chunksRejected = once(receiver, 'error');
  receiver.write(Buffer.from([0x82, 100]));
  for (let i = 0; i < 6; i++) receiver.write(Buffer.from([0]));
  assert.equal(
    (await bounded(chunksRejected))[0].code,
    'WS_ERR_TOO_MANY_BUFFERED_PARTS',
  );
  console.log(
    'Verified standalone exports, shell quoting, WebSocket echo and bounded fragmentation/chunks.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
