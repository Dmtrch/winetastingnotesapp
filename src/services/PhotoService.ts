import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { launchCamera, CameraOptions, Asset } from 'react-native-image-picker';
import { ALBUM_NAME, IMAGES_DIR } from '../constants/Constants';
import { PermissionsAndroid } from 'react-native';

class PhotoService {
  /**
   * Создает директорию для хранения изображений в приложении, если она не существует
   */
  private async ensureWineAlbumDirExists(): Promise<string> {
    let albumDir = '';
    
    if (Platform.OS === 'android') {
      // Проверяем разрешения перед созданием директории
      const hasPermission = await this.requestStoragePermission();
      
      if (hasPermission) {
        // Для Android 10+ лучше использовать внутреннюю память приложения или медиа хранилище
        if (parseInt(Platform.Version as string, 10) >= 29) {
          albumDir = `${RNFS.DocumentDirectoryPath}/${ALBUM_NAME}`;
        } else {
          albumDir = `${RNFS.PicturesDirectoryPath}/${ALBUM_NAME}`;
        }
      } else {
        // Если разрешения нет, используем внутреннюю память приложения
        albumDir = `${RNFS.DocumentDirectoryPath}/${ALBUM_NAME}`;
        console.log('Нет разрешения на внешнее хранилище, используем внутреннюю память приложения');
      }
    } else {
      // Для iOS использовать соответствующую директорию
      albumDir = `${RNFS.DocumentDirectoryPath}/${ALBUM_NAME}`;
    }

    try {
      const dirExists = await RNFS.exists(albumDir);
      if (!dirExists) {
        await RNFS.mkdir(albumDir);
        console.log(`Создана директория альбома ${ALBUM_NAME}:`, albumDir);
      }
    } catch (error) {
      console.error(`Ошибка при создании директории альбома ${ALBUM_NAME}:`, error);
      
      // Если не удалось создать директорию, попробуем использовать внутреннюю память приложения
      albumDir = `${RNFS.DocumentDirectoryPath}/${ALBUM_NAME}`;
      try {
        const internalDirExists = await RNFS.exists(albumDir);
        if (!internalDirExists) {
          await RNFS.mkdir(albumDir);
          console.log(`Создана директория альбома внутри приложения ${ALBUM_NAME}:`, albumDir);
        }
      } catch (internalError) {
        console.error(`Ошибка при создании внутренней директории альбома ${ALBUM_NAME}:`, internalError);
      }
    }

    return albumDir;
  }

  /**
   * Запрос разрешения на доступ к файловой системе (для Android)
   */
  private async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    
    try {
      if (parseInt(Platform.Version as string, 10) >= 33) {
        // Android 13+ использует новые разрешения
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        // Проверяем, что все необходимые разрешения получены
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
        
        if (!allGranted) {
          console.log('Не все разрешения были предоставлены:', granted);
        }
        
        return allGranted;
      } 
      else if (parseInt(Platform.Version as string, 10) >= 29) {
        // Android 10-12 требует особого подхода
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Разрешение на доступ к файлам',
            message: 'Приложению нужен доступ к файлам для сохранения фотографий дегустаций.',
            buttonNeutral: 'Спросить позже',
            buttonNegative: 'Отмена',
            buttonPositive: 'OK',
          }
        );
        
        // Дополнительно запрашиваем разрешение на чтение
        const readGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED && 
               readGranted === PermissionsAndroid.RESULTS.GRANTED;
      } 
      else {
        // Android 9 и ниже
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Разрешение на доступ к файлам',
            message: 'Приложению нужен доступ к файлам для сохранения фотографий дегустаций.',
            buttonNeutral: 'Спросить позже',
            buttonNegative: 'Отмена',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error('Ошибка запроса разрешений:', err);
      return false;
    }
  }

  /**
   * Сделать фото через камеру и сохранить в альбом приложения
   * Исправлено: все фотографии теперь хранятся только в альбоме winetastenote
   */
  async takePhoto(): Promise<string | null> {
    // Сначала запрашиваем разрешения для Android
    if (Platform.OS === 'android') {
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        Alert.alert(
          'Нет разрешения',
          'Для сохранения фотографий нужен доступ к файловой системе. Пожалуйста, предоставьте разрешения в настройках приложения.',
          [
            { text: 'OK' }
          ]
        );
        return null;
      }
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      saveToPhotos: false, // Не сохраняем в галерею, только в наш альбом
      includeBase64: false,
      quality: 0.8,
    };

    try {
      const result = await launchCamera(options);

      if (result.didCancel || result.errorCode || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        return null;
      }

      // Копируем изображение только в альбом winetastenote
      const savedUri = await this.savePhotoToWineAlbum(asset);

      // Удаляем исходное фото, так как оно уже скопировано в наш альбом
      await this.deleteTemporaryPhoto(asset.uri);

      return savedUri;

    } catch (error) {
      console.error('Ошибка при получении фото:', error);
      Alert.alert('Ошибка', 'Не удалось сделать фото');
      return null;
    }
  }

  /**
   * Сохраняет фото в альбом winetastenote и возвращает путь
   * Исправлено: все фото хранятся только в альбоме winetastenote
   */
  async savePhotoToWineAlbum(asset: Asset): Promise<string> {
    try {
      // Убираем префикс file:// если есть
      const sourceUri = asset.uri.replace('file://', '');

      // Создаем директорию альбома если нужно
      const albumDir = await this.ensureWineAlbumDirExists();

      // Генерируем имя файла с временной меткой для уникальности
      const timestamp = new Date().getTime();
      const extension = asset.uri.includes('.')
        ? asset.uri.substring(asset.uri.lastIndexOf('.'))
        : '.jpg';
      const fileName = `${ALBUM_NAME}_${timestamp}${extension}`;

      // Путь назначения в альбоме winetastenote
      const destPath = `${albumDir}/${fileName}`;

      // Копируем файл
      await RNFS.copyFile(sourceUri, destPath);
      console.log(`Изображение скопировано в: ${destPath}`);

      // Возвращаем URI с префиксом file://
      return `file://${destPath}`;
    } catch (error) {
      console.error('Ошибка при сохранении фото в альбом приложения:', error);
      return asset.uri; // В случае ошибки возвращаем исходный URI
    }
  }

  /**
   * Удаляет временное фото
   * Исправлено: более агрессивная проверка и удаление временных фото
   */
  async deleteTemporaryPhoto(filePath: string): Promise<void> {
    try {
      // Убираем префикс file:// если есть
      const path = filePath.replace('file://', '');

      // Проверяем, существует ли файл
      const exists = await RNFS.exists(path);
      if (exists) {
        // Убеждаемся, что это не файл из нашего альбома
        if (!path.includes(ALBUM_NAME)) {
          await RNFS.unlink(path);
          console.log(`Удален временный файл: ${path}`);
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении временного фото:', error);
    }
  }

  /**
   * Удаляет фото из файловой системы
   * Исправлено: Если фото находится не в альбоме winetastenote, оно удаляется
   */
  async deletePhoto(photoUri: string): Promise<void> {
    if (!photoUri) {return;}

    try {
      // Убираем префикс file:// если есть
      const filePath = photoUri.replace('file://', '');

      // Проверяем, существует ли файл
      const exists = await RNFS.exists(filePath);
      if (exists) {
        await RNFS.unlink(filePath);
        console.log(`Удален файл фото: ${filePath}`);
      }
      
      console.log(`Успешно удалено фото: ${photoUri}`);
    } catch (error) {
      console.error('Ошибка при удалении фото:', error);
    }
  }
  
  /**
   * Проверяет наличие всех разрешений для работы с фотографиями
   * Можно вызывать при запуске приложения
   */
  async checkAndRequestAllPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return true; // iOS обрабатывает разрешения по-другому
    }
    
    return await this.requestStoragePermission();
  }
}

export default new PhotoService();
