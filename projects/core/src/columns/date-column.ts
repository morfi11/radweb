import { Column } from "../column";
import { ColumnOptions } from "../column-interfaces";
import { DateTimeDateStorage } from "./storage/datetime-date-storage";

export class DateColumn extends Column<Date>{
  constructor(settingsOrCaption?: ColumnOptions<Date>) {
    super( { dataControlSettings: () => ({ inputType: 'date' }) },settingsOrCaption);
  }
  getDayOfWeek() {
    return new Date(this.value).getDay();
  }
  get displayValue() {
    if (!this.value)
      return '';
    return this.value.toLocaleDateString();
  }
  __defaultStorage() {
    return new DateTimeDateStorage();
  }
  toRawValue(value: Date) {
    return DateColumn.dateToString(value);
  }
  fromRawValue(value: any) {

    return DateColumn.stringToDate(value);
  }

  static stringToDate(value: string) {
    if (!value || value == '' || value == '0000-00-00')
      return undefined;
    return new Date(Date.parse(value));
  }
  static dateToString(val: Date): string {
    var d = val as Date;
    if (!d)
      return '';
    let month = addZeros(d.getMonth() + 1),
      day = addZeros(d.getDate()),
      year = d.getFullYear();
    return [year, month, day].join('-');
  }

}
function addZeros(number: number, stringLength: number = 2) {
  let to = number.toString();
  while (to.length < stringLength)
    to = '0' + to;
  return to;
}