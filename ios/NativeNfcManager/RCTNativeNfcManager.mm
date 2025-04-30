//
//  RCTNativeNfcManager.m
//  NfcOpenReader
//
//  Created by Richie Hsieh on 2025/4/29.
//

#import "RCTNativeNfcManager.h"

@implementation RCTNativeNfcManager

- (id) init {
  if (self = [super init]) {
    // pass
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeNfcManagerSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"NativeNfcManager";
}

- (void)echo:(NSString *)value callback:(RCTResponseSenderBlock)callback {
  callback(@[[NSNull null], value]);
}

@end
