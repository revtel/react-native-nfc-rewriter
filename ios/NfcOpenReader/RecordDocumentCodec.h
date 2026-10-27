#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
FOUNDATION_EXPORT const NSUInteger RecordDocumentMaxBytes;
@interface RecordDocumentCodec : NSObject
+ (nullable NSString *)readStream:(NSInputStream *)stream
                       cancelled:(BOOL (^)(void))cancelled
                           error:(NSError **)error;
+ (nullable NSData *)encode:(NSString *)text error:(NSError **)error;
+ (NSError *)errorWithCode:(NSString *)code;
@end
NS_ASSUME_NONNULL_END
