package com.winetastingnotesapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class FolderPickerModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final int PICK_FOLDER_REQUEST = 1001;
    private Promise pickerPromise;

    public FolderPickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
    }

    @NonNull
    @Override
    public String getName() {
        return "FolderPicker";
    }

    @ReactMethod
    public void pickFolder(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("E_NO_ACTIVITY", "Activity doesn't exist");
            return;
        }
        pickerPromise = promise;
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            currentActivity.startActivityForResult(intent, PICK_FOLDER_REQUEST);
        } catch (Exception e) {
            pickerPromise.reject("E_FAILED_TO_SHOW_PICKER", e);
            pickerPromise = null;
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FOLDER_REQUEST) {
            if (pickerPromise != null) {
                if (resultCode == Activity.RESULT_CANCELED) {
                    pickerPromise.reject("E_PICKER_CANCELLED", "Folder picker was cancelled");
                } else if (resultCode == Activity.RESULT_OK) {
                    Uri folderUri = data.getData();
                    pickerPromise.resolve(folderUri.toString());
                }
                pickerPromise = null;
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        // Не требуется для данного модуля
    }
}