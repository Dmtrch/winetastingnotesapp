import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WineRecordService from '../services/WineRecordService';
import { WineRecord } from '../constants/WineRecord';
import Logo from '../components/Logo';

type EditScreenProps = NativeStackScreenProps<RootStackParamList, 'Edit'>;

const EditScreen = ({ route, navigation }: EditScreenProps) => {
  const recordId = parseInt(route.params.recordId, 10);

  // Удалён неиспользуемый хук: const [record, setRecord] = useState<WineRecord | null>(null);

  const [wineryName, setWineryName] = useState('');
  const [wineName, setWineName] = useState('');
  const [harvestYear, setHarvestYear] = useState('');
  const [bottlingYear, setBottlingYear] = useState('');
  const [grapeVarietiesInput, setGrapeVarietiesInput] = useState('');
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
  const [personalVerdict, setPersonalVerdict] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [bottlePhoto, setBottlePhoto] = useState('');
  const [labelPhoto, setLabelPhoto] = useState('');
  const [backLabelPhoto, setBackLabelPhoto] = useState('');
  const [plaquePhoto, setPlaquePhoto] = useState('');

  useEffect(() => {
    const records = WineRecordService.getRecords();
    const currentRecord = records[recordId];
    if (currentRecord) {
      // setRecord(currentRecord); // Не используется в дальнейшем
      setWineryName(currentRecord.wineryName);
      setWineName(currentRecord.wineName);
      setHarvestYear(currentRecord.harvestYear);
      setBottlingYear(currentRecord.bottlingYear);
      const gvString = currentRecord.grapeVarieties.map(gv => `${gv.variety}:${gv.percentage}`).join(', ');
      setGrapeVarietiesInput(gvString);
      setWinemaker(currentRecord.winemaker);
      setOwner(currentRecord.owner);
      setCountry(currentRecord.country);
      setRegion(currentRecord.region);
      setSugarContent(currentRecord.sugarContent.toString());
      setAlcoholContent(currentRecord.alcoholContent.toString());
      setWineType(currentRecord.wineType);
      setWineStyle(currentRecord.wineStyle);
      setColor(currentRecord.color);
      setPrice(currentRecord.price.toString());
      setAppearanceNotes(currentRecord.appearanceNotes);
      setDensity(currentRecord.density);
      setInitialNose(currentRecord.initialNose);
      setAromaAfterAeration(currentRecord.aromaAfterAeration);
      setTaste(currentRecord.taste);
      setTannins(currentRecord.tannins);
      setAcidity(currentRecord.acidity);
      setSweetness(currentRecord.sweetness);
      setBalance(currentRecord.balance);
      setAssociations(currentRecord.associations);
      setConsumptionDate(currentRecord.consumptionDate);
      setPersonalVerdict(currentRecord.personalVerdict);
      setAdditionalNotes(currentRecord.additionalNotes);
      setBottlePhoto(currentRecord.bottlePhoto);
      setLabelPhoto(currentRecord.labelPhoto);
      setBackLabelPhoto(currentRecord.backLabelPhoto);
      setPlaquePhoto(currentRecord.plaquePhoto || '');
    } else {
      Alert.alert('Ошибка', 'Запись не найдена');
    }
  }, [recordId]);

  const handleSave = () => {
    const grapeVarieties = grapeVarietiesInput.split(',').map(item => {
      const [variety, percentage] = item.split(':').map(s => s.trim());
      return { variety, percentage: Number(percentage) || 0 };
    }).filter(item => item.variety);

    const updatedRecord: WineRecord = {
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

    WineRecordService.updateRecord(recordId, updatedRecord);
    Alert.alert('Успех', 'Запись обновлена');
    navigation.navigate('RecordDetail', { recordId: recordId.toString() });
  };

  return (
    <ScrollView style={styles.container}>
      <Logo />
      <Text style={styles.header}>Редактирование записи</Text>
      <Text>Название винодельни:</Text>
      <TextInput style={styles.input} value={wineryName} onChangeText={setWineryName} placeholder="Введите название винодельни" />
      <Text>Название вина:</Text>
      <TextInput style={styles.input} value={wineName} onChangeText={setWineName} placeholder="Введите название вина" />
      <Text>Год урожая:</Text>
      <TextInput style={styles.input} value={harvestYear} onChangeText={setHarvestYear} placeholder="Введите год урожая" keyboardType="numeric" />
      <Text>Год розлива:</Text>
      <TextInput style={styles.input} value={bottlingYear} onChangeText={setBottlingYear} placeholder="Введите год розлива" keyboardType="numeric" />
      <Text>Сорта винограда и % содержания (формат: сорт:процент, сорт:процент):</Text>
      <TextInput style={styles.input} value={grapeVarietiesInput} onChangeText={setGrapeVarietiesInput} placeholder="например: Каберне:60, Мерло:40" />
      <Text>Винодел:</Text>
      <TextInput style={styles.input} value={winemaker} onChangeText={setWinemaker} placeholder="Введите имя винодела" />
      <Text>Собственник:</Text>
      <TextInput style={styles.input} value={owner} onChangeText={setOwner} placeholder="Введите имя собственника" />
      <Text>Страна:</Text>
      <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Введите страну" />
      <Text>Регион:</Text>
      <TextInput style={styles.input} value={region} onChangeText={setRegion} placeholder="Введите регион" />
      <Text>Содержание сахара (%):</Text>
      <TextInput style={styles.input} value={sugarContent} onChangeText={setSugarContent} placeholder="Введите содержание сахара" keyboardType="numeric" />
      <Text>Содержание спирта (%):</Text>
      <TextInput style={styles.input} value={alcoholContent} onChangeText={setAlcoholContent} placeholder="Введите содержание спирта" keyboardType="numeric" />
      <Text>Вид вина (сухое, полусухое, полусладкое, сладкое, десертное):</Text>
      <TextInput style={styles.input} value={wineType} onChangeText={setWineType} placeholder="Введите вид вина" />
      <Text>Тип вина (тихое, игристое):</Text>
      <TextInput style={styles.input} value={wineStyle} onChangeText={setWineStyle} placeholder="Введите тип вина" />
      <Text>Цвет вина (красное, белое, розовое, оранж, глу-глу, другое):</Text>
      <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Введите цвет вина" />
      <Text>Цена:</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Введите цену" keyboardType="numeric" />

      <Text style={styles.sectionHeader}>Дегустация</Text>
      <Text>Цвет (заметки):</Text>
      <TextInput style={styles.input} value={appearanceNotes} onChangeText={setAppearanceNotes} placeholder="Введите заметки о цвете" />
      <Text>Плотность:</Text>
      <TextInput style={styles.input} value={density} onChangeText={setDensity} placeholder="Введите плотность" />
      <Text>Первый нос (без аэрации):</Text>
      <TextInput style={styles.input} value={initialNose} onChangeText={setInitialNose} placeholder="Введите описание первого носа" />
      <Text>Аромат после аэрации:</Text>
      <TextInput style={styles.input} value={aromaAfterAeration} onChangeText={setAromaAfterAeration} placeholder="Введите аромат после аэрации" />
      <Text>Вкус (спиртуозность):</Text>
      <TextInput style={styles.input} value={taste} onChangeText={setTaste} placeholder="Введите описание вкуса" />
      <Text>Танины:</Text>
      <TextInput style={styles.input} value={tannins} onChangeText={setTannins} placeholder="Введите описание танинов" />
      <Text>Кислотность:</Text>
      <TextInput style={styles.input} value={acidity} onChangeText={setAcidity} placeholder="Введите кислотность" />
      <Text>Сладость:</Text>
      <TextInput style={styles.input} value={sweetness} onChangeText={setSweetness} placeholder="Введите сладость" />
      <Text>Баланс:</Text>
      <TextInput style={styles.input} value={balance} onChangeText={setBalance} placeholder="Введите баланс" />
      <Text>Ассоциации:</Text>
      <TextInput style={styles.input} value={associations} onChangeText={setAssociations} placeholder="Введите ассоциации" />
      <Text>Дата потребления:</Text>
      <TextInput style={styles.input} value={consumptionDate} onChangeText={setConsumptionDate} placeholder="Введите дату потребления" />

      <Text style={styles.sectionHeader}>Личный вердикт</Text>
      <Text>Моё/не моё, брать/не брать:</Text>
      <TextInput style={styles.input} value={personalVerdict} onChangeText={setPersonalVerdict} placeholder="Введите вердикт" />
      <Text>Прочее:</Text>
      <TextInput style={styles.input} value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Введите дополнительные заметки" />

      <Text style={styles.sectionHeader}>Фотографии</Text>
      <Text>Фотография бутылки (URI):</Text>
      <TextInput style={styles.input} value={bottlePhoto} onChangeText={setBottlePhoto} placeholder="Введите URI фотографии бутылки" />
      <Text>Фотография этикетки (URI):</Text>
      <TextInput style={styles.input} value={labelPhoto} onChangeText={setLabelPhoto} placeholder="Введите URI фотографии этикетки" />
      <Text>Фотография контрэтикетки (URI):</Text>
      <TextInput style={styles.input} value={backLabelPhoto} onChangeText={setBackLabelPhoto} placeholder="Введите URI фотографии контрэтикетки" />
      <Text>Фотография плакетки (URI, для игристого вина):</Text>
      <TextInput style={styles.input} value={plaquePhoto} onChangeText={setPlaquePhoto} placeholder="Введите URI фотографии плакетки" />

      <View style={styles.buttonContainer}>
        <Button title="Сохранить изменения" onPress={handleSave} />
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
  },
  input: {
    height: 40,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  buttonContainer: {
    marginVertical: 20,
  },
});

export default EditScreen;
