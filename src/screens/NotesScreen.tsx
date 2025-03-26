import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import RNFS from 'react-native-fs';
import Logo from '../components/Logo';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';
import PhotoService from '../services/PhotoService';
import { RECORDS_FILENAME } from '../constants/Constants';

const NotesScreen = () => {
  // Основные данные
  const [wineryName, setWineryName] = useState('');
  const [wineName, setWineName] = useState('');
  const [harvestYear, setHarvestYear] = useState('');
  const [bottlingYear, setBottlingYear] = useState('');
  const [grapeVarietiesInput, setGrapeVarietiesInput] = useState(''); // Формат: "сорт:процент, сорт:процент"
  const [winemaker, setWinemaker] = useState('');
  const [owner, setOwner] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [sugarContent, setSugarContent] = useState('');
  const [alcoholContent, setAlcoholContent] = useState('');
  const [wineType, setWineType] = useState('');
  const [wineStyle, setWineStyle] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  // Дегустация
  const [appearanceNotes, setAppearanceNotes] = useState('');
  const [density, setDensity] = useState('');
  const [initialNose, setInitialNose] = useState('');
  const [aromaAfterAeration, setAromaAfterAeration] = useState('');
  const [taste, setTaste] = useState('');
  const [tannins, setTannins] = useState('');
  const [acidity, setAcidity] = useState('');
  const [sweetness, setSweetness] = useState('');
  const [balance, setBalance] = useState('');
  const [associations, setAssociations] = useState('');
  const [consumptionDate, setConsumptionDate] = useState('');
  // Личный вердикт
  const [personalVerdict, setPersonalVerdict] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  // Фотографии (URI получаются через камеру)
  const [bottlePhoto, setBottlePhoto] = useState('');
  const [labelPhoto, setLabelPhoto] = useState('');
  const [backLabelPhoto, setBackLabelPhoto] = useState('');
  const [plaquePhoto, setPlaquePhoto] = useState('');

  // Функция запуска камеры для конкретного поля фотографии
  const handleTakePhoto = async (photoType: 'bottlePhoto' | 'labelPhoto' | 'backLabelPhoto' | 'plaquePhoto') => {
    const uri = await PhotoService.takePhoto();

    if (uri) {
      if (photoType === 'bottlePhoto') {
        // Если уже было фото, удаляем его
        if (bottlePhoto) {
          await PhotoService.deletePhoto(bottlePhoto);
        }
        setBottlePhoto(uri);
      } else if (photoType === 'labelPhoto') {
        // Если уже было фото, удаляем его
        if (labelPhoto) {
          await PhotoService.deletePhoto(labelPhoto);
        }
        setLabelPhoto(uri);
      } else if (photoType === 'backLabelPhoto') {
        // Если уже было фото, удаляем его
        if (backLabelPhoto) {
          await PhotoService.deletePhoto(backLabelPhoto);
        }
        setBackLabelPhoto(uri);
      } else if (photoType === 'plaquePhoto') {
        // Если уже было фото, удаляем его
        if (plaquePhoto) {
          await PhotoService.deletePhoto(plaquePhoto);
        }
        setPlaquePhoto(uri);
      }
    }
  };

  // Функция сохранения записи и записи данных в файл
  const handleSave = async () => {
    try {
      // Проверяем наличие обязательных полей
      if (!wineryName || !wineName) {
        Alert.alert('Ошибка', 'Пожалуйста, заполните название винодельни и название вина');
        return;
      }

      // Преобразование сортов винограда
      const grapeVarieties = grapeVarietiesInput
        .split(',')
        .map(item => {
          const [variety, percentage] = item.split(':').map(s => s.trim());
          return { variety, percentage: Number(percentage) || 0 };
        })
        .filter(item => item.variety);

      const newRecord: WineRecord = {
        wineryName,
        wineName,
        harvestYear,
        bottlingYear,
        grapeVarieties,
        winemaker,
        owner,
        country,
        region,
        sugarContent: Number(sugarContent) || 0,
        alcoholContent: Number(alcoholContent) || 0,
        wineType: wineType as WineRecord['wineType'],
        wineStyle: wineStyle as WineRecord['wineStyle'],
        color: color as WineRecord['color'],
        price: Number(price) || 0,
        appearanceNotes,
        density,
        initialNose,
        aromaAfterAeration,
        taste,
        tannins,
        acidity,
        sweetness,
        balance,
        associations,
        consumptionDate,
        personalVerdict,
        additionalNotes,
        bottlePhoto,
        labelPhoto,
        backLabelPhoto,
        plaquePhoto: plaquePhoto || '',
      };

      // Добавляем запись в сервис
      WineRecordService.addRecord(newRecord);

      // Сохранение всех записей в файл (например, в documents)
      const filePath = RNFS.DocumentDirectoryPath + '/' + RECORDS_FILENAME;
      try {
        await RNFS.writeFile(filePath, JSON.stringify(WineRecordService.getRecords(), null, 2), 'utf8');
        Alert.alert('Успех', 'Запись сохранена и данные записаны');
      } catch (error) {
        console.error('Ошибка при сохранении файла с записями:', error);
        Alert.alert('Ошибка', 'Не удалось сохранить файл с записями');
      }

      // Очистка формы
      clearForm();
    } catch (error) {
      console.error('Ошибка при сохранении записи:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить запись: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    }
  };

  // Функция очистки формы
  const clearForm = () => {
    setWineryName('');
    setWineName('');
    setHarvestYear('');
    setBottlingYear('');
    setGrapeVarietiesInput('');
    setWinemaker('');
    setOwner('');
    setCountry('');
    setRegion('');
    setSugarContent('');
    setAlcoholContent('');
    setWineType('');
    setWineStyle('');
    setColor('');
    setPrice('');
    setAppearanceNotes('');
    setDensity('');
    setInitialNose('');
    setAromaAfterAeration('');
    setTaste('');
    setTannins('');
    setAcidity('');
    setSweetness('');
    setBalance('');
    setAssociations('');
    setConsumptionDate('');
    setPersonalVerdict('');
    setAdditionalNotes('');
    // Не удаляем фотографии при очистке формы, т.к. они уже сохранены в записи
    setBottlePhoto('');
    setLabelPhoto('');
    setBackLabelPhoto('');
    setPlaquePhoto('');
  };

  return (
    <ScrollView style={styles.container}>
      <Logo />

      {/* Основная информация */}
      <Text style={styles.sectionHeader}>Основная информация</Text>
      <Text>Название винодельни:</Text>
      <TextInput
        style={styles.input}
        value={wineryName}
        onChangeText={setWineryName}
        placeholder="Введите название винодельни"
      />
      <Text>Название вина:</Text>
      <TextInput
        style={styles.input}
        value={wineName}
        onChangeText={setWineName}
        placeholder="Введите название вина"
      />
      <Text>Год урожая:</Text>
      <TextInput
        style={styles.input}
        value={harvestYear}
        onChangeText={setHarvestYear}
        placeholder="Введите год урожая"
        keyboardType="numeric"
      />
      <Text>Год розлива:</Text>
      <TextInput
        style={styles.input}
        value={bottlingYear}
        onChangeText={setBottlingYear}
        placeholder="Введите год розлива"
        keyboardType="numeric"
      />
      <Text>Сорта винограда и % содержания (формат: сорт:процент, сорт:процент):</Text>
      <TextInput
        style={styles.input}
        value={grapeVarietiesInput}
        onChangeText={setGrapeVarietiesInput}
        placeholder="например: Каберне:60, Мерло:40"
      />
      <Text>Винодел:</Text>
      <TextInput
        style={styles.input}
        value={winemaker}
        onChangeText={setWinemaker}
        placeholder="Введите имя винодела"
      />
      <Text>Собственник:</Text>
      <TextInput
        style={styles.input}
        value={owner}
        onChangeText={setOwner}
        placeholder="Введите имя собственника"
      />
      <Text>Страна:</Text>
      <TextInput
        style={styles.input}
        value={country}
        onChangeText={setCountry}
        placeholder="Введите страну"
      />
      <Text>Регион:</Text>
      <TextInput
        style={styles.input}
        value={region}
        onChangeText={setRegion}
        placeholder="Введите регион"
      />
      <Text>Содержание сахара (%):</Text>
      <TextInput
        style={styles.input}
        value={sugarContent}
        onChangeText={setSugarContent}
        placeholder="Введите содержание сахара"
        keyboardType="numeric"
      />
      <Text>Содержание спирта (%):</Text>
      <TextInput
        style={styles.input}
        value={alcoholContent}
        onChangeText={setAlcoholContent}
        placeholder="Введите содержание спирта"
        keyboardType="numeric"
      />
      <Text>Вид вина (сухое, полусухое, полусладкое, сладкое, десертное):</Text>
      <TextInput
        style={styles.input}
        value={wineType}
        onChangeText={setWineType}
        placeholder="Введите вид вина"
      />
      <Text>Тип вина (тихое, игристое):</Text>
      <TextInput
        style={styles.input}
        value={wineStyle}
        onChangeText={setWineStyle}
        placeholder="Введите тип вина"
      />
      <Text>Цвет вина (красное, белое, розовое, оранж, глу-глу, другое):</Text>
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="Введите цвет вина"
      />
      <Text>Цена:</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="Введите цену"
        keyboardType="numeric"
      />

      {/* Дегустация */}
      <Text style={styles.sectionHeader}>Дегустация</Text>
      <Text>Цвет (заметки):</Text>
      <TextInput
        style={styles.input}
        value={appearanceNotes}
        onChangeText={setAppearanceNotes}
        placeholder="Введите заметки о цвете"
      />
      <Text>Плотность:</Text>
      <TextInput
        style={styles.input}
        value={density}
        onChangeText={setDensity}
        placeholder="Введите плотность"
      />
      <Text>Первый нос (без аэрации):</Text>
      <TextInput
        style={styles.input}
        value={initialNose}
        onChangeText={setInitialNose}
        placeholder="Введите описание первого носа"
      />
      <Text>Аромат после аэрации:</Text>
      <TextInput
        style={styles.input}
        value={aromaAfterAeration}
        onChangeText={setAromaAfterAeration}
        placeholder="Введите аромат после аэрации"
      />
      <Text>Вкус (спиртуозность):</Text>
      <TextInput
        style={styles.input}
        value={taste}
        onChangeText={setTaste}
        placeholder="Введите описание вкуса"
      />
      <Text>Танины:</Text>
      <TextInput
        style={styles.input}
        value={tannins}
        onChangeText={setTannins}
        placeholder="Введите описание танинов"
      />
      <Text>Кислотность:</Text>
      <TextInput
        style={styles.input}
        value={acidity}
        onChangeText={setAcidity}
        placeholder="Введите кислотность"
      />
      <Text>Сладость:</Text>
      <TextInput
        style={styles.input}
        value={sweetness}
        onChangeText={setSweetness}
        placeholder="Введите сладость"
      />
      <Text>Баланс:</Text>
      <TextInput
        style={styles.input}
        value={balance}
        onChangeText={setBalance}
        placeholder="Введите баланс"
      />
      <Text>Ассоциации:</Text>
      <TextInput
        style={styles.input}
        value={associations}
        onChangeText={setAssociations}
        placeholder="Введите ассоциации"
      />
      <Text>Дата потребления:</Text>
      <TextInput
        style={styles.input}
        value={consumptionDate}
        onChangeText={setConsumptionDate}
        placeholder="Введите дату потребления"
      />

      {/* Личный вердикт */}
      <Text style={styles.sectionHeader}>Личный вердикт</Text>
      <Text>Моё/не моё, брать/не брать:</Text>
      <TextInput
        style={styles.input}
        value={personalVerdict}
        onChangeText={setPersonalVerdict}
        placeholder="Введите вердикт"
      />
      <Text>Прочее:</Text>
      <TextInput
        style={styles.input}
        value={additionalNotes}
        onChangeText={setAdditionalNotes}
        placeholder="Введите дополнительные заметки"
      />

      {/* Фотографии */}
      <Text style={styles.sectionHeader}>Фотографии</Text>
      <Text style={styles.photoLabel}>Фотография бутылки:</Text>
      <View style={styles.photoContainer}>
        {bottlePhoto ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: bottlePhoto }} style={styles.photoThumbnail} />
            <Button
              title="Изменить"
              onPress={() => handleTakePhoto('bottlePhoto')}
            />
          </View>
        ) : (
          <Button
            title="Сделать фото бутылки"
            onPress={() => handleTakePhoto('bottlePhoto')}
          />
        )}
      </View>

      <Text style={styles.photoLabel}>Фотография этикетки:</Text>
      <View style={styles.photoContainer}>
        {labelPhoto ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: labelPhoto }} style={styles.photoThumbnail} />
            <Button
              title="Изменить"
              onPress={() => handleTakePhoto('labelPhoto')}
            />
          </View>
        ) : (
          <Button
            title="Сделать фото этикетки"
            onPress={() => handleTakePhoto('labelPhoto')}
          />
        )}
      </View>

      <Text style={styles.photoLabel}>Фотография контрэтикетки:</Text>
      <View style={styles.photoContainer}>
        {backLabelPhoto ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: backLabelPhoto }} style={styles.photoThumbnail} />
            <Button
              title="Изменить"
              onPress={() => handleTakePhoto('backLabelPhoto')}
            />
          </View>
        ) : (
          <Button
            title="Сделать фото контрэтикетки"
            onPress={() => handleTakePhoto('backLabelPhoto')}
          />
        )}
      </View>

      <Text style={styles.photoLabel}>Фотография плакетки (для игристого вина):</Text>
      <View style={styles.photoContainer}>
        {plaquePhoto ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: plaquePhoto }} style={styles.photoThumbnail} />
            <Button
              title="Изменить"
              onPress={() => handleTakePhoto('plaquePhoto')}
            />
          </View>
        ) : (
          <Button
            title="Сделать фото плакетки"
            onPress={() => handleTakePhoto('plaquePhoto')}
          />
        )}
      </View>

      {/* Кнопка сохранения */}
      <View style={styles.buttonContainer}>
        <Button title="Сохранить" onPress={handleSave} />
      </View>

      {/* Кнопка очистки формы */}
      <View style={styles.buttonContainer}>
        <Button
          title="Очистить форму"
          onPress={() => {
            Alert.alert(
              'Подтверждение',
              'Вы действительно хотите очистить все поля?',
              [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Очистить', style: 'destructive', onPress: clearForm },
              ]
            );
          }}
          color="#E74C3C"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#2980B9',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 5,
  },
  input: {
    height: 40,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  photoLabel: {
    marginBottom: 5,
    fontWeight: '500',
  },
  photoContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  photoWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  photoThumbnail: {
    width: 200,
    height: 200,
    resizeMode: 'cover',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  buttonContainer: {
    marginVertical: 10,
  },
});

export default NotesScreen;
