#ifndef NFC_OPEN_REWRITER_ACTIVITY_H
#define NFC_OPEN_REWRITER_ACTIVITY_H

#include <stdbool.h>
#include <stddef.h>

// TNF 0 is Apple's empty placeholder for an ordinary Universal Link. Keep this
// predicate portable so the exact production classification has a native test.
static inline bool NfcActivityHasBackgroundRecords(bool browsingWeb,
                                                   size_t recordCount,
                                                   unsigned char firstTNF)
{
  return browsingWeb && recordCount > 0 && firstTNF != 0;
}

#ifdef __OBJC__
#import <CoreNFC/CoreNFC.h>
#import <Foundation/Foundation.h>

static inline BOOL NfcActivityIsBackgroundTag(NSUserActivity *activity)
{
  NFCNDEFMessage *message = nil;
  const BOOL browsingWeb =
      [activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb];
  if (browsingWeb) {
    message = activity.ndefMessagePayload;
  }
  return NfcActivityHasBackgroundRecords(browsingWeb, message.records.count,
                                         message.records.firstObject.typeNameFormat);
}
#endif

#endif
