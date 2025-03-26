import React, { useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  useEffect(() => {
    // Запрашиваем разрешения при запуске
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          if (parseInt(Platform.Version as string, 10) >= 33) {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
            ]);
          } else {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
            );
          }
        } catch (err) {
          console.error('Ошибка запроса разрешений:', err);
        }
      }
    };
    
    requestPermissions();
  }, []);

  return <AppNavigator />;
};

export default App;
