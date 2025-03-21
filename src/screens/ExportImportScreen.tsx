import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Share,
  ScrollView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WineRecordService from '../services/WineRecordService';

type ExportImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExportImport'>;

interface FileItem {
  name: string;
  path: string;
}

interface FolderItem {
  name: string;
  path: string;
}

const ExportImportScreen = () => {
  const navigation = useNavigation<ExportImportScreenNavigationProp>();

  // Состояния для управления выбором импорта
  const [showFolderList, setShowFolderList] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);

  const [showFileList, setShowFileList] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);

  /**
   * Экспорт всех записей: создаёт JSON-файл со всеми данными и вызывает системное окно "Поделиться"
   */
  const handleExportAll = async () => {
    try {
      const records = WineRecordService.getRecords();
      const jsonData = JSON.stringify(records, null, 2);
      const filePath = RNFS.DocumentDirectoryPath + '/ExportedWineData.json';
      await RNFS.writeFile(filePath, jsonData, 'utf8');
      await Share.share({
        url: 'file://' + filePath,
        message: 'Экспортированные данные о вине',
        title: 'ExportedWineData.json',
      });
    } catch (error: any) {
      Alert.alert('Ошибка экспорта', error.message);
    }
  };

  /**
   * Переход на экран экспорта выбранных записей
   */
  const handleExportSelected = () => {
    navigation.navigate('ExportSelect');
  };

  /**
   * Функция для загрузки списка папок из базовой директории.
   * Здесь используется RNFS.DownloadDirectoryPath в качестве базового пути.
   */
  const handleSelectFolder = async () => {
    try {
      const basePath = RNFS.DownloadDirectoryPath; // базовая директория для поиска папок (Android)
      const dirItems = await RNFS.readDir(basePath);
      // Фильтруем только директории
      const folderItems = dirItems
        .filter(item => item.isDirectory())
        .map(item => ({ name: item.name, path: item.path }));
      if (folderItems.length === 0) {
        Alert.alert('Информация', 'В базовой директории не найдено папок');
      } else {
        setFolders(folderItems);
        setShowFolderList(true);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', 'Не удалось получить список папок: ' + error.message);
    }
  };

  /**
   * Функция для загрузки списка файлов из выбранной папки.
   * Фильтруются только файлы с расширением .json.
   */
  const handleLoadFilesFromFolder = async (folder: FolderItem) => {
    try {
      const items = await RNFS.readDir(folder.path);
      const jsonFiles = items
        .filter(item => item.isFile() && item.name.endsWith('.json'))
        .map(item => ({ name: item.name, path: item.path }));
      if (jsonFiles.length === 0) {
        Alert.alert('Информация', 'В выбранной папке не найдено JSON-файлов');
      } else {
        setFiles(jsonFiles);
        setShowFileList(true);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', 'Не удалось загрузить файлы: ' + error.message);
    }
  };

  /**
   * Функция импорта данных из выбранного файла.
   * Данные читаются, парсятся и добавляются к существующим записям.
   */
  const handleImportFromFile = async (filePath: string) => {
    try {
      const fileContent = await RNFS.readFile(filePath, 'utf8');
      const parsedData = JSON.parse(fileContent);
      if (Array.isArray(parsedData)) {
        // Добавляем импортированные данные к существующим записям
        const currentRecords = WineRecordService.getRecords();
        const newRecords = currentRecords.concat(parsedData);
        WineRecordService.importRecords(JSON.stringify(newRecords, null, 2));
        Alert.alert('Успех', 'Данные успешно импортированы');
        setShowFileList(false);
        setShowFolderList(false);
        setSelectedFolder(null);
      } else {
        Alert.alert('Ошибка', 'Неверный формат данных в файле');
      }
    } catch (error: any) {
      Alert.alert('Ошибка импорта', 'Не удалось импортировать данные: ' + error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Выберите действие</Text>

      <View style={styles.buttonContainer}>
        <Button
          title="Экспорт всех данных"
          onPress={handleExportAll}
          color="#3498DB"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Экспорт выбранных данных"
          onPress={handleExportSelected}
          color="#2ECC71"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Импорт данных"
          onPress={handleSelectFolder}
          color="#F39C12"
        />
      </View>

      {/* Если выбрана опция импорта и отображается список папок */}
      {showFolderList && !showFileList && (
        <View style={styles.folderListContainer}>
          <Text style={styles.subHeader}>Выберите папку для импорта</Text>
          <FlatList
            data={folders}
            keyExtractor={(item) => item.path}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.folderItem}
                onPress={() => {
                  setSelectedFolder(item);
                  handleLoadFilesFromFolder(item);
                }}
              >
                <Text style={styles.folderName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.buttonContainer}>
            <Button
              title="Отмена"
              onPress={() => setShowFolderList(false)}
              color="#E74C3C"
            />
          </View>
        </View>
      )}

      {/* Если выбрана папка и загружены файлы, показываем список файлов */}
      {showFileList && (
        <View style={styles.fileListContainer}>
          <Text style={styles.subHeader}>Выберите файл для импорта</Text>
          <FlatList
            data={files}
            keyExtractor={(item) => item.path}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.fileItem}
                onPress={() => handleImportFromFile(item.path)}
              >
                <Text style={styles.fileName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.buttonContainer}>
            <Button
              title="Отмена"
              onPress={() => setShowFileList(false)}
              color="#E74C3C"
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default ExportImportScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'stretch',
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
  buttonContainer: {
    marginVertical: 10,
  },
  folderListContainer: {
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
  fileName: {
    fontSize: 16,
  },
});
