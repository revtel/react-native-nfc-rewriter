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

  if (['ios', 'android'].indexOf(platform) === -1) {
    throw new Error('platform should be either ios or android');
  }

  const spinner = ora('processing...');
  const releaseName = `${revAppId}@${version}`;
  const bundleName =
    platform === 'ios' ? 'main.jsbundle' : 'index.android.bundle';
  let resp;

  console.log(`App [${releaseName}] for ${platform}\n`);

  try {
    console.log('[command req] generating RN bundle and sourcemap...');
    spinner.start();
    resp = await execa.command(
      `react-native bundle \
        --dev false \
        --platform ${platform} \
        --entry-file index.js \
        --bundle-output ${bundleName} \
        --sourcemap-output ${bundleName}.map`,
    );
    spinner.stop();
    console.log('\n[command resp]\n' + resp.stdout);

    console.log('[command req] uploading sourcemap...');
    spinner.start();
    // TODO: not sure how to pass --dist
    resp = await execa.command(
      `node_modules/@sentry/cli/bin/sentry-cli --auth-token ${
        process.env.SENTRY_TOKEN
      } releases -o ${process.env.SENTRY_ORG} -p ${process.env.SENTRY_PROJECT}\
        files ${releaseName} \
        upload-sourcemaps \
        --dist ${version} \
        --strip-prefix ${process.cwd()}\
        --rewrite ${bundleName} ${bundleName}.map`,
    );
    spinner.stop();
    console.log('\n[command resp]\n' + resp.stdout);
  } catch (ex) {
    console.warn(ex);
  } finally {
    spinner.stop();
  }
}

main();
