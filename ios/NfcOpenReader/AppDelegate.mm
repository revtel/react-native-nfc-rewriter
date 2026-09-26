#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <React-RCTAppDelegate/RCTReactNativeFactory.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <React/RCTLinkingManager.h>
#import "NfcManager.h"

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
    [NfcManager application:application
                         continueUserActivity:userActivity
                                  restorationHandler:restorationHandler];
     return [RCTLinkingManager application:application
                         continueUserActivity:userActivity
                                             restorationHandler:restorationHandler];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.reactNativeDelegate = [ReactNativeDelegate new];
    self.reactNativeDelegate.dependencyProvider = [RCTAppDependencyProvider new];
    self.reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self.reactNativeDelegate];
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    [self.reactNativeFactory startReactNativeWithModuleName:@"NfcOpenReader"
                                                  inWindow:self.window
                                         initialProperties:@{}
                                             launchOptions:launchOptions];
    return YES;
}

@end
