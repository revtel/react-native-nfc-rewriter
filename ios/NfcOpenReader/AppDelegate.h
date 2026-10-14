#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate>

// React Native's LogBox/profiler still access the app delegate's window.
@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, copy, readonly) NSDictionary *launchOptions;

- (void)startReactNativeInWindow:(UIWindow *)window launchOptions:(NSDictionary *)launchOptions;

@end
