#import "SceneDelegate.h"
#import "AppDelegate.h"
#import "NfcManager.h"

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
  UIOpenURLContext *urlContext = connectionOptions.URLContexts.anyObject;
  if (urlContext != nil) {
    launchOptions[UIApplicationLaunchOptionsURLKey] = urlContext.URL;
  }
  NSUserActivity *userActivity = connectionOptions.userActivities.anyObject;
  if (userActivity != nil) {
    // React Native's getInitialURL still reads the application launch-options keys.
    launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey] = @{
      UIApplicationLaunchOptionsUserActivityTypeKey: userActivity.activityType,
      @"UIApplicationLaunchOptionsUserActivityKey": userActivity,
    };
  }
  // Cache cold-start NFC records before JavaScript requests the background tag.
  for (NSUserActivity *activity in connectionOptions.userActivities) {
    [NfcManager application:UIApplication.sharedApplication
        continueUserActivity:activity
          restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *objects) {}];
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
