import { IsString, MaxLength } from "class-validator";

export class UpdateSettingDto {
  /*
   * Qiymat SATR sifatida keladi va turi `setting-rules.ts` da tekshiriladi.
   *
   * Bu yerda tur bo'yicha tekshirilmaydi: reestr yagona manba bo'lishi kerak,
   * aks holda DTO va reestr bir-biridan uzilib ketardi.
   */
  @IsString()
  @MaxLength(2000)
  value!: string;
}
