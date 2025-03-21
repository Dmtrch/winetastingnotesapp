import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Button,
  Share,
} from 'react-native';
import RNFS from 'react-native-fs';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';

/**
 * Экран ExportSelectScreen:
 * 1. Отображает список всех записей, полученных из WineRecordService.
 * 2. Позволяет выбирать несколько записей (чекбоксы).
 * 3. При нажатии кнопки «Передать» формирует JSON-файл только из выбранных записей
 *    и вызывает стандартное окно «Поделиться» устройства.
 */
const ExportSelectScreen = () => {
  // Список всех записей
  const [records, setRecords] = useState<WineRecord[]>([]);
  // Индексы выбранных записей
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  useEffect(() => {
    // Получаем все записи из сервиса при первом рендере
    const allRecords = WineRecordService.getRecords();
    setRecords(allRecords);
  }, []);

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
   * Формирует JSON-файл только из выбранных записей
   * и вызывает стандартное окно «Поделиться» (Share).
   */
  const handleShareSelected = async () => {
    if (selectedIndices.length === 0) {
      Alert.alert('Информация', 'Выберите хотя бы одну запись');
      return;
    }
    try {
      // Фильтруем записи, оставляя только выбранные
      const selectedRecords = records.filter((_, currentIndex) =>
        selectedIndices.includes(currentIndex),
      );

      // Преобразуем выбранные записи в JSON
      const jsonData = JSON.stringify(selectedRecords, null, 2);

      // Путь к файлу, куда запишем JSON
      const filePath = RNFS.DocumentDirectoryPath + '/SelectedWineData.json';

      // Записываем JSON в файл
      await RNFS.writeFile(filePath, jsonData, 'utf8');

      // Вызываем системное окно «Поделиться»
      await Share.share({
        url: 'file://' + filePath,
        message: 'Данные о вине (выбранные записи)',
        title: 'SelectedWineData.json',
      });
    } catch (error: any) {
      Alert.alert('Ошибка', 'Не удалось передать файл');
    }
  };

  /**
   * Отрисовка одной записи в списке (с чекбоксом).
   */
  const renderItem = ({
    item,
    index,
  }: {
    item: WineRecord;
    index: number;
  }) => {
    const isSelected = selectedIndices.includes(index);
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => toggleSelectRecord(index)}
      >
        <View style={styles.checkbox}>
          {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.itemText}>
          {item.wineryName} / {item.wineName} / {item.harvestYear}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Выберите записи</Text>

      {/* Список записей с прокруткой (если их много) */}
      <FlatList
        data={records}
        keyExtractor={(_, listIndex) => listIndex.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text>Нет записей</Text>}
      />

      {/* Кнопка «Передать» для отправки выбранных записей */}
      <View style={styles.buttonContainer}>
        <Button title="Передать" onPress={handleShareSelected} />
      </View>
    </View>
  );
};

export default ExportSelectScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: 'green',
  },
  itemText: {
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 20,
  },
});
