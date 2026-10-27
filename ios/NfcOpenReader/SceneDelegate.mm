#import "SceneDelegate.h"
#import "AppDelegate.h"
#import "NfcManager.h"
#import "NfcActivity.h"

@implementation SceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  NSMutableDictionary *launchOptions = [appDelegate.launchOptions mutableCopy];
  // Scene connection options are the source of truth for this launch.
  [launchOptions removeObjectForKey:UIApplicationLaunchOptionsURLKey];
  [launchOptions removeObjectForKey:UIApplicationLaunchOptionsUserActivityDictionaryKey];
  NSUserActivity *backgroundActivity = nil;
  NSUserActivity *webActivity = nil;
  for (NSUserActivity *activity in connectionOptions.userActivities) {
    if (NfcActivityIsBackgroundTag(activity)) {
      backgroundActivity = activity;
      break;
    }
    if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb] &&
        activity.webpageURL != nil) {
      webActivity = activity;
    }
  }
  if (backgroundActivity != nil) {
    // Cache NFC before JS starts, without also manufacturing an initial URL.
    [NfcManager application:UIApplication.sharedApplication
        continueUserActivity:backgroundActivity
          restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *objects) {}];
  } else {
    UIOpenURLContext *urlContext = connectionOptions.URLContexts.anyObject;
    if (urlContext != nil) {
      launchOptions[UIApplicationLaunchOptionsURLKey] = urlContext.URL;
    } else if (webActivity != nil) {
      // React Native's getInitialURL reads these application launch-options keys.
      launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey] = @{
        UIApplicationLaunchOptionsUserActivityTypeKey: webActivity.activityType,
        @"UIApplicationLaunchOptionsUserActivityKey": webActivity,
      };
    }
  }

  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  appDelegate.window = self.window;
  [appDelegate startReactNativeInWindow:self.window launchOptions:launchOptions];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  for (UIOpenURLContext *context in URLContexts) {
    NSMutableDictionary *options = [NSMutableDictionary new];
    if (context.options.sourceApplication != nil) {
      options[UIApplicationOpenURLOptionsSourceApplicationKey] = context.options.sourceApplication;
    }
    if (context.options.annotation != nil) {
      options[UIApplicationOpenURLOptionsAnnotationKey] = context.options.annotation;
    }
    options[UIApplicationOpenURLOptionsOpenInPlaceKey] = @(context.options.openInPlace);
    [appDelegate application:UIApplication.sharedApplication openURL:context.URL options:options];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  [appDelegate application:UIApplication.sharedApplication
      continueUserActivity:userActivity
        restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *objects) {}];
}

@end
