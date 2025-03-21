import { WineRecord } from '../constants/WineRecord';

class WineRecordService {
  private records: WineRecord[] = [];

  addRecord(record: WineRecord) {
    this.records.push(record);
  }

  getRecords(): WineRecord[] {
    return this.records;
  }

  updateRecord(index: number, updatedRecord: WineRecord) {
    if (index >= 0 && index < this.records.length) {
      this.records[index] = updatedRecord;
    }
  }

  deleteRecord(index: number) {
    if (index >= 0 && index < this.records.length) {
      this.records.splice(index, 1);
    }
  }

  deleteAllRecords() {
    this.records = [];
  }

  exportRecords(): string {
    return JSON.stringify(this.records, null, 2);
  }

  importRecords(jsonData: string) {
    try {
      const importedRecords = JSON.parse(jsonData);
      if (Array.isArray(importedRecords)) {
        this.records = importedRecords;
      }
    } catch (error) {
      console.error('Ошибка импорта записей', error);
    }
  }

  searchRecords(filter: Partial<WineRecord>): WineRecord[] {
    return this.records.filter(record => {
      for (const key in filter) {
        if (filter[key as keyof WineRecord]) {
          const filterValue = (filter[key as keyof WineRecord] as string).toLowerCase();
          const recordValue = (record[key as keyof WineRecord] as string).toLowerCase();
          if (!recordValue.includes(filterValue)) {
            return false;
          }
        }
      }
      return true;
    });
  }
}

export default new WineRecordService();
