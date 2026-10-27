#import <Foundation/Foundation.h>
#import "RecordDocumentCodec.h"

@interface ChunkStream : NSInputStream
- (instancetype)initWithBytes:(NSData *)bytes;
@end
@implementation ChunkStream {
  NSData *_bytes;
  NSUInteger _offset;
}
- (instancetype)initWithBytes:(NSData *)bytes { if ((self = [super init])) _bytes = bytes; return self; }
- (NSInteger)read:(uint8_t *)buffer maxLength:(NSUInteger)length {
  NSUInteger count = MIN(MIN(length, 2), _bytes.length - _offset);
  if (count) memcpy(buffer, ((const uint8_t *)_bytes.bytes) + _offset, count);
  _offset += count;
  return (NSInteger)count;
}
@end

static NSUInteger checked;
static void require(BOOL value) { if (!value) abort(); checked++; }
static void rejectBytes(NSData *bytes, NSString *code) {
  NSError *error = nil;
  NSInputStream *stream = [NSInputStream inputStreamWithData:bytes];
  [stream open];
  require([RecordDocumentCodec readStream:stream cancelled:^BOOL { return NO; } error:&error] == nil);
  require([error.userInfo[@"code"] isEqualToString:code]);
  [stream close];
}
int main(void) {
  @autoreleasepool {
    NSString *unicode = @"中文 日本語 🏷️ & #";
    NSData *encoded = [unicode dataUsingEncoding:NSUTF8StringEncoding];
    NSError *error = nil;
    ChunkStream *shortReads = [[ChunkStream alloc] initWithBytes:encoded];
    require([[RecordDocumentCodec readStream:shortReads cancelled:^BOOL { return NO; } error:&error] isEqualToString:unicode]);
    NSInputStream *empty = [NSInputStream inputStreamWithData:[NSData data]];
    [empty open];
    require([[RecordDocumentCodec readStream:empty cancelled:^BOOL { return NO; } error:&error] isEqualToString:@""]);
    [empty close];
    NSMutableData *max = [NSMutableData dataWithLength:RecordDocumentMaxBytes];
    memset(max.mutableBytes, 'a', max.length);
    NSInputStream *boundary = [NSInputStream inputStreamWithData:max];
    [boundary open];
    require([RecordDocumentCodec readStream:boundary cancelled:^BOOL { return NO; } error:&error].length == RecordDocumentMaxBytes);
    [boundary close];
    [max appendBytes:"a" length:1];
    rejectBytes(max, @"ARCHIVE_TOO_LARGE");
    const uint8_t invalid[] = {0xc0, 0x80};
    rejectBytes([NSData dataWithBytes:invalid length:2], @"INVALID_UTF8");
    const uint8_t incomplete[] = {0xe4, 0xb8};
    rejectBytes([NSData dataWithBytes:incomplete length:2], @"INVALID_UTF8");
    ChunkStream *cancelled = [[ChunkStream alloc] initWithBytes:encoded];
    __block NSUInteger calls = 0;
    error = nil;
    require([RecordDocumentCodec readStream:cancelled cancelled:^BOOL { return ++calls >= 2; } error:&error] == nil);
    require([error.userInfo[@"code"] isEqualToString:@"CANCELLED"]);
    require([[RecordDocumentCodec encode:unicode error:&error] isEqualToData:encoded]);
    unichar orphan = 0xd800;
    NSString *invalidString = [[NSString alloc] initWithCharacters:&orphan length:1];
    error = nil;
    require([RecordDocumentCodec encode:invalidString error:&error] == nil);
    require([error.userInfo[@"code"] isEqualToString:@"INVALID_UTF8"]);
    printf("RecordDocumentCodec Foundation PASS: %lu checks\n", (unsigned long)checked);
  }
  return 0;
}
