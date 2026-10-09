# NBU QR to'lovlarini buyurtmaga bog'lash

## Hozirgi holat

Mazetto Food kassasida hozir faqat naqd to'lov usuli faol. Restoranda bitta
doimiy NBU QR mavjud. Menejerning Android telefoniga tushadigan SMS summa,
vaqt, merchant va QR identifikatorini bildiradi, ammo buyurtma raqamini
bildirmaydi. Bir vaqtda bir xil summali ikki buyurtma bo'lsa, SMSning o'zi
qaysi buyurtma to'langanini isbotlamaydi. Shu sababli SMS kelishi avtomatik
ravishda `PaymentStatus.SUCCESS` yaratmasligi kerak.

## Ishga tushirish tartibi

1. NBUdan merchant tranzaksiyalarini olishning rasmiy usulini so'rash:
   webhook/API, to'lov reyestri yoki bank kabineti eksporti. Tranzaksiya
   identifikatori buyurtma raqamiga bog'lana oladimi, shuni aniqlash.
2. NBU tasdiqlagan manbadan kelgan tranzaksiyani alohida, tenantga bog'langan
   yozuvda saqlash. Bank tranzaksiya identifikatori, summa, vaqt, merchant va
   manba bo'yicha takroriy xabarni idempotent rad qilish. SMS matnini logga
   to'liq yozmaslik.
3. QR to'lovni kassa uchun alohida usul sifatida ko'rsatish, ammo bank
   tasdig'i kelguncha buyurtmani `PAID` qilmaslik. Kassirga tasdiqlangan,
   hali biriktirilmagan bank tranzaksiyalari va mos summa/vaqt oralig'idagi
   buyurtmalarni ko'rsatish. Bir xil summalar ko'p bo'lsa qo'lda tekshirish.
4. Biriktirishni bitta DB tranzaksiyasida bajarish: tenant/filial/ruxsat,
   buyurtma qoldig'i, bank referensining takrorlanmasligi, audit va kassa
   daromad yozuvi tekshirilsin. Naqd kassa qoldig'iga QR pul qo'shilmasin.
5. Bank qaytarishi, bekor qilish, kech kelgan xabar, uzilgan internet,
   ikki kassirning bir vaqtdagi tasdig'i va ikki bir xil summali buyurtma
   uchun alohida regressiya testlari.

## Android SMS ko'prigi (bank API bo'lmasa)

Maxsus, restoran nazoratidagi Android qurilmada faqat NBU jo'natuvchisidan
kelgan QR tushum SMSlarini o'qiydigan ichki dastur mumkin. U HTTPS orqali
imzolangan, takrorlanmaydigan xabarni serverga yuboradi va offline navbatini
saqlaydi. Jo'natuvchi nomi va SMS matni soxtalashtirilishi mumkin: bunday
xabarlar faqat `UNVERIFIED` kuzatuv yozuvi bo'ladi, pulni qabul qilish
uchun bank kabineti/reyestri yoki rasmiy API bilan solishtirish kerak.
Telefonning boshqa SMSlarini o'qimaslik, maxfiy ma'lumotlarni yashirish,
qurilmani bekor qilish va yuborish xatolarini ko'rsatish talab qilinadi.
Android SMS ruxsati Google Play siyosati bilan cheklangan; tarqatish usuli
oldindan tekshiriladi.

## Ishga tushirish uchun kerak

- NBU QR xizmatining shartnomasi yoki texnik hujjati; merchant va QR ID.
- Bank kabinetida to'lov reyestri/API/webhook bormi, namunaviy javob.
- QR tushum SMSining jo'natuvchi nomi; shaxsiy ma'lumotlari yashirilgan
  bir necha haqiqiy, qaytarilgan va bir xil summali misollar.
- Yorliq va haqiqiy chek printerining model/qog'oz o'lchamlari; Windows
  drayverida sinov cheki matn bilan chiqqani haqida tasdiq.
