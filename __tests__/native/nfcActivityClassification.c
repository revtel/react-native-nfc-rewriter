#include <assert.h>
#include "../../ios/NfcOpenReader/NfcActivity.h"

int main(void)
{
  // A real URI, MIME or external NDEF record is a tag in either cold/warm paths.
  assert(NfcActivityHasBackgroundRecords(true, 1, 1));
  assert(NfcActivityHasBackgroundRecords(true, 2, 2));
  assert(NfcActivityHasBackgroundRecords(true, 1, 4));
  // Empty placeholder, nil/empty message and unrelated activities are not NFC.
  assert(!NfcActivityHasBackgroundRecords(true, 1, 0));
  assert(!NfcActivityHasBackgroundRecords(true, 0, 1));
  assert(!NfcActivityHasBackgroundRecords(false, 1, 1));
  assert(!NfcActivityHasBackgroundRecords(false, 0, 0));
  return 0;
}
