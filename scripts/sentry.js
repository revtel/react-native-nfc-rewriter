const execa = require('execa');
const ora = require('ora');
const {version, revAppId} = require('../package.json');

require('dotenv').config();

// initial CLI configuration, such as how to obtain auth token:
//    https://docs.sentry.io/product/cli/configuration/
// RN specific stuff, how to bundle and upload source map:
//    https://docs.sentry.io/platforms/react-native/manual-setup/sourcemaps/

async function main() {
  const platform = process.env.REV_PLATFORM;
  const spinner = ora('processing...');
  const releaseName = `${revAppId}@${version}`;
  let resp;

  console.log(`[${releaseName}]\n`);

  if (platform === 'ios') {
    console.log('[command req] bundling ios');
    try {
      spinner.start();
      resp = await execa.command(
        'react-native bundle \
        --dev false \
        --platform ios \
        --entry-file index.js \
        --bundle-output main.jsbundle \
        --sourcemap-output main.jsbundle.map',
      );
      console.log('\n[command resp]\n' + resp.stdout);

      console.log('[command req] upload sourcemap');
      spinner.start();
      // TODO: not sure how to pass --dist
      resp = await execa.command(
        `node_modules/@sentry/cli/bin/sentry-cli --auth-token ${
          process.env.SENTRY_TOKEN
        } releases -o ${process.env.SENTRY_ORG} -p ${
          process.env.SENTRY_PROJECT
        }\
        files ${releaseName} \
        upload-sourcemaps \
        --dist ${version} \
        --strip-prefix ${process.cwd()}\
        --rewrite main.jsbundle main.jsbundle.map`,
      );
      console.log('\n[command resp]\n' + resp.stdout);
    } catch (ex) {
      console.warn(ex);
    } finally {
      spinner.stop();
    }
  }
}

main();
