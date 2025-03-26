package com.dmch.winetastingnotesapp; // замените на ваш пакет

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

public class FileShareModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FileShareModule";
    private final ReactApplicationContext reactContext;

    public FileShareModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "FileShareModule";
    }

    @ReactMethod
    public void shareFile(String filePath, String mimeType, String title, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Файл не найден: " + filePath);
                return;
            }

            // Получаем URI через FileProvider
            Uri contentUri = FileProvider.getUriForFile(
                    reactContext,
                    reactContext.getPackageName() + ".fileprovider",
                    file
            );

            // Создаем интент для отправки файла
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType != null ? mimeType : "application/json");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Добавляем заголовок выбора приложения
            Intent chooser = Intent.createChooser(intent, title != null ? title : "Поделиться файлом");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Запускаем интент
            reactContext.startActivity(chooser);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error sharing file", e);
            promise.reject("SHARE_ERROR", e.getMessage(), e);
        }
    }
    
    @ReactMethod
    public void saveFile(String sourcePath, String destinationFilename, String mimeType, Promise promise) {
        try {
            File sourceFile = new File(sourcePath);
            if (!sourceFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Исходный файл не найден: " + sourcePath);
                return;
            }

            // Получаем URI через FileProvider
            Uri contentUri = FileProvider.getUriForFile(
                    reactContext,
                    reactContext.getPackageName() + ".fileprovider",
                    sourceFile
            );

            // Создаем интент для создания документа
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType != null ? mimeType : "application/json");
            intent.putExtra(Intent.EXTRA_TITLE, destinationFilename);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

            // Запускаем интент
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error saving file", e);
            promise.reject("SAVE_ERROR", e.getMessage(), e);
        }
    }
}
