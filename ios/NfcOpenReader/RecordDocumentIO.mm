#import "RecordDocumentIO.h"
#import "RecordDocumentCodec.h"
#import <React/RCTInvalidating.h>

@interface RecordDocumentRequest : NSObject
@property(atomic) BOOL cancelled;
@property(atomic, strong) NSInputStream *stream;
@end
@implementation RecordDocumentRequest
@end

@interface RecordDocumentIO () <RCTInvalidating>
@end

@implementation RecordDocumentIO {
  NSMutableDictionary<NSString *, RecordDocumentRequest *> *_requests;
  NSMutableDictionary<NSString *, NSURL *> *_exports;
  dispatch_queue_t _workers;
  NSURL *_directory;
}

RCT_EXPORT_MODULE(RecordDocumentIO)

- (instancetype)init
{
  if ((self = [super init])) {
    _requests = [NSMutableDictionary dictionary];
    _exports = [NSMutableDictionary dictionary];
    _workers = dispatch_queue_create("com.revteltech.record-document-io", DISPATCH_QUEUE_CONCURRENT);
    _directory = [[[NSFileManager defaultManager] URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask].firstObject URLByAppendingPathComponent:@"record-library-exports" isDirectory:YES];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup { return NO; }

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRecordDocumentIOSpecJSI>(params);
}

- (RecordDocumentRequest *)begin:(NSString *)requestId reject:(RCTPromiseRejectBlock)reject
{
  @synchronized(self) {
    if (requestId.length == 0 || _requests[requestId]) {
      reject(@"DOCUMENT_BUSY", @"DOCUMENT_BUSY", nil);
      return nil;
    }
    RecordDocumentRequest *request = [RecordDocumentRequest new];
    _requests[requestId] = request;
    return request;
  }
}

- (void)finish:(NSString *)requestId
{
  @synchronized(self) { [_requests removeObjectForKey:requestId]; }
}

- (void)readDocument:(NSString *)uri requestId:(NSString *)requestId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RecordDocumentRequest *request = [self begin:requestId reject:reject];
  if (!request) return;
  dispatch_async(_workers, ^{
    NSURL *url = [NSURL URLWithString:uri];
    if (!url.isFileURL) {
      reject(@"INVALID_DOCUMENT_URI", @"INVALID_DOCUMENT_URI", nil);
      [self finish:requestId];
      return;
    }
    BOOL scoped = [url startAccessingSecurityScopedResource];
    NSInputStream *stream = [NSInputStream inputStreamWithURL:url];
    request.stream = stream;
    NSError *error = nil;
    NSString *text = nil;
    @try {
      if (!stream) error = [RecordDocumentCodec errorWithCode:@"DOCUMENT_IO_FAILED"];
      else {
        [stream open];
        text = [RecordDocumentCodec readStream:stream cancelled:^BOOL { return request.cancelled; } error:&error];
      }
    } @finally {
      [stream close];
      request.stream = nil;
      if (scoped) [url stopAccessingSecurityScopedResource];
      [self finish:requestId];
    }
    if (request.cancelled) error = [RecordDocumentCodec errorWithCode:@"CANCELLED"];
    if (error || !text) {
      NSString *code = error.userInfo[@"code"] ?: @"DOCUMENT_IO_FAILED";
      reject(code, code, nil);
    } else resolve(text);
  });
}

- (void)createExport:(NSString *)text requestId:(NSString *)requestId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  RecordDocumentRequest *request = [self begin:requestId reject:reject];
  if (!request) return;
  dispatch_async(_workers, ^{
    NSError *error = nil;
    NSData *data = [RecordDocumentCodec encode:text error:&error];
    if (request.cancelled) error = [RecordDocumentCodec errorWithCode:@"CANCELLED"];
    NSString *token = [NSUUID UUID].UUIDString;
    NSURL *folder = [self->_directory URLByAppendingPathComponent:token isDirectory:YES];
    NSDateFormatter *formatter = [NSDateFormatter new];
    formatter.locale = [[NSLocale alloc] initWithLocaleIdentifier:@"en_US_POSIX"];
    formatter.dateFormat = @"yyyyMMdd-HHmmss";
    NSString *fileName = [NSString stringWithFormat:@"nfc-open-rewriter-records-%@.json", [formatter stringFromDate:[NSDate date]]];
    NSURL *target = [folder URLByAppendingPathComponent:fileName];
    if (!error) {
      @synchronized(self) { self->_exports[token] = target; }
      [[NSFileManager defaultManager] createDirectoryAtURL:folder withIntermediateDirectories:YES attributes:@{NSFileProtectionKey:NSFileProtectionComplete} error:&error];
      if (!error) [data writeToURL:target options:NSDataWritingAtomic | NSDataWritingFileProtectionComplete error:&error];
      if (request.cancelled) error = [RecordDocumentCodec errorWithCode:@"CANCELLED"];
    }
    [self finish:requestId];
    if (error) {
      [[NSFileManager defaultManager] removeItemAtURL:target error:nil];
      [[NSFileManager defaultManager] removeItemAtURL:folder error:nil];
      @synchronized(self) { [self->_exports removeObjectForKey:token]; }
      NSString *code = error.userInfo[@"code"] ?: @"DOCUMENT_IO_FAILED";
      reject(code, code, nil);
    } else resolve(@{@"token": token, @"uri": target.absoluteString});
  });
}

- (void)releaseExport:(NSString *)token resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_workers, ^{
    NSURL *target;
    @synchronized(self) {
      target = self->_exports[token];
      [self->_exports removeObjectForKey:token];
    }
    NSError *error = nil;
    if (target && [[NSFileManager defaultManager] fileExistsAtPath:target.path]) [[NSFileManager defaultManager] removeItemAtURL:target error:&error];
    if (error) reject(@"DOCUMENT_CLEANUP_FAILED", @"DOCUMENT_CLEANUP_FAILED", nil);
    else {
      if (target) [[NSFileManager defaultManager] removeItemAtURL:target.URLByDeletingLastPathComponent error:nil];
      resolve(nil);
    }
  });
}

- (void)cleanupExports:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_workers, ^{
    NSFileManager *manager = [NSFileManager defaultManager];
    NSArray<NSURL *> *files = [manager contentsOfDirectoryAtURL:self->_directory includingPropertiesForKeys:nil options:0 error:nil];
    BOOL failed = NO;
    for (NSURL *folder in files) {
      NSString *token = folder.lastPathComponent;
      BOOL active;
      @synchronized(self) { active = self->_exports[token] != nil; }
      if ([[NSUUID alloc] initWithUUIDString:token] && !active) {
        NSError *error = nil;
        [manager removeItemAtURL:folder error:&error];
        if (error) failed = YES;
      }
    }
    if (failed) reject(@"DOCUMENT_CLEANUP_FAILED", @"DOCUMENT_CLEANUP_FAILED", nil); else resolve(nil);
  });
}

- (void)cancel:(NSString *)requestId
{
  RecordDocumentRequest *request;
  @synchronized(self) { request = _requests[requestId]; }
  request.cancelled = YES;
  [request.stream close];
}

- (void)invalidate
{
  @synchronized(self) {
    for (RecordDocumentRequest *request in _requests.allValues) {
      request.cancelled = YES;
      [request.stream close];
    }
  }
}
@end
