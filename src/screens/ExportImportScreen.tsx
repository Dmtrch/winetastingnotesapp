import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';
import Logo from '../components/Logo';
import ExportHelper from '../services/ExportHelper';
import { EXPORT_FILE_PREFIX } from '../constants/Constants';

// Объявляем тип для полей фотографий
type PhotoField = 'bottlePhoto' | 'labelPhoto' | 'backLabelPhoto' | 'plaquePhoto';

type ExportImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExportImport'>;

interface FileItem {
  name: string;
  path: string;
  isZip?: boolean;
  isWineTastingFile?: boolean; // Добавлено: флаг для файлов WineTasting
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
// Исправлено: Выделение файлов WineTasting и сортировка их сверху
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
            item.isWineTastingFile && styles.wineTastingFileItem, // Новый стиль для файлов WineTasting
          ]}
          onPress={() => onFileSelect(item.path)}
        >
          <Text style={[
            styles.fileName,
            item.isZip && styles.zipFileName,  // Стиль для ZIP-файлов
            item.isWineTastingFile && styles.wineTastingFileName, // Стиль для файлов WineTasting
          ]}>
            {item.isZip ? '📦 ' : '📄 '}{item.name}
            {item.isZip && item.isWineTastingFile && ' (рекомендуется)'}
            {item.isWineTastingFile && !item.isZip && ' (файл приложения)'}
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
    return await ExportHelper.requestStoragePermission();
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
      const exportDirName = `${EXPORT_FILE_PREFIX}_${timestamp}`;
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
      const zipPath = await ExportHelper.exportAsZipArchive(exportDir, jsonPath, successfulImagePaths);

      // Создаем HTML файл с инструкциями
      await ExportHelper.createReadmeHTML(exportDir, failedImages, images.length);

      // Показываем уведомление об успешном экспорте
      const messageText = failedImages > 0
        ? `Данные успешно экспортированы в папку:\n${exportDir}\n\nНе удалось скопировать некоторые изображения (${failedImages} из ${images.length}).\n\nСоздан ZIP-архив с JSON и изображениями.`
        : `Данные успешно экспортированы в папку:\n${exportDir}\n\nСоздан ZIP-архив с JSON и изображениями.`;

      Alert.alert(
        'Экспорт выполнен',
        messageText
      );

      // Шарим ZIP-архив
      await ExportHelper.shareZipFile(zipPath, 'Экспорт данных дегустационных заметок о винах');

      // Планируем удаление временных файлов после завершения
      ExportHelper.cleanupExportFiles(exportDir);
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
              item.isFile() &&
              (
                (item.name.toLowerCase().endsWith('.json') || item.name.toLowerCase().endsWith('.zip')) &&
                item.name.includes('WineTasting')
              )
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
   * Исправлено: Фильтруются только JSON и ZIP файлы, начинающиеся с WineTasting
   */
  const handleLoadFilesFromFolder = async (folder: FolderItem) => {
    try {
      const items = await RNFS.readDir(folder.path);

      // Фильтруем ZIP и JSON файлы, которые начинаются с WineTasting
      const zipFiles = items
        .filter(item =>
          item.isFile() &&
          item.name.toLowerCase().endsWith('.zip') &&
          item.name.startsWith(EXPORT_FILE_PREFIX)
        )
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: true,
          isWineTastingFile: true, // Это файл нашего приложения
        }));

      const jsonFiles = items
        .filter(item =>
          item.isFile() &&
          item.name.toLowerCase().endsWith('.json') &&
          item.name.startsWith(EXPORT_FILE_PREFIX)
        )
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: false,
          isWineTastingFile: true, // Это файл нашего приложения
        }));

      // Добавляем другие JSON и ZIP файлы, которые не начинаются с WineTasting
      const otherZipFiles = items
        .filter(item =>
          item.isFile() &&
          item.name.toLowerCase().endsWith('.zip') &&
          !item.name.startsWith(EXPORT_FILE_PREFIX)
        )
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: true,
          isWineTastingFile: false,
        }));

      const otherJsonFiles = items
        .filter(item =>
          item.isFile() &&
          item.name.toLowerCase().endsWith('.json') &&
          !item.name.startsWith(EXPORT_FILE_PREFIX)
        )
        .map(item => ({
          name: item.name,
          path: item.path,
          isZip: false,
          isWineTastingFile: false,
        }));

      // Сначала отображаем файлы WineTasting, затем остальные
      const importableFiles = [
        ...zipFiles,      // Сначала ZIP-файлы WineTasting
        ...jsonFiles,     // Затем JSON-файлы WineTasting
        ...otherZipFiles, // Затем другие ZIP-файлы
        ...otherJsonFiles, // Затем другие JSON-файлы
      ];

      if (importableFiles.length === 0) {
        Alert.alert('Информация', 'В выбранной папке не найдено ZIP или JSON файлов для импорта');
      } else {
        setFiles(importableFiles);
        setShowFileList(true);
        setSelectedFolder(folder);

        // Если есть файлы WineTasting, выводим подсказку
        if (zipFiles.length > 0 || jsonFiles.length > 0) {
          Alert.alert(
            'Найдены файлы приложения',
            'Найдены файлы, созданные этим приложением. Рекомендуется выбирать ZIP-файлы для импорта с фотографиями.',
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
          const extractResult = await ExportHelper.extractZipArchive(filePath, extractDir);
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

      let parsedData: WineRecord[] = [];
      try {
        parsedData = JSON.parse(jsonContent) as WineRecord[];
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

            for (const field of imageFields as PhotoField[]) {
              const fieldValue = record[field];
              if (fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('exported_images/')) {
                // Проверяем, существует ли файл изображения в указанной директории
                const imagePath = `${imagesDir}/${fieldValue.replace('exported_images/', '')}`;
                const imageExists = await RNFS.exists(imagePath);
                console.log(`Проверка изображения ${field}: ${imagePath}, существует: ${imageExists}`);

                if (imageExists) {
                  // Получаем директорию альбома winetastenote
                  const albumDir = Platform.OS === 'android'
                    ? `${RNFS.PicturesDirectoryPath}/winetastenote`
                    : `${RNFS.DocumentDirectoryPath}/winetastenote`;

                  // Убеждаемся, что директория для изображений существует
                  try {
                    const dirExists = await RNFS.exists(albumDir);
                    if (!dirExists) {
                      await RNFS.mkdir(albumDir);
                      console.log('Создана директория для изображений:', albumDir);
                    }
                  } catch (mkdirError) {
                    console.error('Ошибка создания директории:', mkdirError);
                  }

                  // Формируем имя файла для сохранения в альбом winetastenote
                  const imageFileName = `winetastenote_${new Date().getTime()}_${fieldValue.split('/').pop() || ''}`;
                  const newImagePath = `${albumDir}/${imageFileName}`;

                  try {
                    // Копируем файл изображения в альбом winetastenote
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
                    ExportHelper.cleanupExportFiles(extractDir, 0);
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
                    ExportHelper.cleanupExportFiles(extractDir, 0);
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
                    ExportHelper.cleanupExportFiles(extractDir, 0);
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
            ExportHelper.cleanupExportFiles(extractDir, 0);
          }
        }
      } else {
        Alert.alert('Ошибка', 'Файл не содержит массив записей');
        setIsLoading(false);

        // Удаляем временные файлы после ошибки, если это был ZIP
        if (extractDir) {
          ExportHelper.cleanupExportFiles(extractDir, 0);
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
  wineTastingFileItem: { // Новый стиль для файлов WineTasting
    backgroundColor: '#E0FFF0',
    borderLeftWidth: 3,
    borderLeftColor: '#2ECC71',
  },
  fileName: {
    fontSize: 16,
  },
  zipFileName: {
    fontWeight: 'bold',
    color: '#2980B9',
  },
  wineTastingFileName: { // Новый стиль для имен файлов WineTasting
    fontWeight: 'bold',
    color: '#27AE60',
  },
});

export default ExportImportScreen;
