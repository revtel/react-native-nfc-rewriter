#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${TESTFLIGHT_CONFIG:-${ROOT_DIR}/.testflight.env}"
PROJECT_FILE="${ROOT_DIR}/ios/NfcOpenReader.xcodeproj/project.pbxproj"
WORKSPACE_FILE="${ROOT_DIR}/ios/NfcOpenReader.xcworkspace"
SCHEME="NfcOpenReader"
BUNDLE_ID="com.revteltech.nfcopenrewriter"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Missing ${CONFIG_FILE}. Copy .testflight.env.example and fill in the API key settings." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${CONFIG_FILE}"

for setting in ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH; do
  if [[ -z "${!setting:-}" ]]; then
    echo "Missing required setting: ${setting}" >&2
    exit 1
  fi
done

if [[ "${ASC_KEY_PATH}" != /* ]]; then
  ASC_KEY_PATH="${ROOT_DIR}/${ASC_KEY_PATH}"
fi

if [[ ! -r "${ASC_KEY_PATH}" ]]; then
  echo "API private key is not readable: ${ASC_KEY_PATH}" >&2
  exit 1
fi

PROJECT_VERSIONS="$(sed -n 's/^[[:space:]]*MARKETING_VERSION = \([^;]*\);/\1/p' "${PROJECT_FILE}" | sort -u)"
if [[ "$(printf '%s\n' "${PROJECT_VERSIONS}" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]]; then
  echo "Expected exactly one MARKETING_VERSION in the Xcode project; found: ${PROJECT_VERSIONS}" >&2
  exit 1
fi

APP_VERSION="${TESTFLIGHT_VERSION:-${PROJECT_VERSIONS}}"
BUILD_NUMBER="${TESTFLIGHT_BUILD_NUMBER:-$(date -u +%Y%m%d%H%M)}"
TEMP_DIR="$(mktemp -d /tmp/nfc-testflight.XXXXXX)"
ARCHIVE_PATH="${TEMP_DIR}/NfcOpenReader.xcarchive"
EXPORT_PATH="${TEMP_DIR}/export"
EXPORT_OPTIONS="${TEMP_DIR}/ExportOptions.plist"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

auth_args=(
  -authenticationKeyPath "${ASC_KEY_PATH}"
  -authenticationKeyID "${ASC_KEY_ID}"
  -authenticationKeyIssuerID "${ASC_ISSUER_ID}"
)

echo "Running verification for ${APP_VERSION} (${BUILD_NUMBER})..."
cd "${ROOT_DIR}"
npm test -- --runInBand
git diff --check

echo "Creating signed Release archive..."
xcodebuild \
  -workspace "${WORKSPACE_FILE}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "${ARCHIVE_PATH}" \
  MARKETING_VERSION="${APP_VERSION}" \
  CURRENT_PROJECT_VERSION="${BUILD_NUMBER}" \
  -allowProvisioningUpdates \
  "${auth_args[@]}" \
  archive

ARCHIVED_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "${ARCHIVE_PATH}/Info.plist")"
ARCHIVED_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "${ARCHIVE_PATH}/Info.plist")"
if [[ "${ARCHIVED_VERSION}" != "${APP_VERSION}" || "${ARCHIVED_BUILD}" != "${BUILD_NUMBER}" ]]; then
  echo "Archive metadata mismatch: expected ${APP_VERSION} (${BUILD_NUMBER}), got ${ARCHIVED_VERSION} (${ARCHIVED_BUILD})" >&2
  exit 1
fi

plutil -create xml1 "${EXPORT_OPTIONS}"
plutil -insert destination -string upload "${EXPORT_OPTIONS}"
plutil -insert method -string app-store-connect "${EXPORT_OPTIONS}"
plutil -insert signingStyle -string automatic "${EXPORT_OPTIONS}"
plutil -insert manageAppVersionAndBuildNumber -bool false "${EXPORT_OPTIONS}"
plutil -insert uploadSymbols -bool true "${EXPORT_OPTIONS}"

echo "Uploading ${APP_VERSION} (${BUILD_NUMBER}) to App Store Connect..."
xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS}" \
  -allowProvisioningUpdates \
  "${auth_args[@]}"

asc_get() {
  local endpoint="$1"
  local token
  token="$("${ROOT_DIR}/tools/app_store_connect_token.rb" "${ASC_KEY_ID}" "${ASC_ISSUER_ID}" "${ASC_KEY_PATH}")"
  curl --fail --silent --show-error \
    -H "Authorization: Bearer ${token}" \
    "https://api.appstoreconnect.apple.com${endpoint}"
}

encoded_bundle_id="$(jq -rn --arg value "${BUNDLE_ID}" '$value|@uri')"
app_response="$(asc_get "/v1/apps?filter%5BbundleId%5D=${encoded_bundle_id}&limit=1")"
app_id="$(jq -r '.data[0].id // empty' <<<"${app_response}")"
if [[ -z "${app_id}" ]]; then
  echo "Could not resolve App Store Connect app for ${BUNDLE_ID}" >&2
  exit 1
fi

echo "Upload accepted. Waiting for TestFlight processing..."
for _ in $(seq 1 80); do
  build_response="$(asc_get "/v1/builds?filter%5Bapp%5D=${app_id}&filter%5Bversion%5D=${BUILD_NUMBER}&limit=1")"
  build_id="$(jq -r '.data[0].id // empty' <<<"${build_response}")"
  processing_state="$(jq -r '.data[0].attributes.processingState // empty' <<<"${build_response}")"

  case "${processing_state}" in
    VALID)
      echo "TestFlight build ${APP_VERSION} (${BUILD_NUMBER}) is ready. Build ID: ${build_id}"
      exit 0
      ;;
    INVALID|FAILED)
      echo "TestFlight processing failed with state ${processing_state}. Build ID: ${build_id}" >&2
      exit 1
      ;;
    PROCESSING)
      echo "Still processing..."
      ;;
    *)
      echo "Waiting for the uploaded build to appear..."
      ;;
  esac

  sleep 30
done

echo "Upload succeeded, but processing did not finish within 40 minutes." >&2
exit 2
