package com.washow.nfcopenrewriter.archive

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RecordDocumentIOPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == RecordDocumentIOModule.NAME) RecordDocumentIOModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(RecordDocumentIOModule.NAME to ReactModuleInfo(
      RecordDocumentIOModule.NAME, RecordDocumentIOModule::class.java.name,
      false, false, false, true,
    ))
  }
}
