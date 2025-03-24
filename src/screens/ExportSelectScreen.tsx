import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Share,
  Platform,
  PermissionsAndroid,
  NativeModules,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';
import Logo from '../components/Logo';
import JSZip from 'jszip';

// Получаем нативный модуль для шаринга файлов
const { FileShareModule } = NativeModules;

type ExportSelectScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExportSelect'>;

const ExportSelectScreen = () => {
  const navigation = useNavigation<ExportSelectScreenNavigationProp>();
  const [records, setRecords] = useState<WineRecord[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Загружаем записи при первом рендере
    const allRecords = WineRecordService.getRecords();
    setRecords(allRecords);
  }, []);

  /**
   * Запрос разрешения на доступ к файловой системе (для Android)
   */
  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android')
      {return true;}
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
  };

  /**
   * Переключает выбор записи по индексу.
   * Если запись уже была выбрана, убираем её из массива.
   * Если не была выбрана, добавляем в массив.
   */
  const toggleSelectRecord = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(item => item !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  /**
   * Выбирает все записи
   */
  const selectAll = () => {
    const allIndices = records.map((_, index) => index);
    setSelectedIndices(allIndices);
  };

  /**
   * Снимает выбор со всех записей
   */
  const unselectAll = () => {
    setSelectedIndices([]);
  };

  /**
   * Получение выбранных записей
   */
  const getSelectedRecords = (): WineRecord[] => {
    return selectedIndices.map(index => records[index]);
  };

  /**
   * Создает подготовленные данные для экспорта с ссылками на изображения
   */
  const prepareExportData = async (selectedRecords: WineRecord[]): Promise<{ data: any[], images: { uri: string, name: string }[] }> => {
    const imagesToExport: { uri: string, name: string }[] = [];

    // Клонируем записи для модификации без изменения оригиналов
    const exportData = JSON.parse(JSON.stringify(selectedRecords));

    // Модифицируем пути к изображениям для экспорта
    for (let i = 0; i < exportData.length; i++) {
      const record = exportData[i];

      // Обработка фото бутылки
      if (record.bottlePhoto) {
        // Получаем расширение файла или используем .jpg по умолчанию
        const extension = record.bottlePhoto.includes('.')
          ? record.bottlePhoto.substring(record.bottlePhoto.lastIndexOf('.'))
          : '.jpg';
        const fileName = `bottle_${i}_${new Date().getTime()}${extension}`;

        // Добавляем в список для копирования
        imagesToExport.push({
          uri: record.bottlePhoto,
          name: fileName,
        });

        // Устанавливаем относительный путь в экспортируемых данных
        exportData[i].bottlePhoto = `exported_images/${fileName}`;
      }

      // Обработка фото этикетки
      if (record.labelPhoto) {
        const extension = record.labelPhoto.includes('.')
          ? record.labelPhoto.substring(record.labelPhoto.lastIndexOf('.'))
          : '.jpg';
        const fileName = `label_${i}_${new Date().getTime()}${extension}`;

        imagesToExport.push({
          uri: record.labelPhoto,
          name: fileName,
        });

        exportData[i].labelPhoto = `exported_images/${fileName}`;
      }

      // Обработка фото контрэтикетки
      if (record.backLabelPhoto) {
        const extension = record.backLabelPhoto.includes('.')
          ? record.backLabelPhoto.substring(record.backLabelPhoto.lastIndexOf('.'))
          : '.jpg';
        const fileName = `backlabel_${i}_${new Date().getTime()}${extension}`;

        imagesToExport.push({
          uri: record.backLabelPhoto,
          name: fileName,
        });

        exportData[i].backLabelPhoto = `exported_images/${fileName}`;
      }

      // Обработка фото плакетки
      if (record.plaquePhoto) {
        const extension = record.plaquePhoto.includes('.')
          ? record.plaquePhoto.substring(record.plaquePhoto.lastIndexOf('.'))
          : '.jpg';
        const fileName = `plaque_${i}_${new Date().getTime()}${extension}`;

        imagesToExport.push({
          uri: record.plaquePhoto,
          name: fileName,
        });

        exportData[i].plaquePhoto = `exported_images/${fileName}`;
      }
    }

    return { data: exportData, images: imagesToExport };
  };

  /**
   * Создает ZIP-архив с данными JSON и фотографиями
   */
  const exportAsZipArchive = async (exportDir: string, jsonPath: string, imagesPaths: string[]): Promise<string> => {
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
  };

  /**
   * Экспорт выбранных записей
   */
  const handleExportSelected = async () => {
    const selectedRecords = getSelectedRecords();

    if (selectedRecords.length === 0) {
      Alert.alert('Информация', 'Не выбрано ни одной записи для экспорта');
      return;
    }

    try {
      setIsLoading(true);

      // Проверка разрешений для Android
      if (Platform.OS === 'android') {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert('Ошибка', 'Нет разрешения на доступ к файловой системе');
          setIsLoading(false);
          return;
        }
      }

      // Подготавливаем данные и список изображений
      const { data, images } = await prepareExportData(selectedRecords);

      // Определяем папки для экспорта на разных платформах
      const timestamp = new Date().getTime();
      const exportDir = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/WineTasting_Selected_${timestamp}`
        : `${RNFS.DocumentDirectoryPath}/WineTasting_Selected_${timestamp}`;

      // Создаём директорию для экспорта
      await RNFS.mkdir(exportDir);

      // Создаём директорию для изображений
      const imagesDir = `${exportDir}/exported_images`;
      await RNFS.mkdir(imagesDir);

      // Копируем все изображения
      let failedImages = 0;
      const successfulImagePaths: string[] = [];

      for (const image of images) {
        try {
          // Нормализуем URI изображения
          const sourceUri = image.uri.replace('file://', '');
          const targetPath = `${imagesDir}/${image.name}`;

          // Проверяем, существует ли фотография по указанному URI
          const fileExists = await RNFS.exists(sourceUri);
          if (fileExists) {
            await RNFS.copyFile(sourceUri, targetPath);
            successfulImagePaths.push(targetPath);
            console.log(`Скопирован файл: ${image.name}`);
          } else {
            failedImages++;
            console.warn(`Файл не найден: ${sourceUri}`);
          }
        } catch (copyError) {
          failedImages++;
          console.error(`Ошибка копирования изображения ${image.name}:`, copyError);
        }
      }

      // Сохраняем JSON с данными
      const jsonPath = `${exportDir}/WineTastingData.json`;
      await RNFS.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8');

      if (failedImages > 0) {
        console.warn(`Не удалось скопировать ${failedImages} из ${images.length} изображений`);
      }

      // Создаем ZIP архив
      const zipPath = await exportAsZipArchive(exportDir, jsonPath, successfulImagePaths);

      // Создаем HTML файл с инструкциями
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
        <h1>Выбранные данные дегустационных заметок</h1>
        <div class="info">
          <p>Файлы успешно экспортированы.</p>
          <p><strong>WineTastingData.json</strong> - содержит выбранные записи в формате JSON</p>
          <p><strong>/exported_images/</strong> - содержит все изображения, на которые ссылаются записи</p>
          <p><strong>WineTastingExport.zip</strong> - архив, содержащий JSON и изображения</p>
          <p>Для импорта данных обратно в приложение используйте функцию импорта.</p>
        </div>
      </body>
      </html>
      `;
      await RNFS.writeFile(htmlPath, htmlContent, 'utf8');

      // Показываем уведомление об успешном экспорте
      const messageText = failedImages > 0
        ? `Выбранные данные успешно экспортированы в папку:\n${exportDir}\n\nНе удалось скопировать некоторые изображения (${failedImages} из ${images.length}).\n\nСоздан ZIP-архив с JSON и изображениями.`
        : `Выбранные данные успешно экспортированы в папку:\n${exportDir}\n\nСоздан ZIP-архив с JSON и изображениями.`;

      Alert.alert(
        'Экспорт выполнен',
        messageText
      );

      // Шарим ZIP-архив
      if (Platform.OS === 'android') {
        try {
          if (FileShareModule) {
            await FileShareModule.shareFile(
              zipPath,
              'application/zip',
              'Экспорт выбранных данных о винах (ZIP)'
            );
          } else {
            const fileUri = `file://${zipPath}`;
            await Share.share({
              title: 'Экспорт выбранных данных о винах (ZIP)',
              message: fileUri,
            });
          }
        } catch (shareError) {
          console.error('Android share error:', shareError);
          Alert.alert('Ошибка шаринга', 'Не удалось поделиться ZIP-архивом');
        }
      } else {
        // Для iOS
        try {
          await Share.share({
            url: `file://${zipPath}`,
            title: 'Выбранные данные дегустационных заметок (ZIP)',
          });
        } catch (shareError) {
          console.error('iOS share error:', shareError);
          Alert.alert('Ошибка шаринга', 'Не удалось поделиться ZIP-архивом');
        }
      }
    } catch (error) {
      console.error('General export error:', error);
      Alert.alert('Ошибка экспорта', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  // Рендер каждого элемента списка
  const renderItem = ({ item, index }: { item: WineRecord; index: number }) => {
    const isSelected = selectedIndices.includes(index);

    // Проверка наличия фотографий
    const hasPhotos = !!item.bottlePhoto || !!item.labelPhoto || !!item.backLabelPhoto || !!item.plaquePhoto;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => toggleSelectRecord(index)}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.wineName}>{item.wineName}</Text>
          <Text style={styles.wineryName}>{item.wineryName}</Text>
          <Text style={styles.itemDetails}>
            {[
              item.harvestYear,
              item.wineType,
              item.color,
              item.region ? `${item.region}${item.country ? `, ${item.country}` : ''}` : item.country,
            ].filter(Boolean).join(' · ')}
          </Text>
          {hasPhotos && (
            <Text style={styles.hasImage}>📷 Есть фото</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Logo />
      <Text style={styles.header}>Выберите записи для экспорта</Text>

      <View style={styles.selectAllContainer}>
        <View style={styles.buttonGroup}>
          <Button
            title="Выбрать все"
            onPress={selectAll}
            color="#3498DB"
            disabled={isLoading || records.length === 0}
          />
        </View>
        <View style={styles.buttonGroup}>
          <Button
            title="Снять все"
            onPress={unselectAll}
            color="#E74C3C"
            disabled={isLoading || selectedIndices.length === 0}
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Выбрано: {selectedIndices.length} из {records.length} записей
        </Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>Нет доступных записей</Text>}
      />

      <View style={styles.buttonContainer}>
        <Button
          title="Экспортировать выбранные"
          onPress={handleExportSelected}
          color="#2ECC71"
          disabled={isLoading || selectedIndices.length === 0}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Отмена"
          onPress={() => navigation.goBack()}
          color="#E74C3C"
          disabled={isLoading}
        />
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text style={styles.loadingText}>Экспорт данных...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectAllContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  buttonGroup: {
    flex: 1,
    marginHorizontal: 5,
  },
  statsContainer: {
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  statsText: {
    fontSize: 14,
    color: '#333333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  checkboxSelected: {
    backgroundColor: '#E1F5FE',
    borderColor: '#3498DB',
  },
  checkmark: {
    fontSize: 16,
    color: '#3498DB',
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
  },
  wineName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  wineryName: {
    fontSize: 14,
    color: '#555555',
    marginTop: 2,
  },
  itemDetails: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
  },
  hasImage: {
    fontSize: 12,
    color: '#2980B9',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#777777',
  },
  buttonContainer: {
    marginVertical: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default ExportSelectScreen;
