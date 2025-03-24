import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Share,
  FlatList,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  NativeModules,
  ActivityIndicator,
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

type ExportImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExportImport'>;

interface FileItem {
  name: string;
  path: string;
  isZip?: boolean;
}

interface FolderItem {
  name: string;
  path: string;
  id: string; // Уникальный ID для решения проблемы с дублированными ключами
}

// Компонент для отображения списка папок
const FolderListView = ({
  folders,
  onFolderSelect,
  onCancel,
}: {
  folders: FolderItem[];
  onFolderSelect: (folder: FolderItem) => void;
  onCancel: () => void
}) => (
  <View style={styles.folderListContainer}>
    <Text style={styles.subHeader}>Выберите папку для импорта</Text>
    <FlatList
      data={folders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.folderItem}
          onPress={() => onFolderSelect(item)}
        >
          <Text style={styles.folderName}>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
    <View style={styles.buttonContainer}>
      <Button
        title="Отмена"
        onPress={onCancel}
        color="#E74C3C"
      />
    </View>
  </View>
);

// Компонент для отображения списка файлов
const FileListView = ({
  files,
  selectedFolder,
  onFileSelect,
  onBack,
  onCancel,
}: {
  files: FileItem[];
  selectedFolder: FolderItem | null;
  onFileSelect: (filePath: string) => void;
  onBack: () => void;
  onCancel: () => void
}) => (
  <View style={styles.fileListContainer}>
    <Text style={styles.subHeader}>
      Выберите файл для импорта
      {selectedFolder ? ` из ${selectedFolder.name}` : ''}
    </Text>
    <Text style={styles.importHint}>
      Рекомендуется выбирать ZIP-файлы для импорта с фотографиями
    </Text>
    <FlatList
      data={files}
      keyExtractor={(item, index) => `${item.path}_${index}`}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.fileItem,
            item.isZip && styles.zipFileItem,  // Выделяем ZIP-файлы
          ]}
          onPress={() => onFileSelect(item.path)}
        >
          <Text style={[
            styles.fileName,
            item.isZip && styles.zipFileName,  // Стиль для ZIP-файлов
          ]}>
            {item.isZip ? '📦 ' : '📄 '}{item.name}
            {item.isZip && ' (рекомендуется)'}
          </Text>
        </TouchableOpacity>
      )}
    />
    <View style={styles.buttonContainer}>
      <Button
        title="Назад к папкам"
        onPress={onBack}
        color="#3498DB"
      />
    </View>
    <View style={styles.buttonContainer}>
      <Button
        title="Отмена"
        onPress={onCancel}
        color="#E74C3C"
      />
    </View>
  </View>
);

const ExportImportScreen = () => {
  const navigation = useNavigation<ExportImportScreenNavigationProp>();

  // Состояния для управления выбором импорта
  const [showFolderList, setShowFolderList] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [showFileList, setShowFileList] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
   * Создает подготовленные данные для экспорта с ссылками на изображения
   */
  const prepareExportData = async (records: WineRecord[]): Promise<{ data: any[], images: { uri: string, name: string }[] }> => {
    const imagesToExport: { uri: string, name: string }[] = [];

    // Клонируем записи для модификации без изменения оригиналов
    const exportData = JSON.parse(JSON.stringify(records));

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
   * Экспорт всех записей: создаёт ZIP-архив с JSON-файлом и изображениями
   */
  const handleExportWithPhotos = async () => {
    try {
      setIsLoading(true);
      const recordsToExport = WineRecordService.getRecords();

      // Проверка разрешений для Android
      if (Platform.OS === 'android') {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert('Ошибка', 'Нет разрешения на доступ к файловой системе');
          setIsLoading(false);
          return;
        }
      }

      if (recordsToExport.length === 0) {
        Alert.alert('Информация', 'Нет записей для экспорта');
        setIsLoading(false);
        return;
      }

      // Подготавливаем данные и список изображений
      const { data, images } = await prepareExportData(recordsToExport);

      // Определяем папки для экспорта на разных платформах
      const timestamp = new Date().getTime();
      const exportDirName = `WineTasting_${timestamp}`;
      const exportDir = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/${exportDirName}`
        : `${RNFS.DocumentDirectoryPath}/${exportDirName}`;

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
      const jsonFileName = 'WineTastingData.json';
      const jsonPath = `${exportDir}/${jsonFileName}`;
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

      // Показываем уведомление об успешном экспорте
      const messageText = failedImages > 0
        ? `Данные успешно экспортированы в папку:\n${exportDir}\n\nНе удалось скопировать некоторые изображения (${failedImages} из ${images.length}).\n\nСоздан ZIP-архив с JSON и изображениями.`
        : `Данные успешно экспортированы в папку:\n${exportDir}\n\nСоздан ZIP-архив с JSON и изображениями.`;

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
              'Экспорт данных дегустационных заметок о винах'
            );
          } else {
            // На некоторых устройствах Android нужен дополнительный префикс
            const fileUri = zipPath.startsWith('file://') ? zipPath : `file://${zipPath}`;

            const result = await Share.share({
              title: 'Экспорт данных о винах (ZIP)',
              message: 'Прикрепляю экспортированные данные о винах',
              url: fileUri, // некоторые приложения ожидают параметр url
            }, {
              dialogTitle: 'Поделиться ZIP-архивом с данными',
              subject: 'Экспортированные данные о винах',
            });

            if (result.action === Share.sharedAction) {
              console.log('Shared successfully');
            }
          }
        } catch (shareError) {
          console.error('Android share error:', shareError);

          // Если стандартный шаринг не работает, предложим пользователю
          // путь к файлу для ручного доступа
          Alert.alert(
            'Информация о файле',
            `ZIP-архив с данными сохранен в:\n${zipPath}\n\nВы можете найти этот файл через Файловый менеджер.`
          );
        }
      } else {
        // Для iOS
        try {
          await Share.share({
            url: zipPath.startsWith('file://') ? zipPath : `file://${zipPath}`,
            title: 'Данные дегустационных заметок (ZIP)',
          }, {
            subject: 'Экспортированные данные о винах',
            excludedActivityTypes: [
              'com.apple.UIKit.activity.Print',
              'com.apple.UIKit.activity.AssignToContact',
            ],
          });
        } catch (shareError) {
          console.error('iOS share error:', shareError);
          Alert.alert('Информация о файле', `ZIP-архив с данными сохранен в:\n${zipPath}`);
        }
      }
    } catch (error) {
      console.error('General export error:', error);
      Alert.alert('Ошибка экспорта', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Переход на экран экспорта выбранных записей
   */
  const handleExportSelected = () => {
    const records = WineRecordService.getRecords();
    if (records.length === 0) {
      Alert.alert('Информация', 'Нет записей для экспорта');
      return;
    }
    navigation.navigate('ExportSelect');
  };

  /**
   * Выбор базовой директории в зависимости от платформы
   */
  const getBaseDirectory = (): string => {
    if (Platform.OS === 'android') {
      // На Android используем основную директорию или Downloads
      return RNFS.ExternalStorageDirectoryPath;
    } else {
      // На iOS используем директорию документов
      return RNFS.DocumentDirectoryPath;
    }
  };

  /**
   * Распаковка ZIP-архива
   */
  const extractZipArchive = async (zipPath: string, extractDir: string): Promise<{jsonPath: string, imagesDir: string}> => {
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
  };

  /**
   * Функция для загрузки списка папок из базовой директории.
   */
  const handleSelectFolder = async () => {
    try {
      // Проверка разрешений для Android
      if (Platform.OS === 'android') {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert('Ошибка', 'Нет разрешения на доступ к файловой системе');
          return;
        }
      }

      const basePath = getBaseDirectory();

      try {
        const dirItems = await RNFS.readDir(basePath);

        // Добавляем текущую директорию
        const currentDir: FolderItem = {
          name: 'Текущая директория',
          path: basePath,
          id: 'current_dir',
        };

        // Добавляем директорию загрузок, если она отличается от базовой
        let downloadDir: FolderItem | null = null;
        if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath !== basePath) {
          downloadDir = {
            name: 'Загрузки',
            path: RNFS.DownloadDirectoryPath,
            id: 'download_dir',
          };
        }

        // Фильтруем только директории и добавляем ID
        const folderItems = dirItems
          .filter(item => item.isDirectory())
          .map((item, index) => ({
            name: item.name,
            path: item.path,
            id: `dir_${index}_${item.name}`,
          }));

        // Составляем полный список директорий
        let allFolders: FolderItem[] = [currentDir];

        if (downloadDir) {
          allFolders.push(downloadDir);
        }

        allFolders = [...allFolders, ...folderItems];

        if (allFolders.length === 0) {
          Alert.alert('Информация', 'В базовой директории не найдено папок');
        } else {
          setFolders(allFolders);
          setShowFolderList(true);
        }
      } catch (error) {
        console.error('Error reading directory:', error);

        // Если не можем прочитать базовую директорию, пробуем загрузки
        if (Platform.OS === 'android') {
          try {
            // Получаем список файлов в директории загрузок
            const downloadDirItems = await RNFS.readDir(RNFS.DownloadDirectoryPath);

            // Проверяем наличие JSON и ZIP файлов в папке загрузок
            const hasImportableFiles = downloadDirItems.some(item =>
              item.isFile() && (item.name.toLowerCase().endsWith('.json') || item.name.toLowerCase().endsWith('.zip'))
            );

            const downloadDir: FolderItem = {
              name: hasImportableFiles ? 'Загрузки (есть файлы для импорта)' : 'Загрузки',
              path: RNFS.DownloadDirectoryPath,
              id: 'download_dir',
            };

            setFolders([downloadDir]);
            setShowFolderList(true);
          } catch (downloadError) {
            Alert.alert('Ошибка', 'Не удалось получить доступ к файловой системе');
          }
        } else {
          Alert.alert('Ошибка', 'Не удалось получить список папок');
        }
      }
    } catch (mainError) {
      console.error('Main directory error:', mainError);
      Alert.alert('Ошибка', 'Не удалось получить список папок');
    }
  };

  /**
   * Функция для загрузки списка файлов из выбранной папки.
   * Фильтруются только JSON и ZIP файлы.
   */
  const handleLoadFilesFromFolder = async (folder: FolderItem) => {
    try {
      const items = await RNFS.readDir(folder.path);

      // Фильтруем ZIP и JSON файлы
      const zipFiles = items
        .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.zip'))
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: true,
        }));

      const jsonFiles = items
        .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.json'))
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: false,
        }));

      // Объединяем, сначала показывая ZIP файлы
      const importableFiles = [...zipFiles, ...jsonFiles];

      if (importableFiles.length === 0) {
        Alert.alert('Информация', 'В выбранной папке не найдено ZIP или JSON файлов для импорта');
      } else {
        setFiles(importableFiles);
        setShowFileList(true);
        setSelectedFolder(folder);

        // Если есть и ZIP и JSON, рекомендуем ZIP
        if (zipFiles.length > 0 && jsonFiles.length > 0) {
          Alert.alert(
            'Рекомендация',
            'Рекомендуется выбирать ZIP-файлы для импорта, так как они содержат не только данные, но и фотографии',
            [{ text: 'Понятно', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error loading files:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить файлы из выбранной папки');
    }
  };

  /**
   * Функция импорта данных из выбранного файла с поддержкой относительных изображений.
   */
  const handleImportFromFile = async (filePath: string) => {
    try {
      setIsLoading(true);

      let jsonContent: string;
      let imagesDir: string = '';
      let isZipFile = filePath.toLowerCase().endsWith('.zip');
      let extractDir = '';

      // Если импортируем ZIP-файл
      if (isZipFile) {
        try {
          extractDir = `${RNFS.DocumentDirectoryPath}/WineTasting_Import_${new Date().getTime()}`;
          const extractResult = await extractZipArchive(filePath, extractDir);
          jsonContent = await RNFS.readFile(extractResult.jsonPath, 'utf8');
          imagesDir = extractResult.imagesDir;
        } catch (zipError) {
          console.error('Ошибка распаковки ZIP:', zipError);
          Alert.alert('Ошибка импорта', 'Не удалось распаковать ZIP архив');
          setIsLoading(false);
          return;
        }
      } else {
        // Если импортируем JSON-файл
        jsonContent = await RNFS.readFile(filePath, 'utf8');
        // Получаем директорию, где находится JSON-файл
        imagesDir = filePath.substring(0, filePath.lastIndexOf('/')) + '/exported_images';
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonContent);
      } catch (parseError) {
        Alert.alert('Ошибка', 'Файл содержит некорректный JSON-формат');
        setIsLoading(false);
        return;
      }

      if (Array.isArray(parsedData)) {
        // Проверяем структуру данных
        if (parsedData.length > 0 &&
            typeof parsedData[0] === 'object' &&
            parsedData[0] !== null &&
            'wineName' in parsedData[0] &&
            'wineryName' in parsedData[0]) {

          // Обрабатываем относительные пути к изображениям
          for (let i = 0; i < parsedData.length; i++) {
            const record = parsedData[i];
            console.log(`Обработка записи ${i + 1}/${parsedData.length}: ${record.wineName}`);

            // Обрабатываем все 4 поля изображений
            const imageFields = ['bottlePhoto', 'labelPhoto', 'backLabelPhoto', 'plaquePhoto'];

            for (const field of imageFields) {
              if (record[field] && typeof record[field] === 'string' && record[field].startsWith('exported_images/')) {
                // Проверяем, существует ли файл изображения в указанной директории
                const imagePath = `${imagesDir}/${record[field].replace('exported_images/', '')}`;
                const imageExists = await RNFS.exists(imagePath);
                console.log(`Проверка изображения ${field}: ${imagePath}, существует: ${imageExists}`);

                if (imageExists) {
                  // Копируем изображение в постоянную директорию приложения
                  const imageFileName = record[field].split('/').pop() || '';
                  const appImagesDir = `${RNFS.DocumentDirectoryPath}/images`;

                  // Убеждаемся, что директория для изображений существует
                  try {
                    const dirExists = await RNFS.exists(appImagesDir);
                    if (!dirExists) {
                      await RNFS.mkdir(appImagesDir);
                      console.log('Создана директория для изображений:', appImagesDir);
                    }
                  } catch (mkdirError) {
                    console.error('Ошибка создания директории:', mkdirError);
                  }

                  const newImagePath = `${appImagesDir}/${imageFileName}`;
                  try {
                    // Копируем файл изображения
                    await RNFS.copyFile(imagePath, newImagePath);
                    console.log(`Изображение скопировано: ${newImagePath}`);

                    // Обновляем путь к изображению с file:// префиксом
                    parsedData[i][field] = `file://${newImagePath}`;
                  } catch (copyError) {
                    console.error(`Ошибка копирования ${field}:`, copyError);
                    // Если копирование не удалось, очищаем поле
                    parsedData[i][field] = '';
                  }
                } else {
                  console.log(`Не найдено изображение: ${imagePath}`);
                  // Если изображение не найдено, очищаем поле
                  parsedData[i][field] = '';
                }
              }
            }
          }

          const currentRecords = WineRecordService.getRecords();

          // Опция импорта: заменить все или добавить
          Alert.alert(
            'Импорт данных',
            `Найдено ${parsedData.length} записей. Как импортировать данные?`,
            [
              {
                text: 'Заменить все',
                onPress: () => {
                  WineRecordService.importRecords(JSON.stringify(parsedData));
                  Alert.alert('Успех', `Данные импортированы, загружено ${parsedData.length} записей`);
                  setShowFileList(false);
                  setShowFolderList(false);
                  setSelectedFolder(null);
                  setIsLoading(false);

                  // Удаляем временные файлы после импорта, если это был ZIP
                  if (extractDir) {
                    RNFS.unlink(extractDir)
                      .catch(err => console.error('Ошибка удаления временных файлов:', err));
                  }
                },
              },
              {
                text: 'Добавить к существующим',
                onPress: () => {
                  const newRecords = currentRecords.concat(parsedData);
                  WineRecordService.importRecords(JSON.stringify(newRecords));
                  Alert.alert('Успех', `Данные добавлены, всего записей: ${newRecords.length}`);
                  setShowFileList(false);
                  setShowFolderList(false);
                  setSelectedFolder(null);
                  setIsLoading(false);

                  // Удаляем временные файлы после импорта, если это был ZIP
                  if (extractDir) {
                    RNFS.unlink(extractDir)
                      .catch(err => console.error('Ошибка удаления временных файлов:', err));
                  }
                },
              },
              {
                text: 'Отмена',
                style: 'cancel',
                onPress: () => {
                  setIsLoading(false);

                  // Удаляем временные файлы после отмены, если это был ZIP
                  if (extractDir) {
                    RNFS.unlink(extractDir)
                      .catch(err => console.error('Ошибка удаления временных файлов:', err));
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert('Ошибка', 'Файл не содержит данные в нужном формате');
          setIsLoading(false);

          // Удаляем временные файлы после ошибки, если это был ZIP
          if (extractDir) {
            RNFS.unlink(extractDir)
              .catch(err => console.error('Ошибка удаления временных файлов:', err));
          }
        }
      } else {
        Alert.alert('Ошибка', 'Файл не содержит массив записей');
        setIsLoading(false);

        // Удаляем временные файлы после ошибки, если это был ZIP
        if (extractDir) {
          RNFS.unlink(extractDir)
            .catch(err => console.error('Ошибка удаления временных файлов:', err));
        }
      }
    } catch (error) {
      console.error('Error importing file:', error);
      Alert.alert('Ошибка импорта', 'Не удалось прочитать файл или импортировать данные');
      setIsLoading(false);
    }
  };

  /**
   * Сбросить все состояния выбора
   */
  const resetSelections = () => {
    setShowFileList(false);
    setShowFolderList(false);
    setSelectedFolder(null);
    setFiles([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Logo />
      <Text style={styles.header}>Экспорт и импорт данных</Text>

      <View style={styles.buttonContainer}>
        <Button
          title="Экспорт всех данных"
          onPress={handleExportWithPhotos}
          color="#3498DB"
          disabled={isLoading}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Экспорт выбранных данных"
          onPress={handleExportSelected}
          color="#2ECC71"
          disabled={isLoading}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Импорт данных"
          onPress={handleSelectFolder}
          color="#F39C12"
          disabled={isLoading}
        />
      </View>

      {/* Загрузочный индикатор */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Пожалуйста, подождите...</Text>
        </View>
      )}

      {/* Если выбрана опция импорта и отображается список папок */}
      {showFolderList && !showFileList && !isLoading && (
        <FolderListView
          folders={folders}
          onFolderSelect={handleLoadFilesFromFolder}
          onCancel={() => setShowFolderList(false)}
        />
      )}

      {/* Если выбрана папка и загружены файлы, показываем список файлов */}
      {showFileList && !isLoading && (
        <FileListView
          files={files}
          selectedFolder={selectedFolder}
          onFileSelect={handleImportFromFile}
          onBack={() => {
            setShowFileList(false);
            setSelectedFolder(null);
          }}
          onCancel={resetSelections}
        />
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
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 10,
    textAlign: 'center',
  },
  importHint: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  buttonContainer: {
    marginVertical: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  folderListContainer: {
    flex: 1,
    marginTop: 20,
    borderTopWidth: 1,
    borderColor: '#CCCCCC',
    paddingTop: 10,
  },
  folderItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  folderName: {
    fontSize: 16,
  },
  fileListContainer: {
    flex: 1,
    marginTop: 20,
    borderTopWidth: 1,
    borderColor: '#CCCCCC',
    paddingTop: 10,
  },
  fileItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  zipFileItem: {
    backgroundColor: '#E8F4FD',
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
  },
  fileName: {
    fontSize: 16,
  },
  zipFileName: {
    fontWeight: 'bold',
    color: '#2980B9',
  },
});

export default ExportImportScreen;
