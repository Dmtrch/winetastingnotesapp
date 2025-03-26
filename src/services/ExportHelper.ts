import RNFS from 'react-native-fs';
import { Alert, Platform, Share, NativeModules, PermissionsAndroid } from 'react-native';
import JSZip from 'jszip';

// Получаем нативный модуль для шаринга файлов
const { FileShareModule } = NativeModules;

/**
 * Вспомогательный класс для работы с экспортом и импортом данных
 */
class ExportHelper {
  /**
   * Создает ZIP-архив с данными JSON и фотографиями
   */
  async exportAsZipArchive(exportDir: string, jsonPath: string, imagesPaths: string[]): Promise<string> {
    try {
      const zip = new JSZip();

      // Добавляем JSON файл
      const jsonContent = await RNFS.readFile(jsonPath, 'utf8');
      zip.file('WineTastingData.json', jsonContent);

      // Добавляем папку для изображений
      const imagesFolder = zip.folder('exported_images');

      if (imagesFolder) {
        // Добавляем все изображения
        for (const imagePath of imagesPaths) {
          try {
            const imageName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
            const imageExists = await RNFS.exists(imagePath);

            if (imageExists) {
              const imageContent = await RNFS.readFile(imagePath, 'base64');
              imagesFolder.file(imageName, imageContent, { base64: true });
              console.log(`Добавлено изображение ${imageName} в ZIP`);
            } else {
              console.warn(`Файл не найден при создании ZIP: ${imagePath}`);
            }
          } catch (imgError) {
            console.error('Ошибка при добавлении изображения в ZIP:', imgError);
          }
        }
      }

      // Генерируем ZIP-файл
      const zipContent = await zip.generateAsync({ type: 'base64' });

      // Сохраняем ZIP-файл
      const zipPath = `${exportDir}/WineTastingExport.zip`;
      await RNFS.writeFile(zipPath, zipContent, 'base64');

      return zipPath;
    } catch (error) {
      console.error('Ошибка создания ZIP архива:', error);
      throw new Error('Не удалось создать ZIP архив');
    }
  }

  /**
   * Создает HTML файл с инструкциями
   */
  async createReadmeHTML(exportDir: string, _failedImages: number, _totalImages: number): Promise<string> {
    const htmlPath = `${exportDir}/README.html`;
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Экспортированные данные дегустационных заметок</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1 { color: #722F37; }
        .info { background: #f9f9f9; padding: 15px; border-left: 4px solid #722F37; }
      </style>
    </head>
    <body>
      <h1>Данные дегустационных заметок</h1>
      <div class="info">
        <p>Файлы успешно экспортированы.</p>
        <p><strong>WineTastingData.json</strong> - содержит все записи в формате JSON</p>
        <p><strong>/exported_images/</strong> - содержит все изображения, на которые ссылаются записи</p>
        <p><strong>WineTastingExport.zip</strong> - архив, содержащий JSON и изображения</p>
        <p>Для импорта данных обратно в приложение используйте функцию импорта.</p>
      </div>
    </body>
    </html>
    `;
    await RNFS.writeFile(htmlPath, htmlContent, 'utf8');
    return htmlPath;
  }

  /**
   * Удаляет временные файлы экспорта после завершения
   * Исправлено: теперь функция гарантированно удаляет файлы экспорта
   */
  async cleanupExportFiles(exportDir: string, keepTime: number = 60000): Promise<void> {
    try {
      // Планируем удаление через указанное время
      setTimeout(async () => {
        try {
          const exists = await RNFS.exists(exportDir);
          if (exists) {
            console.log(`Начинаем удаление временной директории экспорта: ${exportDir}`);

            // Используем unlink без опции recursive для удаления директории с содержимым
            await RNFS.unlink(exportDir);

            console.log(`Успешно удалена директория экспорта: ${exportDir}`);
          } else {
            console.log(`Директория экспорта не найдена: ${exportDir}`);
          }
        } catch (error) {
          console.error('Ошибка при удалении временных файлов экспорта:', error);
          // Попытка повторного удаления через минуту, если первая попытка не удалась
          setTimeout(async () => {
            try {
              const stillExists = await RNFS.exists(exportDir);
              if (stillExists) {
                await RNFS.unlink(exportDir);
                console.log(`Повторная попытка: удалена директория экспорта: ${exportDir}`);
              }
            } catch (retryError) {
              console.error('Окончательная ошибка при удалении временных файлов:', retryError);
            }
          }, 60000);
        }
      }, keepTime);
    } catch (error) {
      console.error('Ошибка при планировании удаления временных файлов:', error);
    }
  }

  /**
   * Запрос разрешения на доступ к файловой системе (для Android)
   */
  async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      if (Platform.Version >= 33) {
        // Android 13+ использует новые разрешения
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ]);

        return Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 12 и ниже
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Разрешение на доступ к файлам',
            message: 'Приложению нужен доступ к файлам для экспорта/импорта данных',
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
   * Шаринг ZIP-архива с экспортированными данными
   */
  async shareZipFile(zipPath: string, title: string): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        if (FileShareModule) {
          await FileShareModule.shareFile(
            zipPath,
            'application/zip',
            title
          );
        } else {
          // На некоторых устройствах Android нужен дополнительный префикс
          const fileUri = zipPath.startsWith('file://') ? zipPath : `file://${zipPath}`;

          await Share.share({
            title: title,
            message: 'Прикрепляю экспортированные данные о винах',
            url: fileUri, // некоторые приложения ожидают параметр url
          }, {
            dialogTitle: 'Поделиться ZIP-архивом с данными',
            subject: 'Экспортированные данные о винах',
          });
        }
      } else {
        // Для iOS
        await Share.share({
          url: zipPath.startsWith('file://') ? zipPath : `file://${zipPath}`,
          title: title,
        }, {
          subject: 'Экспортированные данные о винах',
          excludedActivityTypes: [
            'com.apple.UIKit.activity.Print',
            'com.apple.UIKit.activity.AssignToContact',
          ],
        });
      }
    } catch (shareError) {
      console.error('Ошибка при шаринге файла:', shareError);

      // Если стандартный шаринг не работает, информируем пользователя
      Alert.alert(
        'Информация о файле',
        `ZIP-архив с данными сохранен в:\n${zipPath}\n\nВы можете найти этот файл через Файловый менеджер.`
      );
    }
  }

  /**
   * Распаковка ZIP-архива
   */
  async extractZipArchive(zipPath: string, extractDir: string): Promise<{jsonPath: string, imagesDir: string}> {
    try {
      // Создаем директорию для распаковки
      await RNFS.mkdir(extractDir);

      // Читаем ZIP файл
      const zipData = await RNFS.readFile(zipPath, 'base64');
      const zip = new JSZip();
      await zip.loadAsync(zipData, { base64: true });

      // Директория для изображений
      const imagesDir = `${extractDir}/exported_images`;
      await RNFS.mkdir(imagesDir);

      // Распаковываем JSON
      let jsonPath = '';
      const jsonFile = zip.file('WineTastingData.json');
      if (jsonFile) {
        const jsonContent = await jsonFile.async('string');
        jsonPath = `${extractDir}/WineTastingData.json`;
        await RNFS.writeFile(jsonPath, jsonContent, 'utf8');
      }

      // Распаковываем изображения
      const imageFiles = zip.folder('exported_images');
      if (imageFiles) {
        const imageFileObjects = imageFiles.files;
        for (const filePath in imageFileObjects) {
          // Пропускаем директории и корневую папку
          if (filePath === 'exported_images/' || imageFileObjects[filePath].dir) {
            continue;
          }

          const fileName = filePath.replace('exported_images/', '');
          const fileData = await imageFileObjects[filePath].async('base64');
          const outputPath = `${imagesDir}/${fileName}`;

          await RNFS.writeFile(outputPath, fileData, 'base64');
          console.log(`Распакован файл: ${fileName}`);
        }
      }

      return { jsonPath, imagesDir };
    } catch (error) {
      console.error('Ошибка распаковки ZIP:', error);
      throw new Error('Не удалось распаковать ZIP-архив');
    }
  }
}

export default new ExportHelper();
