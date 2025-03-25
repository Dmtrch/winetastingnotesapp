import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Button } from 'react-native';
import RNFS from 'react-native-fs';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';
import Logo from '../components/Logo';

const DeleteScreen = () => {
  // Состояние для списка записей и выбранных индексов
  const [records, setRecords] = useState<WineRecord[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Загружаем записи из сервиса при инициализации экрана
  useEffect(() => {
    const allRecords = WineRecordService.getRecords();
    setRecords(allRecords);
  }, []);

  // Функция для переключения выбора записи
  const toggleSelectRecord = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  // Функция для удаления фотографий
  const deletePhotos = async (record: WineRecord) => {
    try {
      // Массив URI фотографий для удаления
      const photoURIs = [
        record.bottlePhoto,
        record.labelPhoto,
        record.backLabelPhoto,
        record.plaquePhoto,
      ].filter(uri => uri && uri.length > 0);

      for (const uri of photoURIs) {
        if (uri) {  // Дополнительная проверка для TypeScript
          // Убираем префикс 'file://' если есть
          const filePath = uri.replace('file://', '');

          // Проверяем существование файла перед удалением
          const exists = await RNFS.exists(filePath);
          if (exists) {
            await RNFS.unlink(filePath);
            console.log(`Удален файл: ${filePath}`);
          } else {
            console.log(`Файл не найден: ${filePath}`);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении фотографий:', error);
    }
  };

  // Функция для удаления выбранных записей
  const handleDeleteSelected = () => {
    if (selectedIndices.length === 0) {
      Alert.alert('Информация', 'Выберите записи для удаления');
      return;
    }
    Alert.alert(
      'Подтверждение удаления',
      'Вы уверены, что хотите удалить выбранные записи?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const currentRecords = WineRecordService.getRecords();

            // Удаляем фотографии выбранных записей перед удалением самих записей
            for (const index of selectedIndices) {
              const record = currentRecords[index];
              if (record) {
                await deletePhotos(record);
              }
            }

            // Удаляем записи
            const newRecords = currentRecords.filter((_, index) => !selectedIndices.includes(index));
            WineRecordService.importRecords(JSON.stringify(newRecords));
            setRecords(newRecords);
            setSelectedIndices([]);
            Alert.alert('Удаление', 'Выбранные записи удалены');
          },
        },
      ]
    );
  };

  // Функция для удаления всех записей
  const handleDeleteAll = () => {
    Alert.alert(
      'Подтверждение удаления',
      'Вы уверены, что хотите удалить все записи?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить все',
          style: 'destructive',
          onPress: async () => {
            // Удаляем все фотографии перед удалением записей
            const allRecords = WineRecordService.getRecords();
            for (const record of allRecords) {
              await deletePhotos(record);
            }

            // Удаляем все записи
            WineRecordService.deleteAllRecords();
            setRecords([]);
            setSelectedIndices([]);
            Alert.alert('Удаление', 'Все записи удалены');
          },
        },
      ]
    );
  };

  // Отрисовка одного элемента списка с возможностью выбора
  const renderItem = ({ item, index }: { item: WineRecord; index: number }) => {
    const isSelected = selectedIndices.includes(index);
    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => toggleSelectRecord(index)}>
        <View style={styles.checkbox}>
          {isSelected ? <Text style={styles.checkboxText}>✓</Text> : null}
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemText}>Винодельня: {item.wineryName}</Text>
          <Text style={styles.itemText}>Вино: {item.wineName}</Text>
          <Text style={styles.itemText}>Год урожая: {item.harvestYear}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={records}
      keyExtractor={(_, index) => index.toString()}
      renderItem={renderItem}
      ListEmptyComponent={<Text>Нет записей</Text>}
      ListHeaderComponent={
        <>
          <Logo />
          <Text style={styles.header}>Удаление записей</Text>
          <View style={styles.buttonContainer}>
            <Button title="Удалить выбранные записи" onPress={handleDeleteSelected} color="red" />
          </View>
          <View style={styles.buttonContainer}>
            <Button title="Удалить все записи" onPress={handleDeleteAll} color="red" />
          </View>
        </>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#CCCCCC',
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 18,
    color: 'green',
  },
  itemDetails: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    marginBottom: 4,
  },
});

export default DeleteScreen;
