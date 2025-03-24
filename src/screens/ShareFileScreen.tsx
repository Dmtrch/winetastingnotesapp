import React from 'react';
import { View, Button, Alert, StyleSheet } from 'react-native';
import { Share } from 'react-native';
import RNFS from 'react-native-fs';

const ShareFileScreen = () => {
  const shareFile = async () => {
    try {
      // Путь к файлу, который нужно передать
      const filePath = RNFS.DocumentDirectoryPath + '/ExportedWineData.json';
      // Проверяем, существует ли файл
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        Alert.alert('Ошибка', 'Файл не найден. Сначала экспортируйте данные.');
        return;
      }
      // Вызываем системное окно «Поделиться» с файлом
      await Share.share({
        url: 'file://' + filePath,
        title: 'Экспортированные данные',
      });
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Поделиться файлом" onPress={shareFile} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ShareFileScreen;
