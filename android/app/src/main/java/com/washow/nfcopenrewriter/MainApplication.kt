package com.washow.nfcopenrewriter

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.washow.nfcopenrewriter.archive.RecordDocumentIOPackage
 
class MainApplication : Application(), ReactApplication {
 
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply { add(RecordDocumentIOPackage()) },
    )
  }
 
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
