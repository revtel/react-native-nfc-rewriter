package com.revtel.nfc;

import android.content.Context;
import android.content.SharedPreferences;
import com.revtel.nfc.NativeNfcManagerSpec;
import com.facebook.react.bridge.ReactApplicationContext;

public class NativeNfcManagerModule extends NativeNfcManagerSpec {

    public static final String NAME = "NativeNfcManager";

    public NativeNfcManagerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public String echo(String key) {
        return key;
    }
}