#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <React-RCTAppDelegate/RCTReactNativeFactory.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <React/RCTLinkingManager.h>
#import "NfcManager.h"
#import "NfcActivity.h"

@interface ReactNativeDelegate : RCTDefaultReactNativeFactoryDelegate
@end

@implementation ReactNativeDelegate

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end

@interface AppDelegate ()
@property (nonatomic, copy, readwrite) NSDictionary *launchOptions;
@property (nonatomic, strong) ReactNativeDelegate *reactNativeDelegate;
@property (nonatomic, strong) RCTReactNativeFactory *reactNativeFactory;
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
   openURL:(NSURL *)url
      options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
    return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity
 restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
    if (NfcActivityIsBackgroundTag(userActivity)) {
        return [NfcManager application:application
                 continueUserActivity:userActivity
                   restorationHandler:restorationHandler];
    }
    return [RCTLinkingManager application:application
                    continueUserActivity:userActivity
                      restorationHandler:restorationHandler];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.launchOptions = launchOptions ?: @{};
    self.reactNativeDelegate = [ReactNativeDelegate new];
    self.reactNativeDelegate.dependencyProvider = [RCTAppDependencyProvider new];
    self.reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self.reactNativeDelegate];
    return YES;
}

- (void)startReactNativeInWindow:(UIWindow *)window launchOptions:(NSDictionary *)launchOptions
{
    [self.reactNativeFactory startReactNativeWithModuleName:@"NfcOpenReader"
                                                  inWindow:window
                                         initialProperties:@{}
                                             launchOptions:launchOptions];
}

@end
