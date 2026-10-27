#import "RecordDocumentCodec.h"

const NSUInteger RecordDocumentMaxBytes = 5 * 1024 * 1024;

@implementation RecordDocumentCodec
+ (NSError *)errorWithCode:(NSString *)code
{
  return [NSError errorWithDomain:@"RecordDocumentIO" code:1 userInfo:@{@"code": code}];
}

+ (nullable NSString *)readStream:(NSInputStream *)stream cancelled:(BOOL (^)(void))cancelled error:(NSError **)error
{
  NSMutableData *data = [NSMutableData data];
  uint8_t buffer[8192];
  while (YES) {
    if (cancelled()) { *error = [self errorWithCode:@"CANCELLED"]; return nil; }
    NSUInteger length = MIN(sizeof(buffer), RecordDocumentMaxBytes + 1 - data.length);
    NSInteger count = [stream read:buffer maxLength:length];
    if (cancelled()) { *error = [self errorWithCode:@"CANCELLED"]; return nil; }
    if (count < 0) { *error = [self errorWithCode:@"DOCUMENT_IO_FAILED"]; return nil; }
    if (count == 0) break;
    [data appendBytes:buffer length:(NSUInteger)count];
    if (data.length > RecordDocumentMaxBytes) {
      *error = [self errorWithCode:@"ARCHIVE_TOO_LARGE"];
      return nil;
    }
  }
  NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  if (!text) *error = [self errorWithCode:@"INVALID_UTF8"];
  return text;
}

+ (nullable NSData *)encode:(NSString *)text error:(NSError **)error
{
  if (text.length > RecordDocumentMaxBytes) { *error = [self errorWithCode:@"ARCHIVE_TOO_LARGE"]; return nil; }
  NSData *data = [text dataUsingEncoding:NSUTF8StringEncoding allowLossyConversion:NO];
  if (!data) { *error = [self errorWithCode:@"INVALID_UTF8"]; return nil; }
  if (data.length > RecordDocumentMaxBytes) { *error = [self errorWithCode:@"ARCHIVE_TOO_LARGE"]; return nil; }
  return data;
}
@end
