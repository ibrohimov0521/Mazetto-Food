# Page-by-page lessons

Bu audit [MeaSoft / CourierExe rasmiy wiki](https://wiki.courierexe.ru/) main namespace'idagi barcha 236 sahifani qamrab oladi. Har bir **MEASOFT FACT** sahifaning to'liq yuklangan wiki manbasidan qisqa parafraz; **OUR INTERPRETATION** tizim xulqidan chiqarilgan model; **OUR RECOMMENDATION** esa Mazetto uchun mustaqil taklifdir. Qisqa redirect va target domeniga aloqasiz sahifalar ham tashlab ketilmagan.

## 1C-Битрикс

URL: https://wiki.courierexe.ru/index.php/1C-%D0%91%D0%B8%D1%82%D1%80%D0%B8%D0%BA%D1%81  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2025-03-27T13:30:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Настройка интеграции = # В личном кабинете 1C-Битрикс на вкладке Администрирование в панели слева выберите Marketplace > Каталог решений и на странице «Каталог Маркетплейс» с помощью строки поиска найдите Модуль интеграции MEASoft.

Sahifadagi asosiy bo'limlar: Настройка интеграции; Настройки модуля; Перенос даты доставки; Отключение синхронизации статусов; Количество заказов, статусы которых проверяем за 1 раз; Валидация даты доставки; Запрет создания заказа в Субботу и Воскресенье; Настройки сопоставления способов оплат; Отправка заказа в курьерскую службу; Возможные ошибки.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## 1С Битрикс

URL: https://wiki.courierexe.ru/index.php/1%D0%A1_%D0%91%D0%B8%D1%82%D1%80%D0%B8%D0%BA%D1%81  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-11T09:05:15Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## AmoCRM

URL: https://wiki.courierexe.ru/index.php/AmoCRM  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2025-04-07T09:14:58Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Интеграция реализована через виджет «MeaSoft», предназначенный для передачи заказов из amoCRM в MeaSoft и возврата статусов.

Sahifadagi asosiy bo'limlar: Передача заказов в ЛК; Настройка интеграции; Сопоставление полей; Настройка нескольких Личных кабинетов; Устранение неполадок; "Данные заказа не подставляются в поля виджета" или "Не отображается виджет".

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## API

URL: https://wiki.courierexe.ru/index.php/API  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2026-06-11T09:40:34Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Изменения для 54-ФЗ Для передачи ставки НДС при оформлении заказа добавлен атрибут items > item > VATrate.

Sahifadagi asosiy bo'limlar: Готовые интеграции; Тестовый аккаунт; Рабочий аккаунт для подключения; Авторизация курьерской службы; Общие понятия; Ограничения; Оформление заказа; Пример оформления заказа; Описание элементов для оформления заказа; Примеры ответов; Коды и описание ошибок; Передача значений полей в форме создания заказа в Личном Кабинете через GET параметры.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## API Documentation

URL: https://wiki.courierexe.ru/index.php/API_Documentation  
Category: API / integration  
Relevance: HIGH  
Last wiki revision: 2024-04-23T14:14:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaSoft has an option of integration by means of XML API through HTTP POST protocol.

Sahifadagi asosiy bo'limlar: CMS Integrations; Test Account; Account for Integration; Courier Service Access; General Terms; Fair Usage Policy; Creating Order; Example of New Order; Order Elements; Response Examples; Order Status; Request Example.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Client/Recipient, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## API модуля мобильных устройств

URL: https://wiki.courierexe.ru/index.php/API_%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D1%8F_%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D1%8C%D0%BD%D1%8B%D1%85_%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B9%D1%81%D1%82%D0%B2  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2020-01-24T09:26:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Для взаимодействия модуля мобильных устройств со сторонними системами предусмотрено XML API.

Sahifadagi asosiy bo'limlar: Создание/изменение клиентов; Создание/изменение курьеров; Создание заказов; Получение статусов заказов; Получение изображений к заказам; Получение треков курьеров.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Assist

URL: https://wiki.courierexe.ru/index.php/Assist  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-18T14:40:05Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Call-центр

URL: https://wiki.courierexe.ru/index.php/Call-%D1%86%D0%B5%D0%BD%D1%82%D1%80  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-17T06:39:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Clients and Partners

URL: https://wiki.courierexe.ru/index.php/Clients_and_Partners  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2023-03-15T13:44:30Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Purpose = The Clients tab is designed for storing the list of clients, recording new and changing the data of existing partners and counterparties.

Sahifadagi asosiy bo'limlar: Purpose; Client list; Client card; Main; Company Info; Финансы; Прочее; Касса; Notifications; Departments; Custom; Client card creation.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Client Account

URL: https://wiki.courierexe.ru/index.php/Client_Account  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-21T14:04:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Client account is designed for clients and partners of the courier service company working in the MeaSoft system.

Sahifadagi asosiy bo'limlar: Main page; New order; Creating an order manually; Dependencies of fields displaying in the order form; Pickup request; Deliver to me; Import an Excel Registry; Create order by copying; Add item; Add file; Add package; Delivery fee conditions.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Client/Recipient, Manifest/Act, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Client rates

URL: https://wiki.courierexe.ru/index.php/Client_rates  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-12-07T14:33:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** =Rates= «Rates» refernces intended for creation and storage of client rates for intracity and individual intercity deliveries.

Sahifadagi asosiy bo'limlar: Rates; City delivery; Delivery; Pickup; Intercity deliveries; Other; Services.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Courier mobile app for Android

URL: https://wiki.courierexe.ru/index.php/Courier_mobile_app_for_Android  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2023-09-01T08:56:00Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Purpose The application is made to cooperate with both the Measoft system and external systems that can be linked through unique API.

Sahifadagi asosiy bo'limlar: Purpose; Device Selection; Installation; Configuration; User Registration; Registration by QR code scanning; Registration of the application by entering a username and password; Receiving orders; Accepting orders; List of orders; Quick order actions; Orders for today.

### Muhim business rule

- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Courier mobile app for iOS

URL: https://wiki.courierexe.ru/index.php/Courier_mobile_app_for_iOS  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-17T14:22:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Purpose thumb|200px|right The application is designed to work in conjunction with the MeaSoft system.

Sahifadagi asosiy bo'limlar: Purpose; Device Selection; Installation; Configuration; Registration by QR code scanning; Registration of the application by entering a username and password; List of orders; Receiving new orders; Orders for today; Closed orders; Orders for tomorrow; Order list update.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Courier Service Account

URL: https://wiki.courierexe.ru/index.php/Courier_Service_Account  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-04-11T11:30:27Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Courier service account is intended for configuring client account. Personal Account Functions There are the following types of the personal account functionality: * Basic * Standard * Premium * Maximum Depending on the type, you can use the following functionality: {|class="wikitable" Registering Courier Service Account To register a courier service account: # In MeaSoft, click Catalogs > Additional Modules, and then click Register Account.

Sahifadagi asosiy bo'limlar: Personal Account Functions; Registering Courier Service Account; Setting Up Client Account; Setting Up Fields for Client Groups; Setting Up Fields and Tabs; Parameters; General Settings; Finance; Advanced Settings; Phones; Courier Devices; Telephony Settings.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## CS-Cart

URL: https://wiki.courierexe.ru/index.php/CS-Cart  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2026-01-29T10:32:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль поддерживает CS-Cart 4.10 и выше. = Настройка интеграции = # Скачайте архив модуля установки по ссылке.

Sahifadagi asosiy bo'limlar: Настройка интеграции; Настройка статусов; Настройка способов оплаты; Особенности настройки Яндекс.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Employees

URL: https://wiki.courierexe.ru/index.php/Employees  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2023-06-08T14:06:42Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Purpose = The tab is intended for managing the employee data of the company. 900px|none In the right part of the window there is a filter of the list of employees, as well as the button Shipment issue, which you can use to move to the tab Issue and start the issue to the courier allocated in the list of employees.

Sahifadagi asosiy bo'limlar: Purpose; Employee Types; Employee Card Creation; Employee Card; Main; Details; Schedule; Clients; Additional; Employee ID card; Firing an employee; Employee Card Removal.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## English Help

URL: https://wiki.courierexe.ru/index.php/English_Help  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2023-07-18T12:16:28Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** API Documentation Courier Service Account Client Account Courier mobile app for Android Courier mobile app for iOS Quick start Rates Rates by zones Map module Employees Receipt Board Tasks

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to Accept Work From a Courier

URL: https://wiki.courierexe.ru/index.php/How_to_Accept_Work_From_a_Courier  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T12:31:01Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** After completing the deliveries, the courier returns to the office. If some of the orders could not be fulfilled, then the courier must hand in the return shipments to the operator.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to add an order and addresses

URL: https://wiki.courierexe.ru/index.php/How_to_add_an_order_and_addresses  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T09:21:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Each order in the system is linked to an existing customer. To add an order, you must first create a customer in the system.

Sahifadagi asosiy bo'limlar: Create an order; Add addresses to the order.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to add a client

URL: https://wiki.courierexe.ru/index.php/How_to_add_a_client  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T06:28:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** To add a client, click the Clients tab in the top menu of the program. In the window that opens, be sure to fill out the Main, Company Info and Finance tabs.

Sahifadagi asosiy bo'limlar: Fill in the main information; Fill in company information; Fill in Finance tab.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to close an invoice

URL: https://wiki.courierexe.ru/index.php/How_to_close_an_invoice  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T12:20:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The issued invoice is called closed (paid) when the full amount of the payment is received from the client to the balance of the courier service company.

Sahifadagi asosiy bo'limlar: Cash payment; Non-cash payment.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to close the FTC

URL: https://wiki.courierexe.ru/index.php/How_to_close_the_FTC  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T12:28:45Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** To close the funds transfer certificate (FTC), the courier service company must return the money to the client for their goods.

Sahifadagi asosiy bo'limlar: Cash payment; Delivery of the cash by a courier.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to create an FTC

URL: https://wiki.courierexe.ru/index.php/How_to_create_an_FTC  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T10:41:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Funds transfer certificate (FTC) are needed if the courier service company accepts money for goods from recipients; for example, while working with online stores.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to generate accompanying documents

URL: https://wiki.courierexe.ru/index.php/How_to_generate_accompanying_documents  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T10:20:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The set of documents for printing differs depending on the processes of the courier service.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to hand over shipments to the courier

URL: https://wiki.courierexe.ru/index.php/How_to_hand_over_shipments_to_the_courier  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T10:22:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The system must reflect the transfer of shipments to the courier. This will enable you to monitor the progress of orders that have been fulfilled.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to issue an invoice

URL: https://wiki.courierexe.ru/index.php/How_to_issue_an_invoice  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T12:07:23Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** To receive money for services, the courier service company must issue an invoice to the client for the payment.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## How to schedule a delivery

URL: https://wiki.courierexe.ru/index.php/How_to_schedule_a_delivery  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-14T09:39:03Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The method of scheduling involves allocating deliveries to each courier. It is typically used by companies that dispatch the following day or later.

Sahifadagi asosiy bo'limlar: Planning based on markers; Area Planning.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Ibox

URL: https://wiki.courierexe.ru/index.php/Ibox  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-18T14:42:26Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Iiko

URL: https://wiki.courierexe.ru/index.php/Iiko  
Category: API / integration  
Relevance: LOW  
Last wiki revision: 2023-10-26T11:36:27Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Настройка интеграции состоит из 10 несложных последовательных шагов 1ый шаг - вам нужно зайти в раздел Настройки Cloud API Этот раздел находится на главной странице административного раздела Iikoweb.

Sahifadagi asosiy bo'limlar: Настройка интеграции состоит из 10 несложных последовательных шагов.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## InSales

URL: https://wiki.courierexe.ru/index.php/InSales  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2026-03-02T05:17:18Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** __FORCETOC__ Предварительная настройка Для удобства работы до настройки интеграции создайте в InSales следующие пользовательские статусы: * статус для автоматической передачи заказов в курьерскую службу, * статус для обозначения заказа с ошибкой передачи данных.

Sahifadagi asosiy bo'limlar: Предварительная настройка; Настройка интеграции; Настройка интеграции на несколько аккаунтов; Настройка типов оплаты; Настройка наименования способов доставки; Текущая логика наименования; Настройка изменения наименования всех режимов; Настройка изменения наименования каждого режима доставки; Известные проблемы.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Introduction to the system

URL: https://wiki.courierexe.ru/index.php/Introduction_to_the_system  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-11T13:52:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Purpose = The purpose of this section is to introduce you to the system's fundamental features.

Sahifadagi asosiy bo'limlar: Purpose; Interface; Utilizing tables; Utilizing Templates; Search for information; Hotkeys; Understanding Controls; Sorting the list of addresses; Manual sorting; Entering in address information; System buttons; Go to quick start.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## LeadVertex

URL: https://wiki.courierexe.ru/index.php/LeadVertex  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2021-12-15T09:20:28Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** С помощью интеграции вы можете выгружать заполненные заказы в любую курьерскую службу, работающую в MeaSoft, и получать измененные статусы по заказам.

Sahifadagi asosiy bo'limlar: Настройка интеграции; Отправка заказа в MeaSoft.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## M-POINT

URL: https://wiki.courierexe.ru/index.php/M-POINT  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2022-12-22T06:50:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Сервис M-POINT предназначен для сотрудников пунктов выдачи товаров. Он позволяет повысить эффективность работы: * быстрый доступ к информации о заказах, переданных в ПВЗ; * прием заказов; * работа со сканером штрихкодов; * полная или частичная выдача отправлений; * отправка статуса доставки в MeaSoft; * поиск заказа по любым данным – номер заказа, ФИО получателя, номер телефона; * возможность приложить файлы к заказу

Sahifadagi asosiy bo'limlar: Бизнес-процесс; Начало работы; Заказы; Прием на склад; Акты передачи денег (АПД); Акты передачи корреспонденции (АПК); Отчеты; Инвентаризация.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Map Module

URL: https://wiki.courierexe.ru/index.php/Map_Module  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-12-15T13:56:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Purpose The module is designed to visually plan city deliveries and create rate zones on the map in the uniform zoning mode.

Sahifadagi asosiy bo'limlar: Purpose; Orders on the map; Undiscovered addresses; Settings; Map Settings; Print; Hints; Additional features; Scheduling types; Manual scheduling; Schematic scheduling; Creating a scheme.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Maxoptra

URL: https://wiki.courierexe.ru/index.php/Maxoptra  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-17T13:30:43Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## MeaShip

URL: https://wiki.courierexe.ru/index.php/MeaShip  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-03-03T15:38:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaShip — быстрый старт MeaShip — это сервис управления доставкой для малого бизнеса.

Sahifadagi asosiy bo'limlar: Возможности сервиса; Начало работы; Регистрация; Административный ЛК; Курьеры; Создание записи курьера; Регистрация в мобильном приложении; Подрядчики; Создание записи подрядчика; Настройка интеграции; Настройка полей; Настройки.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## MeaShip — быстрый старт

URL: https://wiki.courierexe.ru/index.php/MeaShip_%E2%80%94_%D0%B1%D1%8B%D1%81%D1%82%D1%80%D1%8B%D0%B9_%D1%81%D1%82%D0%B0%D1%80%D1%82  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-04-20T13:53:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaShip — это сервис управления доставкой товаров для малого бизнеса. Все заказы интернет-магазина отображаются в едином интерфейсе — рабочем кабинете MeaShip, где можно управлять курьерской доставкой и видеть статусы доставки товаров.

Sahifadagi asosiy bo'limlar: Начало работы; Регистрация; Подключение подрядчика; Создание записей курьеров; Настройка передачи заказов из своей системы; Как назначить заказ курьеру или подрядчику; Как курьеру принимать оплату картой; Как принимать платежи онлайн; Как курьеры получают заказы; Как получателю увидеть заказ; Что делать, если нет ответа на мой вопрос.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## MeaSoft App

URL: https://wiki.courierexe.ru/index.php/MeaSoft_App  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-07T09:34:50Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## OpenCart

URL: https://wiki.courierexe.ru/index.php/OpenCart  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2024-02-12T14:53:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Описание = Модуль дает возможность отображать в корзине магазина способ доставки Курьером и Самовывоз, с выбором ПВЗ на карте = OpenCart 1.5.5.1 = Важно!

Sahifadagi asosiy bo'limlar: Описание; OpenCart 1.5.5.1; OpenCart 2.0 и выше; Настройка интеграции; Изменение данных заказа; Передача заказа в ЛК; Список настроек модуля Основные настройки интеграции MeaSoft; Список настроек модуля Настройки доставки курьером интеграции MeaSoft; Возможные ошибки.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## PimPay

URL: https://wiki.courierexe.ru/index.php/PimPay  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-18T14:38:17Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Plans

URL: https://wiki.courierexe.ru/index.php/Plans  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-30T14:19:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## PrestaShop

URL: https://wiki.courierexe.ru/index.php/PrestaShop  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2025-09-11T12:30:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** =Описание= Модуль интеграции "MeaSoft" - программный модуль, позволяющий связать решения, разработанные на платформе "Prestashop", с системой комплексной автоматизации "MeaSoft".

Sahifadagi asosiy bo'limlar: Описание; Установка; Работа; Изменения.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Quick start

URL: https://wiki.courierexe.ru/index.php/Quick_start  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-11T11:46:04Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** This section will introduce you to the basic functions of the system. The complete processing of a single order manually - from creation to complete closure - is described.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Rates

URL: https://wiki.courierexe.ru/index.php/Rates  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-12-09T09:14:48Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** In MeaSoft delivery rates are presented in the following ways: * client rates. For more information see «Client rates»; * courier rates.

Sahifadagi asosiy bo'limlar: Client rates; Preliminary steps; City delivery; Intercity delivery; General intercity rates; Individual intercity rates; Agent rates.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Rates by zones

URL: https://wiki.courierexe.ru/index.php/Rates_by_zones  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-12-09T09:29:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The reference is designed to rate delivery costs by zones. Zones are set in the reference Zones.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Receipt Board

URL: https://wiki.courierexe.ru/index.php/Receipt_Board  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2023-07-18T12:14:17Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** The Receipt Board is a tool for receiving shipmnents from couriers or incoming manifests.

Sahifadagi asosiy bo'limlar: Courier Receipt; Receipt Card; Receipt process; Receiving non-delivered shipments; Pickup receipt; Receiving unscheduled shipments; Manifest Receipt; Receipt Card; Receipt Process; Receipt completion; How the Statusfield works.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## RetailCRM

URL: https://wiki.courierexe.ru/index.php/RetailCRM  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2026-02-26T04:33:58Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Обратите внимание, RetailCRM не передает Услуги, не используйте их. Настройка интеграции # В RetailСRM cоздайте API-ключ.

Sahifadagi asosiy bo'limlar: Настройка интеграции; Передача типа платежа в ЛК из retailCRM; Исключение печати чеков; Передача наложенного платежа; Передача статусов из MeaSoft; Проверка интеграции; Печатные формы; Настройка триггеров; Передача заказа при смене статуса; Отмена заказа при смене статуса; Отмена заказа при смене типа доставки; Передача изменений заказа.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Robokassa

URL: https://wiki.courierexe.ru/index.php/Robokassa  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-18T14:38:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Staff

URL: https://wiki.courierexe.ru/index.php/Staff  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-04-08T12:13:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Tasks

URL: https://wiki.courierexe.ru/index.php/Tasks  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2023-07-18T12:16:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вкладка предназначена для распределения поручений сотрудникам и контроля выполнения задач.

Sahifadagi asosiy bo'limlar: Новое задание; Новое периодическое задание.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Tilda

URL: https://wiki.courierexe.ru/index.php/Tilda  
Category: API / integration  
Relevance: LOW  
Last wiki revision: 2025-10-21T12:13:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** __FORCETOC__ Создание интеграции Откройте "ЛК Меасофт" - "Интеграции" - "Настройки интеграции", добавьте новую интеграцию или выберите изменить уже созданную.

Sahifadagi asosiy bo'limlar: Создание интеграции; Настройка Tilda; Подключение Webhook на формах.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Client/Recipient, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## To do list

URL: https://wiki.courierexe.ru/index.php/To_do_list  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-02-17T12:05:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Webasyst

URL: https://wiki.courierexe.ru/index.php/Webasyst  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2026-01-14T10:52:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль интеграции "MeaSoft" для Webasyst - программный модуль, позволяющий связать интернет-магазины, работающие на платформе Shop-Script, с курьерскими службами, автоматизированными системой комплексной автоматизации "MeaSoft".

Sahifadagi asosiy bo'limlar: Настройка интеграции; Отправка заказа; Получение статуса заказа.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Webhook

URL: https://wiki.courierexe.ru/index.php/Webhook  
Category: API / integration  
Relevance: HIGH  
Last wiki revision: 2025-10-22T02:59:57Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Принцип работы Webhook передает данные по заказам и статусам на ваш URL. Важно понимать, что на обработку очереди всех вебхуков, включая ваш, уходит время.

Sahifadagi asosiy bo'limlar: Принцип работы; Настройка; Авторизация; Basic Auth; Bearer Token; API Key; Формат данных в адрес получателя вебхука; Формат ответа от получателя вебхука.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Client/Recipient.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Wialon

URL: https://wiki.courierexe.ru/index.php/Wialon  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-12-15T09:37:25Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** GPS-трекинг автотранспорта реализован в интеграции с системой Wialon. Чтобы настроить интеграцию: # Заключите договор с Wialon, настройте трекинг автомобилей и убедитесь, что он доступен в веб-интерфейсе Wialon.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Wordpress

URL: https://wiki.courierexe.ru/index.php/Wordpress  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2026-06-05T12:56:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Важно = Плагин корректно работает, если содержимое страницы "Оформление заказа" состоит из текста [woocommerce_checkout] На скриншоте ниже :Красным отмечена область с неправильным содержимым страницы "Оформление заказа" :Зеленым отмечена область с правильным содержимым страницы "Оформление заказа" 1020 px|none = Требования к сайту = * CMS WordPress версии 5 или более новая; * WooCommerce версии 3.9 или более новая; * PHP версии 7 или более новая; * сайт должен использовать SSL-сертификат.

Sahifadagi asosiy bo'limlar: Важно; Требования к сайту; Установка плагина и вывод нового способа доставки в корзину; Обновление статусов; Передача отмены заказа.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Автозамена

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%B2%D1%82%D0%BE%D0%B7%D0%B0%D0%BC%D0%B5%D0%BD%D0%B0  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-05-31T13:02:20Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Автоматическое планирование маршрутов

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%B2%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%BE%D0%B5_%D0%BF%D0%BB%D0%B0%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5_%D0%BC%D0%B0%D1%80%D1%88%D1%80%D1%83%D1%82%D0%BE%D0%B2  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2021-09-17T13:49:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Автомобили

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%B2%D1%82%D0%BE%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D0%B8  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2021-09-02T15:05:33Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для хранения данных об автомобилях курьерской службы и курьеров.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Адреса

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%B4%D1%80%D0%B5%D1%81%D0%B0  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-12-23T09:59:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Акты передачи денег и корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%BA%D1%82%D1%8B_%D0%BF%D0%B5%D1%80%D0%B5%D0%B4%D0%B0%D1%87%D0%B8_%D0%B4%D0%B5%D0%BD%D0%B5%D0%B3_%D0%B8_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2026-06-16T16:03:53Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ;Акты передачи денег (АПД) : Часть финансового контура программы, предназначенная для взаиморасчетов с интернет-магазинами (далее сокращенно ИМ).

Sahifadagi asosiy bo'limlar: Акты передачи денег (АПД); Настройка режимов работы с ИМ; Исходящие АПД; Карточка АПД; Правила добавления корреспонденции в АПД; Формирование двойного АПД; Правило начисления процента менеджеру по АПД; Входящие АПД; Типы оплат АПД; Список АПД и АПК; Контекстное меню списка АПД; Выгрузка исходящих платежей по АПД для банк-клиента.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## АПД

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%9F%D0%94  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-01-13T12:25:34Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## АПК

URL: https://wiki.courierexe.ru/index.php/%D0%90%D0%9F%D0%9A  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-01-13T12:26:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Биллинг курьеров

URL: https://wiki.courierexe.ru/index.php/%D0%91%D0%B8%D0%BB%D0%BB%D0%B8%D0%BD%D0%B3_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%BE%D0%B2  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2020-09-15T12:04:34Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Биллинг курьеров позволяет вести учет денежной корреспонденции каждого курьера. В этой статье денежная корреспонденция — доставка, в процессе которой курьер должен передать деньги в курьерскую службу.

Sahifadagi asosiy bo'limlar: Как использовать биллинг; Как включить биллинг; Как внести платеж; Как удалить платеж; Отчеты о задолженностях; Оперативная отчетность; Полная задолженность; Если корреспонденция оплачена.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Битрикс

URL: https://wiki.courierexe.ru/index.php/%D0%91%D0%B8%D1%82%D1%80%D0%B8%D0%BA%D1%81  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-11T09:04:59Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Быстрый старт

URL: https://wiki.courierexe.ru/index.php/%D0%91%D1%8B%D1%81%D1%82%D1%80%D1%8B%D0%B9_%D1%81%D1%82%D0%B0%D1%80%D1%82  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-11-11T10:16:49Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Этот раздел познакомит вас с основными функциями программы.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Ввод заявок по фото

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%B2%D0%BE%D0%B4_%D0%B7%D0%B0%D1%8F%D0%B2%D0%BE%D0%BA_%D0%BF%D0%BE_%D1%84%D0%BE%D1%82%D0%BE  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-13T14:09:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Веб-сервисы

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%B5%D0%B1-%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D1%8B  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2023-06-20T13:07:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Все ссылки на дополнительные сервисы содержат экстра_код. Экстра код — это ваш уникальный код курьерской службы.

Sahifadagi asosiy bo'limlar: Калькулятор; Трекинг по номеру; Отзывы; Настройка получения отзывов; Форма отзывов (голосование); Информирование о поступивших заказах; Внешний интерфейс сотрудников (Staff); Адреса; Собеседования; Колл-центр; Приглашенные; Геокодирование.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Видео уроки

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%B8%D0%B4%D0%B5%D0%BE_%D1%83%D1%80%D0%BE%D0%BA%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-01-27T13:36:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Видеоуроки

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%B8%D0%B4%D0%B5%D0%BE%D1%83%D1%80%D0%BE%D0%BA%D0%B8  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2022-05-18T13:58:07Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Настройка дополнительных услуг в тарифах Дополнительные услуги используются для определения стоимости доставки после сложения цен на предоставленные услуги.

Sahifadagi asosiy bo'limlar: Настройка дополнительных услуг в тарифах; Базовые представления; Редактор формул; Создание услуги «Комплектация»; Создание услуги «Подъем на этаж»; Создание услуги «Доставка к точному времени» и «Планируемая доставка»; Создание услуги «Выходной день»; Создание услуги с привязкой статуса доставки; Прием выданного инвентаря у курьера (используется модуль складского учета).

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Courier/Employee, Manifest/Act, Warehouse/Inventory, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Виды срочности

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%B8%D0%B4%D1%8B_%D1%81%D1%80%D0%BE%D1%87%D0%BD%D0%BE%D1%81%D1%82%D0%B8  
Category: Other / reference  
Relevance: HIGH  
Last wiki revision: 2022-05-17T13:39:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Внешние склады

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%BD%D0%B5%D1%88%D0%BD%D0%B8%D0%B5_%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B  
Category: Warehouse / inventory  
Relevance: HIGH  
Last wiki revision: 2022-05-31T14:46:05Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для добавления складов. Данные склада используются в карточке заказа на вкладке Вложения — можно указать, на каком складе находится товар.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Возврат

URL: https://wiki.courierexe.ru/index.php/%D0%92%D0%BE%D0%B7%D0%B2%D1%80%D0%B0%D1%82  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-06-02T12:52:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Механизм оформления возвратов используется для фиксации недоставленного товара, возврата товара после доставки покупателю или возврата заказа, а также для частичного возврата.

Sahifadagi asosiy bo'limlar: Оформление частичного возврата; Возврат на склад.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Выдача корреспонденции курьерам

URL: https://wiki.courierexe.ru/index.php/%D0%92%D1%8B%D0%B4%D0%B0%D1%87%D0%B0_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0%D0%BC  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2026-03-25T12:58:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Выдача корреспонденции предназначена для передачи курьеру заказов и заданий, направленных на выполнение профессиональной деятельности.

Sahifadagi asosiy bo'limlar: Выдача; Выдача заказов; Сопроводительные документы; Прием работы от курьера; Статус выдачи; Частичная доставка; Полный возврат; Вкладка «Выдача»; Информация о курьере; Счетчики; Панель действий; Список сотрудников.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Выходные дни

URL: https://wiki.courierexe.ru/index.php/%D0%92%D1%8B%D1%85%D0%BE%D0%B4%D0%BD%D1%8B%D0%B5_%D0%B4%D0%BD%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-03T12:37:05Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для добавления праздничных и внеплановых рабочих дней. Данные используются для расчета оплаты за услуги, оказанные в такие дни, а также сдельной составляющей зарплаты курьеров.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Client/Recipient, Payment/Cash, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Города

URL: https://wiki.courierexe.ru/index.php/%D0%93%D0%BE%D1%80%D0%BE%D0%B4%D0%B0  
Category: Geography / routing  
Relevance: LOW  
Last wiki revision: 2025-10-21T12:43:20Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Предназначен для просмотра и добавления городов и населенных пунктов с привязкой к регионам страны.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Client/Recipient, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Графики работы сотрудников

URL: https://wiki.courierexe.ru/index.php/%D0%93%D1%80%D0%B0%D1%84%D0%B8%D0%BA%D0%B8_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B_%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2025-12-01T10:14:38Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = График работы = Определяет распорядок работы сотрудников. В графике содержится учетный период работы, рабочие и выходные дни, время начала и окончания рабочего дня.

Sahifadagi asosiy bo'limlar: График работы; График работы на дату; Статусы отсутствия; Контроль посещаемости сотрудников.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Двоичные данные

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%B2%D0%BE%D0%B8%D1%87%D0%BD%D1%8B%D0%B5_%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2026-01-14T09:12:48Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для хранения служебных файлов и изображений. Поддерживает изображения в форматах BMP, JPG, GIF.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Диадок

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%B8%D0%B0%D0%B4%D0%BE%D0%BA  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2026-06-16T11:40:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Начальная настройка = # Обратитесь в СКБ Контур для выпуска электронной цифровой подписи (ЭЦП) для использования с ЭДО Диадок.

Sahifadagi asosiy bo'limlar: Начальная настройка; Обмен данными с ЭДО; Отправка документов; Ошибка отправки документов; Статусы ЭДО.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Дифференцированная стоимость доставки

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%B8%D1%84%D1%84%D0%B5%D1%80%D0%B5%D0%BD%D1%86%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D0%BE%D0%B8%D0%BC%D0%BE%D1%81%D1%82%D1%8C_%D0%B4%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B8  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2021-08-23T11:39:42Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Общее 200px|thumb|right|Оформление заказа 250px|thumb|right|Информация в отслеживании 300px|thumb|right|Дифф.

Sahifadagi asosiy bo'limlar: Общее; База; ЛК; Мобильное приложение.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Документы

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2016-12-19T11:45:17Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** {|

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Дополнительные возможности

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%B2%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D0%B8  
Category: Printing / equipment  
Relevance: LOW  
Last wiki revision: 2026-05-21T11:57:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Настройка для печатной документации CustomGivnAct - Функция позволяет заменить печатную форму, акта передачи материальных ценностей (печать из выдачи) на пользовательскую.

Sahifadagi asosiy bo'limlar: Настройка для печатной документации; Настройка всплывающих окон; Настройка документов; Настройка вида маркера; Речь диктора; Настройка мобильного приложения; Скрипты.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani printing / equipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Дополнительные модули

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-12-24T08:20:49Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль «Карта» Модуль отправки SMS-сообщений Модуль печати кассовых чеков Модуль автоматизации Модуль складского учета Мобильное приложение курьера для Android Мобильное приложение курьера для IPhone Модуль «Кросс-докинг» Модуль репликации данных

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Payment/Cash, Warehouse/Inventory, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Дополнительные сервисы

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D1%8B  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-04-08T12:10:05Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Дополнительные услуги

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8  
Category: Payment / finance  
Relevance: MEDIUM  
Last wiki revision: 2022-01-19T08:04:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Справочник предназначен для создания и редактирования пользовательских услуг.

Sahifadagi asosiy bo'limlar: Назначение; Системные услуги; Таблица дополнительных услуг; Редактор формул; Условие; Результат.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Client/Recipient, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Допуск курьеров к работе

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D0%BF%D1%83%D1%81%D0%BA_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%BE%D0%B2_%D0%BA_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%B5  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2021-09-13T14:05:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Доска приема

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D1%81%D0%BA%D0%B0_%D0%BF%D1%80%D0%B8%D0%B5%D0%BC%D0%B0  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2023-06-08T14:09:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Доска приема — инструмент для приема корреспонденции от курьеров или входящих манифестов.

Sahifadagi asosiy bo'limlar: Прием курьера; Карточка приема; Процесс приема; Прием недоставленной корреспонденции; Прием заборов; Прием незапланированной корреспонденции; Прием манифеста; Карточка приема; Процесс приема; Завершение приема; Как работает поле Статус.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Доставка корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%94%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2018-04-18T08:35:13Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Выдача курьеру Печать маршрутных листов (ведомостей), актов приема-передачи, кассовых чеков.

Sahifadagi asosiy bo'limlar: Выдача курьеру; Прием у курьера; Ввод информации о доставке; Полный возврат; Передоставка; Частичный возврат; Статус со слов курьера.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Единица корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%95%D0%B4%D0%B8%D0%BD%D0%B8%D1%86%D0%B0_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2021-11-03T13:43:05Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Единое районирование

URL: https://wiki.courierexe.ru/index.php/%D0%95%D0%B4%D0%B8%D0%BD%D0%BE%D0%B5_%D1%80%D0%B0%D0%B9%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-02-12T13:49:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Забор и замена товара

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D0%B1%D0%BE%D1%80_%D0%B8_%D0%B7%D0%B0%D0%BC%D0%B5%D0%BD%D0%B0_%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%B0  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2022-04-12T06:39:50Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Бизнес-процесс забора товара у поставщика или замены товара у покупателя предполагает приходование в курьерской службе или передачу заказчику.

Sahifadagi asosiy bo'limlar: Забор товара у поставщика для передачи заказчику с учетом по складу; Замена товара у покупателя или забор товара у поставщика для передачи заказчику без учета по складу.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Забор у клиента

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D0%B1%D0%BE%D1%80_%D1%83_%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0  
Category: Organization / network  
Relevance: MEDIUM  
Last wiki revision: 2018-04-18T08:57:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** #Создание заборных накладных #Тарификация #Настройка модуля печати кассовых чеков

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Client/Recipient, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani organization / network oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Заглавная страница

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2025-12-02T13:44:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** __NOTOC__ Эта страница — оглавление документации к системе MeaSoft. Мы постоянно дополняем и улучшаем описания функциональности.

Sahifadagi asosiy bo'limlar: Содержание; Общий раздел; Работа с заказами; Настройка системы; Для разработчиков; Сервисы; Мобильные приложения; Наши контакты; Техническая поддержка; Социальные сети; Сообщество пользователей.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Задания

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D0%B4%D0%B0%D0%BD%D0%B8%D1%8F  
Category: Other / reference  
Relevance: HIGH  
Last wiki revision: 2022-04-11T13:13:54Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вкладка предназначена для распределения поручений сотрудникам и контроля выполнения задач.

Sahifadagi asosiy bo'limlar: Новое задание; Новое периодическое задание.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Заказы

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2021-12-23T10:00:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Зарплата

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D1%80%D0%BF%D0%BB%D0%B0%D1%82%D0%B0  
Category: Payment / finance  
Relevance: MEDIUM  
Last wiki revision: 2026-06-16T11:55:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Учет заработной платы = Зарплата начисляется, если в карточке корреспонденции заполнены следующие поля: * Дата вручения и Вручил курьер; * при возврате — Вернул курьер и Дата возврата.

Sahifadagi asosiy bo'limlar: Учет заработной платы; Данные; Переменные; Предварительный расчет зарплаты; Расчеты с сотрудниками; Начисление платежей сотрудникам; Зарплата; Аванс и другие виды платежей; Карточка начисления; Выплата начисления; Начисление зарплаты при увольнении.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Зарплата (справочник)

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%B0%D1%80%D0%BF%D0%BB%D0%B0%D1%82%D0%B0_(%D1%81%D0%BF%D1%80%D0%B0%D0%B2%D0%BE%D1%87%D0%BD%D0%B8%D0%BA)  
Category: Payment / finance  
Relevance: MEDIUM  
Last wiki revision: 2022-01-18T08:26:03Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник содержит зарплатные тарифы сотрудников курьерской службы. Вы можете создать зарплатные тарифы для групп сотрудников или на доставку для определенных клиентов.

Sahifadagi asosiy bo'limlar: Основное; Дополнительно; Тарифы клиентов.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Знакомство с программой

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%BD%D0%B0%D0%BA%D0%BE%D0%BC%D1%81%D1%82%D0%B2%D0%BE_%D1%81_%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%BE%D0%B9  
Category: People / security  
Relevance: LOW  
Last wiki revision: 2024-10-14T15:41:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Раздел создан для знакомства с базовым функционалом программы. none|1200px = Интерфейс = Интерфейс позволяет решать задачи пользователя через взаимосвязь «задача — элемент интерфейса».

Sahifadagi asosiy bo'limlar: Назначение; Интерфейс; Работа с таблицами; Работа с шаблонами; Поиск информации; Горячие клавиши; Общие сведения об элементах управления; Сортировка списка адресов; Ручная сортировка; Ввод адресной информации; Кнопки в программе; Перейти к быстрому старту.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Зоны

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%BE%D0%BD%D1%8B  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-09-03T08:19:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для распределения населенных пунктов по зонам доставки. 800px|none В верхней части окна расположены переключатели: * Зоны — включает отображение зон доставки; * Сроки — включает отображение сроков доставки в рабочих днях.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Client/Recipient, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Зоны на карте

URL: https://wiki.courierexe.ru/index.php/%D0%97%D0%BE%D0%BD%D1%8B_%D0%BD%D0%B0_%D0%BA%D0%B0%D1%80%D1%82%D0%B5  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2026-01-13T12:24:57Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник позволяет устанавливать зоны тарификации клиентов и курьеров с привязкой к графическим контурам на карте при использовании дополнительного модуля «Карта».

Sahifadagi asosiy bo'limlar: Создание зон; Создание контуров на карте; Автоматическое создание колец +X км от контура; Импорт и экспорт зон.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Импорт баз данных

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BC%D0%BF%D0%BE%D1%80%D1%82_%D0%B1%D0%B0%D0%B7_%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85  
Category: Order / shipment  
Relevance: MEDIUM  
Last wiki revision: 2022-05-31T12:55:25Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Логика загрузки заказов Для загрузки заказов из MS Excel в MeaSoft используются шаблоны.

Sahifadagi asosiy bo'limlar: Логика загрузки заказов; Создание шаблона загрузки; Как указать лист с заказами в Excel-файле; Как загрузить заказы; Загрузка из одного файла; Загрузка из нескольких файлов; Автозамена; Шаблон как отдельный файл; Сохранить шаблон в файл; Добавить в систему шаблон из файла; Пример создания простого шаблона для загрузки вложений; Примеры модификаций содержимого ячеек при помощи формул.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Инвентаризация

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BD%D0%B2%D0%B5%D0%BD%D1%82%D0%B0%D1%80%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F  
Category: Warehouse / inventory  
Relevance: LOW  
Last wiki revision: 2021-09-13T13:59:59Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Интеграция с CWMS

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F_%D1%81_CWMS  
Category: Status model  
Relevance: MEDIUM  
Last wiki revision: 2022-11-04T12:03:00Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** =Внешние запросы от системы CWMS = Oбработка статуса и количества вложений Метод Реализована обработка статуса и количества вложений по url: index.php * При получение статуса 3 добавляется статус [21] Готов к выдаче * Корректируется количество вложений ** изменений количества не происходит, если товар представлен в заказе несколькими вложениями Входящие данные Документация: https://rm.cwms3000.ru/projects/communicati

Sahifadagi asosiy bo'limlar: Внешние запросы от системы CWMS; Oбработка статуса и количества вложений; Метод; Входящие данные; Ответ; Лог; Cинхронизация номенклатуры; Метод; Входящие данные; Ответ; Лог; Cинхронизация складских остатков.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Интеграция с другими системами

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F_%D1%81_%D0%B4%D1%80%D1%83%D0%B3%D0%B8%D0%BC%D0%B8_%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0%D0%BC%D0%B8  
Category: Status model  
Relevance: MEDIUM  
Last wiki revision: 2026-07-31T07:45:16Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaSoft имеет практически неограниченные возможности по интеграции с другими системами.

Sahifadagi asosiy bo'limlar: Виды интеграций; Интеграция между двумя системами MeaSoft; Настройка; Распределение заказов по признаку необходимости чека; Интеграция со сторонними системами; Интеграция с CMS-системами; Замечания; Проверка работоспособности интеграций; Интеграция с подрядчиками; Описание процесса интеграции; Последовательность финальных статусов; Boxberry.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Интеграция с платежными сервисами

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F_%D1%81_%D0%BF%D0%BB%D0%B0%D1%82%D0%B5%D0%B6%D0%BD%D1%8B%D0%BC%D0%B8_%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D0%B0%D0%BC%D0%B8  
Category: API / integration  
Relevance: MEDIUM  
Last wiki revision: 2025-02-17T07:21:28Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Доступна интеграция со следующими сервисами: * PimPay — финансирование для интернет-магазинов; * Robokassa — онлайн-оплата заказов; * Payme — онлайн-оплата заказов и мобильный эквайринг.

Sahifadagi asosiy bo'limlar: PimPay; Robokassa; Assist; ibox; LifePay СБП.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Интеграция с телефонией

URL: https://wiki.courierexe.ru/index.php/%D0%98%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F_%D1%81_%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B8%D0%B5%D0%B9  
Category: API / integration  
Relevance: MEDIUM  
Last wiki revision: 2024-04-03T13:22:30Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaSoft интегрируется с Asterisk — это самый популярный телефонный сервер, который не заменяет телефонную компанию, а дополняет ее.

Sahifadagi asosiy bo'limlar: Где взять сервер?; Интеграция мобильного приложения; Интеграция системы с телефонным сервером; Обратные запросы от Asterisk; Записи разговоров; Устранение неполадок.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## История версий

URL: https://wiki.courierexe.ru/index.php/%D0%98%D1%81%D1%82%D0%BE%D1%80%D0%B8%D1%8F_%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D0%B9  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2018-03-20T10:03:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** История версий Данная страница устарела! Актуальную историю изменений смотрите здесь: https://home.courierexe.ru/whatsnew 2018 год {| class="wikitable" style="margin: auto" align=center;style="color:black;background-color:#ffffcc;" cellpadding="10" cellspacing="0" border="2" width="100%" {| class="wikitable" style="margin: auto" align=center;style="color:black;background-color:#ffffcc;" cellpadding="10" cellspacing="

Sahifadagi asosiy bo'limlar: История версий; 2018 год; 2017 год; 2016 год; 2015-2012 годы.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как выдать корреспонденцию курьеру

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B2%D1%8B%D0%B4%D0%B0%D1%82%D1%8C_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D1%8E_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D1%83  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-05-31T14:51:00Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Передачу корреспонденции на руки курьеру необходимо отмечать в программе. Это позволит отслеживать статус выполняемых заказов.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Как выставить счет

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B2%D1%8B%D1%81%D1%82%D0%B0%D0%B2%D0%B8%D1%82%D1%8C_%D1%81%D1%87%D0%B5%D1%82  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2020-08-07T06:40:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Чтобы получить деньги за услуги, курьерская служба должна выставить клиенту счет на оплату.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как добавить заказ и адреса

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B4%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7_%D0%B8_%D0%B0%D0%B4%D1%80%D0%B5%D1%81%D0%B0  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2020-08-07T06:39:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Каждый заказ в системе привязан к существующему клиенту. Чтобы добавить заказ, надо заранее создать клиента в системе.

Sahifadagi asosiy bo'limlar: Создайте заказ; Добавьте адреса в заказ.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Как добавить клиента

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B4%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C_%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0  
Category: Payment / finance  
Relevance: MEDIUM  
Last wiki revision: 2021-09-03T08:04:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Чтобы добавить клиента, перейдите на вкладку Клиенты в верхнем меню программы. В открывшемся окне обязательно заполните вкладки Основное, Реквизиты и Финансы.

Sahifadagi asosiy bo'limlar: Заполните основные сведения; Заполните реквизиты; Заполните вкладку финансы.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Как закрыть АПД

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B7%D0%B0%D0%BA%D1%80%D1%8B%D1%82%D1%8C_%D0%90%D0%9F%D0%94  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2022-01-17T13:47:09Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Чтобы закрыть акт передачи денег (АПД), курьерская служба должна вернуть клиенту деньги за его товар.

Sahifadagi asosiy bo'limlar: Оплата наличными; Доставка наличных курьером; Оплата через банк-клиент.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как закрыть счет

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B7%D0%B0%D0%BA%D1%80%D1%8B%D1%82%D1%8C_%D1%81%D1%87%D0%B5%D1%82  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2022-11-14T12:08:27Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Выставленный счет называют закрытым (оплаченным), когда полная сумма к оплате поступает от клиента на баланс курьерской службы.

Sahifadagi asosiy bo'limlar: Оплата наличными; Безналичная оплата; Загрузка из банк-клиента.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как запланировать отправление на курьера

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%B7%D0%B0%D0%BF%D0%BB%D0%B0%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C_%D0%BE%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BD%D0%B0_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2020-08-07T06:39:43Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Планирование — процесс назначения доставок каждому курьеру. Его используют компании, которые выполняют доставку на следующий день после получения заказа или позже.

Sahifadagi asosiy bo'limlar: Планирование по маркерам; Планирование по зонам.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Как принять работу у курьера

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D0%BF%D1%80%D0%B8%D0%BD%D1%8F%D1%82%D1%8C_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%83_%D1%83_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-02-03T10:13:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** После выполнения доставок курьер возвращается в офис. Если часть заказов выполнить не удалось, то курьер сдает корреспонденцию оператору.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Как с нами работать

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D1%81_%D0%BD%D0%B0%D0%BC%D0%B8_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%B0%D1%82%D1%8C  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2022-08-30T09:08:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Уважаемый (потенциальный?) пользователь системы MeaSoft! В этой статье я опишу теорию и практику взаимодействия с нашей компанией, отвечу на часто задаваемые вопросы касающиеся этого взаимодействия.

Sahifadagi asosiy bo'limlar: О системе; Бизнес-модель; Эффективность; Команда; Задачи; Экстремальное программирование; Коммуникация; Бюрократия; Поддержка; Эволюция; Отказ от ответственности; Что входит в покупку (аренду) системы.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как создать АПД

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C_%D0%90%D0%9F%D0%94  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-01-17T13:50:16Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Акты передачи денег (АПД) нужны если курьерская служба принимает деньги за товар от получателей.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Как сформировать сопроводительные документы

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D0%BA_%D1%81%D1%84%D0%BE%D1%80%D0%BC%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C_%D1%81%D0%BE%D0%BF%D1%80%D0%BE%D0%B2%D0%BE%D0%B4%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2021-09-03T08:38:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Набор документов к печати отличается в зависимости от процессов курьерской службы.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Карта

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D1%80%D1%82%D0%B0  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-09-07T13:43:45Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Карточка корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-02-18T14:35:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Карточка корреспонденции = Карточка единицы корреспонденции содержит следующие вкладки: * Получатель * Отправитель * Межгород * Выдача * Финансы * Прочее * Услуги * Вложения * Места * Пользовательская Общие поля Номер.

Sahifadagi asosiy bo'limlar: Карточка корреспонденции; Общие поля; Функции; Получатель; Отправитель; Межгород; Выдача; Финансы; Прочее; Услуги; Вложения; Места.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Кладовщик — мобильное приложение для Android

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%BB%D0%B0%D0%B4%D0%BE%D0%B2%D1%89%D0%B8%D0%BA_%E2%80%94_%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5_%D0%B4%D0%BB%D1%8F_Android  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2024-02-08T13:34:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** thumb|200px|right Приложение Кладовщик позволяет использовать мобильный телефон как сканер штрихкодов или ТСД при работе в MeaSoft.

Sahifadagi asosiy bo'limlar: Настройка ТСД; Начало работы со сканером; Начало работы с ТСД; Настройки приема; Прием отправлений; Выдача курьеру; Поиск отправлений.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Клиенты и партнеры

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D1%8B_%D0%B8_%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D0%B5%D1%80%D1%8B  
Category: Order / shipment  
Relevance: MEDIUM  
Last wiki revision: 2026-01-30T09:18:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Вкладка Клиенты предназначена для хранения списка клиентов, учета новых и изменения данных существующих партнеров и контрагентов.

Sahifadagi asosiy bo'limlar: Назначение; Список клиентов; Карточка клиента; Основное; Реквизиты; Финансы; Прочее; Касса; Уведомления; Отделы; Пользовательская; Создание клиента.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Колл-центр

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%BE%D0%BB%D0%BB-%D1%86%D0%B5%D0%BD%D1%82%D1%80  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-17T06:36:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Коэффициенты

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D0%BE%D1%8D%D1%84%D1%84%D0%B8%D1%86%D0%B8%D0%B5%D0%BD%D1%82%D1%8B  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-02T15:17:20Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Коэффициенты применяются к тарифу доставки в выбранный региональный центр при вычислении стоимости доставки в другие населенные пункты региона.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Manifest/Act, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Кросс-докинг

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D1%80%D0%BE%D1%81%D1%81-%D0%B4%D0%BE%D0%BA%D0%B8%D0%BD%D0%B3  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-07T08:44:42Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Курсы валют

URL: https://wiki.courierexe.ru/index.php/%D0%9A%D1%83%D1%80%D1%81%D1%8B_%D0%B2%D0%B0%D0%BB%D1%8E%D1%82  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-05-25T13:30:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вы можете вести расчеты с клиентами и сотрудниками в разных валютах. Чтобы добавить валюту: # Откройте Справочники > Статусы > 32 Валюты и в контекстном меню выберите Добавить.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Courier/Employee, Client/Recipient, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Личный кабинет

URL: https://wiki.courierexe.ru/index.php/%D0%9B%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2018-07-25T09:38:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Client/Recipient.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Личный кабинет клиента

URL: https://wiki.courierexe.ru/index.php/%D0%9B%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82_%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0  
Category: Courier / delivery  
Relevance: MEDIUM  
Last wiki revision: 2026-06-05T14:07:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Личный кабинет предназначен для клиентов и партнеров курьерской службы, работающей в системе MeaSoft.

Sahifadagi asosiy bo'limlar: Главная страница; Новый заказ; Создание заказа вручную; Зависимости отображения полей в форме заказа; Особенность подстановки планируемой даты доставки; Изменение интервалов времени доставки; Передача и подстановка значений полей формы создания заказа через GET параметры; Заявка на забор; Привезти ко мне; Загрузка реестра Excel; Создание заказа копированием; Добавление товара.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Личный кабинет курьера

URL: https://wiki.courierexe.ru/index.php/%D0%9B%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2023-03-01T12:47:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** С помощью личного кабинета курьер может: * посмотреть заказы на завтра для более удобного планирования будущей работы; * посмотреть детализацию зарплаты.

Sahifadagi asosiy bo'limlar: Заказы на завтра; Зарплата.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Личный кабинет курьерской службы

URL: https://wiki.courierexe.ru/index.php/%D0%9B%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D1%81%D0%BA%D0%BE%D0%B9_%D1%81%D0%BB%D1%83%D0%B6%D0%B1%D1%8B  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-06-16T12:26:33Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Личный кабинет курьерской службы предназначен для настройки личного кабинета клиента.

Sahifadagi asosiy bo'limlar: Функции личного кабинета; Подключение; Изменение пароля клиента; Авторизация под отделом; Настройка личного кабинета клиента; Настройка полей; Настройка видимости полей для групп клиентов; Настройка полей и вкладок; Настройки; Заказы; Курьеры; Финансы.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Логистика

URL: https://wiki.courierexe.ru/index.php/%D0%9B%D0%BE%D0%B3%D0%B8%D1%81%D1%82%D0%B8%D0%BA%D0%B0  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-13T14:10:19Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Максоптра

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D0%BA%D1%81%D0%BE%D0%BF%D1%82%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2022-03-11T13:56:42Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** MeaSoft — официальный дилер системы маршрутизации Максоптра. Мы предоставляем услуги маршрутизации по основному договору, по специальным ценам, доступным только пользователям нашей системы.

Sahifadagi asosiy bo'limlar: С чего начать; Настройка распределительных центров; Создание пользователя с ролью диспетчера; Настройка подключения к Максоптре; Настройка курьеров; Настройка автомобилей; Пешие курьеры; Настройка территорий; Построение маршрутов; Печать акта и мобильное приложение; Устранение неполадок.

### Muhim business rule

- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Манифесты

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D0%BD%D0%B8%D1%84%D0%B5%D1%81%D1%82%D1%8B  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2026-02-10T13:49:56Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Управление манифестами = ; Манифест : Объединение корреспонденции в мешки, транспортные места и т.

Sahifadagi asosiy bo'limlar: Управление манифестами; Манифесты; Контекстное меню таблиц; Подсветка полей таблицы; Создание манифеста; Планирование отправки; Таможенное оформление отправления; Комплектация отправления; Отправка; Транзитные места; Сопроводительные документы; Статусы манифеста.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Марки автомобилей

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D1%80%D0%BA%D0%B8_%D0%B0%D0%B2%D1%82%D0%BE%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D0%B5%D0%B9  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2021-09-15T15:13:13Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для хранения данных о вместимости и расходе ГСМ для разных марок автомобилей.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Маркировка

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D1%80%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0  
Category: Warehouse / inventory  
Relevance: MEDIUM  
Last wiki revision: 2021-03-24T11:19:49Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Маркировка мест

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D1%80%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0_%D0%BC%D0%B5%D1%81%D1%82  
Category: Warehouse / inventory  
Relevance: MEDIUM  
Last wiki revision: 2021-09-13T14:04:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Массовая рассылка по клиентам

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B0%D1%81%D1%81%D0%BE%D0%B2%D0%B0%D1%8F_%D1%80%D0%B0%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B0_%D0%BF%D0%BE_%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%D0%BC  
Category: Automation / notification  
Relevance: MEDIUM  
Last wiki revision: 2022-03-22T14:35:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Функция предназначена для одновременной отправки электронного письма выбранным клиентам.

Sahifadagi asosiy bo'limlar: Настройки рассылки; Отправка сообщения.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Client/Recipient, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani automation / notification oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Междугородние перевозки

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B5%D0%B6%D0%B4%D1%83%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D0%BD%D0%B8%D0%B5_%D0%BF%D0%B5%D1%80%D0%B5%D0%B2%D0%BE%D0%B7%D0%BA%D0%B8  
Category: Geography / routing  
Relevance: LOW  
Last wiki revision: 2021-12-09T12:48:39Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Manifest/Act, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Межфилиальная бухгалтерия

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B5%D0%B6%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F  
Category: Payment / finance  
Relevance: MEDIUM  
Last wiki revision: 2025-12-16T16:15:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Инкассация филиала Интерфейс позволяет отправить наличные деньги в другой филиал.

Sahifadagi asosiy bo'limlar: Инкассация филиала; Принять деньги от филиала; Баланс; Инкассация; Банкомат; Коды банкоматов; Терминал; Кода терминалов.

### Muhim business rule

- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Метро

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%B5%D1%82%D1%80%D0%BE  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2021-09-03T08:20:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник служит для добавления новых станций метро и редактирования их параметров.

Sahifadagi asosiy bo'limlar: Просмотр и редактирование станций; Добавление линии метро; Добавление станции метро; Если в городе нет метро; Ручная настройка работы справочника.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Многофилиальность

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BD%D0%BE%D0%B3%D0%BE%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D1%8C  
Category: Organization / network  
Relevance: MEDIUM  
Last wiki revision: 2021-11-02T09:01:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani organization / network oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Мобильное приложение кладовщика для Android

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B1%D0%B8%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BA%D0%BB%D0%B0%D0%B4%D0%BE%D0%B2%D1%89%D0%B8%D0%BA%D0%B0_%D0%B4%D0%BB%D1%8F_Android  
Category: Mobile / services  
Relevance: LOW  
Last wiki revision: 2021-08-03T13:26:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani mobile / services oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Мобильное приложение курьера для Android

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B1%D0%B8%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0_%D0%B4%D0%BB%D1%8F_Android  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2026-07-24T08:34:14Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Назначение Приложение предназначено для работы совместно с системой MeaSoft и со сторонними системами, которые можно подключить через специальное API.

Sahifadagi asosiy bo'limlar: Назначение; Выбор устройства; Установка; Настройка; Регистрация пользователя; Регистрация сканированием QR-кода; Регистрация через токен; Получение заказов; Прием заказов; Список заказов; Быстрые действия по заказу; Заказы на сегодня.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Мобильное приложение курьера для IPhone

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B1%D0%B8%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0_%D0%B4%D0%BB%D1%8F_IPhone  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2025-08-19T12:27:27Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here Назначение thumb|200px|right Приложение предназначено для работы совместно с системой MeaSoft.

Sahifadagi asosiy bo'limlar: Назначение; Выбор устройства; Установка; Настройка; Регистрация сканированием QR-кода; Список заказов; Получение новых заказов; Заказы на сегодня; Закрытые заказы; Заказы на завтра; Обновление списка заказов; Отображение на карте.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Модуль «Карта»

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%C2%AB%D0%9A%D0%B0%D1%80%D1%82%D0%B0%C2%BB  
Category: Courier / delivery  
Relevance: MEDIUM  
Last wiki revision: 2026-03-25T06:57:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Назначение Модуль предназначен для визуального планирования городских доставок и создания тарифных зон на карте в режиме единого районирования.

Sahifadagi asosiy bo'limlar: Назначение; Заказы на карте; Ненайденные адреса; Настройки; Настройка карты; Группировка адресов; Печать; Хинты; Дополнительные возможности; Виды планирования; Ручное планирование по курьерам; Планирование схемами по курьерам.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Модуль «Кросс-докинг»

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%C2%AB%D0%9A%D1%80%D0%BE%D1%81%D1%81-%D0%B4%D0%BE%D0%BA%D0%B8%D0%BD%D0%B3%C2%BB  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2022-05-30T11:38:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль используется, когда курьерская служба оказывает услугу по комплектации заказов.

Sahifadagi asosiy bo'limlar: Интерфейс; Комплектация; Операция «положить товар на полку»; Учет мест и упаковки; Операция «снять заказ с полки»; Модификации операции «Положить товар на полку»; Модификация печати стикера адреса; Дополнение; Адресное хранение; Сборка комплектов.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Модуль Карта

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%D0%9A%D0%B0%D1%80%D1%82%D0%B0  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-02-05T08:43:45Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Модуль отправки SMS-сообщений

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%D0%BE%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B8_SMS-%D1%81%D0%BE%D0%BE%D0%B1%D1%89%D0%B5%D0%BD%D0%B8%D0%B9  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2023-02-28T13:54:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Настройка SMS-сообщений Дополнительный модуль SMS-сообщений позволяет системе отправлять SMS-сообщения с использованием услуг ряда провайдеров.

Sahifadagi asosiy bo'limlar: Настройка SMS-сообщений; Провайдеры; Особенности провайдеров; BitCall; SMS Gold Viber; Добавление кнопки; Добавление изображения; Интис; Почему мои сообщения не доставлены?; Почему уходит много денег?.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Модуль репликации данных

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%D1%80%D0%B5%D0%BF%D0%BB%D0%B8%D0%BA%D0%B0%D1%86%D0%B8%D0%B8_%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85  
Category: API / integration  
Relevance: HIGH  
Last wiki revision: 2022-05-25T07:15:04Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль репликации используется для синхронизации данных между инсталляциями системы, а также между офисной базой данных и сайтом.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Модуль складского учета

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%D1%83%D1%87%D0%B5%D1%82%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-05-12T12:52:55Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль складского учета предназначен для автоматизации ответственного хранения товара на складе курьерской службы.

Sahifadagi asosiy bo'limlar: Подключение и отключение модуля; Пункт меню «Склад»; Номенклатура; Карточка товара; Постановка на приход; Создать накладную; Работа с накладными; Списание; Переброска; Акт приема-передачи; Отчеты по складу; Расчет стоимости хранения.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Модуль сортировки

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C_%D1%81%D0%BE%D1%80%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-06-24T12:27:08Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## МойСклад

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%BE%D0%B9%D0%A1%D0%BA%D0%BB%D0%B0%D0%B4  
Category: Warehouse / inventory  
Relevance: HIGH  
Last wiki revision: 2025-10-27T07:39:26Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Интеграция предназначена для передачи заказов с товарными вложениями из системы МойСклад в MeaSoft.

Sahifadagi asosiy bo'limlar: Настройка интеграции; Обновление данных из ЛК; Передача дробных значений количества; Передача данных из ЛК в МойСклад; Передача Маркировки из ЛК в МойСклад; Известные проблемы.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## МХ-3

URL: https://wiki.courierexe.ru/index.php/%D0%9C%D0%A5-3  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-13T13:57:04Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Направления (срочные заказы)

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F_(%D1%81%D1%80%D0%BE%D1%87%D0%BD%D1%8B%D0%B5_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B)  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2016-07-21T11:12:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** thumb|600px|right|рис 1. Вкладка "Направления" Для оперативного управления планированием на курьеров срочных заказов в системе предназначена отдельная вкладка "Направления".

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Настройка глобальных параметров

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%B3%D0%BB%D0%BE%D0%B1%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D1%85_%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D0%BE%D0%B2  
Category: Geography / routing  
Relevance: LOW  
Last wiki revision: 2025-07-22T15:47:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Настройка параметров системы Настройка параметров системы состоит из следующих этапов: # Настройка сервера.

Sahifadagi asosiy bo'limlar: Настройка параметров системы; Настройка параметров прокси-сервера; Настройка подключения к почтовому серверу; Пример настройки для Яндекс.Почты; Пример настройки для Mail.ru; Пример настройки для Google-почты.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Настройка личного кабинета

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%BB%D0%B8%D1%87%D0%BD%D0%BE%D0%B3%D0%BE_%D0%BA%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%D0%B0  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2018-07-25T09:38:55Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Настройка модуля автоматизации

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D1%8F_%D0%B0%D0%B2%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2026-01-19T12:49:26Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль автоматизации (интеграции с внешними системами) предназначен для выполнения периодических заданий импорта, экспорта, обработки данных.

Sahifadagi asosiy bo'limlar: Рекомендации для создания автоматической e-mail/смс рассылки; Установка; Настройка; Создание заданий; Интерпретируемый код; Импорт данных; Экспорт данных; Примеры использования; Импорт заказов в стандартном формате с FTP-сервера; Экспорт заказов в CSV-файле на FTP-сервер; Сохранение текста письма в таблицу algocom.sample_messsage от аккаунта с кодом 2; Устранение неполадок.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Настройка модуля интеграции с внешними системами

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D1%8F_%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D0%B8_%D1%81_%D0%B2%D0%BD%D0%B5%D1%88%D0%BD%D0%B8%D0%BC%D0%B8_%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0%D0%BC%D0%B8  
Category: API / integration  
Relevance: MEDIUM  
Last wiki revision: 2015-08-20T12:44:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Настройка модуля печати кассовых чеков

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%BC%D0%BE%D0%B4%D1%83%D0%BB%D1%8F_%D0%BF%D0%B5%D1%87%D0%B0%D1%82%D0%B8_%D0%BA%D0%B0%D1%81%D1%81%D0%BE%D0%B2%D1%8B%D1%85_%D1%87%D0%B5%D0%BA%D0%BE%D0%B2  
Category: Payment / finance  
Relevance: HIGH  
Last wiki revision: 2026-07-21T07:07:28Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль интеграции с фискальным регистратором (печати кассовых чеков) предназначен для обеспечения возможности взаимодействия системы MeaSoft с фискальными регистраторами.

Sahifadagi asosiy bo'limlar: Применение; Установка чековой службы; Настройка чековой службы; Настройка ФР Штрих-М; Обрезка чека; Отчет по секциям; Проверка корректности регистрации в ОФД; Подключение логирования драйвером Штрих-М; Проверка корректности передачи тегов в ОФД; Удаление службы; Примечания; Устранение неполадок.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Настройка параметров рабочего места

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D0%BE%D0%B2_%D1%80%D0%B0%D0%B1%D0%BE%D1%87%D0%B5%D0%B3%D0%BE_%D0%BC%D0%B5%D1%81%D1%82%D0%B0  
Category: Printing / equipment  
Relevance: MEDIUM  
Last wiki revision: 2026-07-07T16:10:11Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Подключение рабочего места к серверу = Чтобы настроить подключение к серверу, на рабочем столе компьютера в контекстном меню ярлыка MeaSoft выберите Свойства.

Sahifadagi asosiy bo'limlar: Подключение рабочего места к серверу; Настройка рабочего места; Ввод; Отображение; Подключения; Оборудование; Печать; Речь.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Payment/Cash, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani printing / equipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Настройка системы

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D1%81%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D1%8B  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2019-08-23T10:51:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** {|

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Настройка триггеров для RetailCRM

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0_%D1%82%D1%80%D0%B8%D0%B3%D0%B3%D0%B5%D1%80%D0%BE%D0%B2_%D0%B4%D0%BB%D1%8F_RetailCRM  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-01-28T07:34:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Начало использования

URL: https://wiki.courierexe.ru/index.php/%D0%9D%D0%B0%D1%87%D0%B0%D0%BB%D0%BE_%D0%B8%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-04-27T13:58:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вход в систему При запуске файла courier.exe после успешного подключения к серверу базы данных появляется окно следующего вида: none|400 px Введите имя пользователя и пароль.

Sahifadagi asosiy bo'limlar: Вход в систему; Начальная настройка.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Оборудование

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D0%B1%D0%BE%D1%80%D1%83%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-08-17T13:44:58Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Аппаратные требования к рабочей станции * Работа под управлением ОС Windows 32/64 Bit: Win7, Win8; Win10; Win11.

Sahifadagi asosiy bo'limlar: Аппаратные требования к рабочей станции; Выбор сервера для системы; Выбор серверного оборудования; Выбор серверной операционной системы; Размещение сервера; Доступ для установки системы; Рекомендованное периферийное оборудование; Сканер штрихкодов; Термопринтер; Весы; Фискальный регистратор; Банковский POS-терминал.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Описание стандартного протокола интеграции

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5_%D1%81%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BD%D0%BE%D0%B3%D0%BE_%D0%BF%D1%80%D0%BE%D1%82%D0%BE%D0%BA%D0%BE%D0%BB%D0%B0_%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D0%B8  
Category: Status model  
Relevance: MEDIUM  
Last wiki revision: 2013-05-16T07:19:19Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Описание стандартного протокола интеграции системы «Курьерская служба 2008» с внешними системами.

Sahifadagi asosiy bo'limlar: Формат передачи данных о заказе; Формат передачи данных о статусе заказа.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Описание формата экспорта счетов в 1С

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5_%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%82%D0%B0_%D1%8D%D0%BA%D1%81%D0%BF%D0%BE%D1%80%D1%82%D0%B0_%D1%81%D1%87%D0%B5%D1%82%D0%BE%D0%B2_%D0%B2_1%D0%A1  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2021-03-03T13:48:20Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Назначение Формат предназначен для передачи информации о некоторых бухгалтерских документах из системы MeaSoft в сторонние системы, в первую очередь — 1С-бухгалтерия.

Sahifadagi asosiy bo'limlar: Назначение; Общие понятия; Описание полей данных; Образец документа; Описание полей документа.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Основные принципы работы в программе

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D0%BD%D1%8B%D0%B5_%D0%BF%D1%80%D0%B8%D0%BD%D1%86%D0%B8%D0%BF%D1%8B_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B_%D0%B2_%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%B5  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2020-06-16T03:34:39Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Отладчик встроенных скриптов

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%82%D0%BB%D0%B0%D0%B4%D1%87%D0%B8%D0%BA_%D0%B2%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BD%D0%BD%D1%8B%D1%85_%D1%81%D0%BA%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D0%B2  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2026-03-17T16:23:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Интерфейс = Файл:ScriptDebugger.png Отладчик скриптов — рабочий инструмент для разработки и диагностики скриптов встроенного языка.

Sahifadagi asosiy bo'limlar: Интерфейс; Основные возможности; Интерфейс отладчика; Редактор кода; Лог; Кнопки управления; Работа с отладчиком; Установка точек останова; Просмотр переменных; Наблюдение за выражениями; Работа с файлами; Открытие файла с отслеживанием.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Отправка корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B0_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2021-12-09T12:26:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Отчеты

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%82%D1%87%D0%B5%D1%82%D1%8B  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2023-11-16T16:31:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Отчеты содержат информацию о выполненных действиях и результатах проведённой работы.

Sahifadagi asosiy bo'limlar: Назначение; Клиенты; Задолженности клиентов; Оборот по клиентам помесячно; Количество доставок по клиентам помесячно; Количество новых клиентов помесячно; Статистика % доставок по клиентам; Долги перед Интернет-магазинами; Возвраты на складе; Сотрудники; Дни рождения сотрудников; Работающие сотрудники.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Охрана

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%85%D1%80%D0%B0%D0%BD%D0%B0  
Category: People / security  
Relevance: MEDIUM  
Last wiki revision: 2022-05-25T09:01:59Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вкладка предназначена для отметки фактического рабочего времени сотрудника. Для этого на входе сотрудник сканирует удостоверение сотрудника на открытой вкладке Охрана.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Очередь обработки ГИИС ДМДК

URL: https://wiki.courierexe.ru/index.php/%D0%9E%D1%87%D0%B5%D1%80%D0%B5%D0%B4%D1%8C_%D0%BE%D0%B1%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B8_%D0%93%D0%98%D0%98%D0%A1_%D0%94%D0%9C%D0%94%D0%9A  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2026-04-03T13:48:08Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Введение Получить доступ к функционалу журнала обработки запросов в ГИИС ДМДК можно через: * пункт главного меню «Отчеты» - «Касса» - «Очередь обработки ГИИС ДМДК», здесь отображаются все запросы для корреспонденций в системе; * пункт меню карточки корреспонденции «Функции» - «Очередь обработки ГИИС ДМДК», здесь отображается информация по запросам только конкретной корреспонденции.

Sahifadagi asosiy bo'limlar: Введение; Обзор интерфейса; Особенности работы; Полезные ссылки.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Перевозчики

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%B5%D1%80%D0%B5%D0%B2%D0%BE%D0%B7%D1%87%D0%B8%D0%BA%D0%B8  
Category: Other / reference  
Relevance: MEDIUM  
Last wiki revision: 2022-02-02T13:27:21Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для добавления и хранения информации о компаниях-перевозчиках.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Печатные формы

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%B5%D1%87%D0%B0%D1%82%D0%BD%D1%8B%D0%B5_%D1%84%D0%BE%D1%80%D0%BC%D1%8B  
Category: Printing / equipment  
Relevance: MEDIUM  
Last wiki revision: 2024-04-02T09:32:02Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для создания и хранения печатных форм. Окно справочника выглядит следующим образом: none Таблица слева содержит типы печатных форм, в таблице справа — печатные формы выбранного типа.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Client/Recipient, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani printing / equipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Печать ведомостей и наклеек

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%B5%D1%87%D0%B0%D1%82%D1%8C_%D0%B2%D0%B5%D0%B4%D0%BE%D0%BC%D0%BE%D1%81%D1%82%D0%B5%D0%B9_%D0%B8_%D0%BD%D0%B0%D0%BA%D0%BB%D0%B5%D0%B5%D0%BA  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2026-05-20T08:48:18Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** После ввода заказа, как правило, на корреспонденцию распечатываются наклейки или ведомости (накладные).

Sahifadagi asosiy bo'limlar: Наклейки; Ведомости; Различие штрихкодов наклеек и накладных.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Печать служебных штрихкодов

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%B5%D1%87%D0%B0%D1%82%D1%8C_%D1%81%D0%BB%D1%83%D0%B6%D0%B5%D0%B1%D0%BD%D1%8B%D1%85_%D1%88%D1%82%D1%80%D0%B8%D1%85%D0%BA%D0%BE%D0%B4%D0%BE%D0%B2  
Category: Warehouse / inventory  
Relevance: MEDIUM  
Last wiki revision: 2021-09-13T14:01:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## План изучения MeaSoft

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BB%D0%B0%D0%BD_%D0%B8%D0%B7%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D1%8F_MeaSoft  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2022-01-17T09:49:59Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Раздел предназначен для навигации по темам обучения для новых пользователей MeaSoft.

Sahifadagi asosiy bo'limlar: Настройка ярлыка программы; Общие элементы системы; Справочники; Создание заказа; Вручную; Через Excel*; Через ЛК*; Интеграции*; Настройка ЛК клиента*; Вывод полей*; Работа с ЛК клиента*; Работа с заборами*.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Платежи

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BB%D0%B0%D1%82%D0%B5%D0%B6%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-10T08:35:19Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Пользователи

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2025-08-19T13:10:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Администратор системы определяет доступные функции программы для каждого пользователя.

Sahifadagi asosiy bo'limlar: Назначение; Создание группы; Создание пользователя; Отключение пользователя; Копирование права группы; Копирование в существующую; Копирование в новую; Окно поступивших заказов; Права пользователей.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Пользовательские отчеты

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D1%81%D0%BA%D0%B8%D0%B5_%D0%BE%D1%82%D1%87%D0%B5%D1%82%D1%8B  
Category: People / security  
Relevance: HIGH  
Last wiki revision: 2024-04-25T16:02:26Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Для управления пользователями выберите пункт «Дополнительные возможности» меню «Отчеты» главного меню программы.

Sahifadagi asosiy bo'limlar: Примечания.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Пользовательские поля

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D1%81%D0%BA%D0%B8%D0%B5_%D0%BF%D0%BE%D0%BB%D1%8F  
Category: People / security  
Relevance: HIGH  
Last wiki revision: 2024-12-06T13:44:41Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Пользовательские поля отображаются на вкладке Пользовательская в карточках следующих объектов системы: * заказ; * корреспонденция; * сотрудник; * клиент; * тариф; * зарплата сотрудников.

Sahifadagi asosiy bo'limlar: Пример использования.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Почта России

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D0%BE%D1%87%D1%82%D0%B0_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2026-05-05T14:36:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Интеграция позволяет передавать заказы на доставку в Почту России и автоматически получать статусы доставки.

Sahifadagi asosiy bo'limlar: Подготовка; Настройка интеграции; Отправка; Получение Агентской цены; Сопроводительные документы; Этикетки (наклейки с кодом ПР); Конверты C4, С5; Уведомление формы Ф-119; Адресный ярлык, формы 7А, 7П; Наложенный платеж, форма Ф-112ЭП; Опись вложений, форма Ф-107; Реестры.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Прием корреспонденции на склад

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D1%80%D0%B8%D0%B5%D0%BC_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8_%D0%BD%D0%B0_%D1%81%D0%BA%D0%BB%D0%B0%D0%B4  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-03-03T15:49:45Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Прием корреспонденции — это функция для приема поступлений на складе и распределения между курьерами/регионами для доставки.

Sahifadagi asosiy bo'limlar: Назначение; Прием корреспонденции; Настройки приема; Места; Многоместная корреспонденция; Вариант приема отправлений; Взвешивание и обмер корреспонденции; Печать накладных и этикеток; Самовывоз; Планирование на курьера; Предварительная сборка комплектов.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Прием работы от курьера

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D1%80%D0%B8%D0%B5%D0%BC_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B_%D0%BE%D1%82_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2018-04-18T08:40:50Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** #Выдача #Отказы/переносы #Частичные возвраты #Контроль сданных возвратов #Контроль сданных накладных #Приходные кассовые ордера

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Приходные кассовые ордера

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D1%80%D0%B8%D1%85%D0%BE%D0%B4%D0%BD%D1%8B%D0%B5_%D0%BA%D0%B0%D1%81%D1%81%D0%BE%D0%B2%D1%8B%D0%B5_%D0%BE%D1%80%D0%B4%D0%B5%D1%80%D0%B0  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2021-03-03T14:01:42Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ;Приходный кассовый ордер (ПКО) :Первичный бухгалтерский документ, на основании которого осуществляется приём наличных денежных средств в кассу предприятия.

Sahifadagi asosiy bo'limlar: Прием денег от курьера; Экспорт в 1С.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Путевые листы

URL: https://wiki.courierexe.ru/index.php/%D0%9F%D1%83%D1%82%D0%B5%D0%B2%D1%8B%D0%B5_%D0%BB%D0%B8%D1%81%D1%82%D1%8B  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2021-09-03T08:03:40Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Путевые листы выдаются курьерам-водителям. Путевой лист гарантирует автокурьеру формальное или фактическое подтверждение маршрута следования автомобиля при проверке соответствующими органами, например ГИБДД.

Sahifadagi asosiy bo'limlar: Предварительные действия; Виды путевых листов; Формальный путевой лист; Фактический путевой лист; Карточка путевого листа.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Работа c linux

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_c_linux  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-10-31T12:48:08Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Перед прочтением обратите внимание на эту статью. Сервер MeaSoft может работать на операционной системе Linux, но при этом на ней не могут жить службы Windows (автоматизация, чековая служба).

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Работа с заказами

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D1%81_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D0%B0%D0%BC%D0%B8  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2021-11-16T14:29:00Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ;Заказ : Единовременно переданные клиентом отправления. Заказ может включать одно отправление или объединять несколько отправлений на доставку от одного клиента.

Sahifadagi asosiy bo'limlar: Виды заказов; Логика работы с заказами; Способы добавления заказов; Способы приема заказа; Список заказов; Карточка заказа; Как добавить заказ вручную; Создайте заказ; Укажите адреса; Выдайте заказ курьеру; Удаление заказа.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Работа с Почтой России

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D1%81_%D0%9F%D0%BE%D1%87%D1%82%D0%BE%D0%B9_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-12-14T14:39:39Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Работа с пунктами самовывоза (ПВЗ)

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D1%81_%D0%BF%D1%83%D0%BD%D0%BA%D1%82%D0%B0%D0%BC%D0%B8_%D1%81%D0%B0%D0%BC%D0%BE%D0%B2%D1%8B%D0%B2%D0%BE%D0%B7%D0%B0_(%D0%9F%D0%92%D0%97)  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2022-05-31T13:00:58Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Введение Пунктами самовывоза могут быть склады и филиалы курьерской службы, а также отделения партнеров курьерской службы.

Sahifadagi asosiy bo'limlar: Введение; Пример создания корреспонденции с указанием ПВЗ; Загрузка ПВЗ через интеграцию (СДЭК, BOXBERRY); Права пользователя на просмотр заказов всех филиалов; Работа с ПВЗ в личном кабинете; Импорт из файла Excel с указанием ПВЗ.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Работа со срочными заказами

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D1%81%D0%BE_%D1%81%D1%80%D0%BE%D1%87%D0%BD%D1%8B%D0%BC%D0%B8_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D0%B0%D0%BC%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2022-04-11T14:45:12Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Районы

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D0%B9%D0%BE%D0%BD%D1%8B  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-09-03T08:17:46Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для указания районов доставки и назначения курьеров на работу в этих районах.

Sahifadagi asosiy bo'limlar: Районы (единое районирование); Районы (планирование по станциям метро).

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Распечатать форму МХ-3

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D1%81%D0%BF%D0%B5%D1%87%D0%B0%D1%82%D0%B0%D1%82%D1%8C_%D1%84%D0%BE%D1%80%D0%BC%D1%83_%D0%9C%D0%A5-3  
Category: Printing / equipment  
Relevance: LOW  
Last wiki revision: 2021-09-13T13:57:49Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani printing / equipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Распознавание отсканированных ведомостей

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D1%81%D0%BF%D0%BE%D0%B7%D0%BD%D0%B0%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5_%D0%BE%D1%82%D1%81%D0%BA%D0%B0%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D1%85_%D0%B2%D0%B5%D0%B4%D0%BE%D0%BC%D0%BE%D1%81%D1%82%D0%B5%D0%B9  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-13T13:58:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Manifest/Act.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Расчет километража

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B0%D1%81%D1%87%D0%B5%D1%82_%D0%BA%D0%B8%D0%BB%D0%BE%D0%BC%D0%B5%D1%82%D1%80%D0%B0%D0%B6%D0%B0  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-03T08:06:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** При заполнении адреса в карточке корреспонденции система с помощью карт определяет его расположение.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Client/Recipient, Manifest/Act, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Режим срочности

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B5%D0%B6%D0%B8%D0%BC_%D1%81%D1%80%D0%BE%D1%87%D0%BD%D0%BE%D1%81%D1%82%D0%B8  
Category: Other / reference  
Relevance: HIGH  
Last wiki revision: 2022-05-17T13:46:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Ретейл

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%B5%D1%82%D0%B5%D0%B9%D0%BB  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-01-28T07:40:39Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Робокасса

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D0%BE%D0%B1%D0%BE%D0%BA%D0%B0%D1%81%D1%81%D0%B0  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2022-04-11T09:41:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Руководство программиста

URL: https://wiki.courierexe.ru/index.php/%D0%A0%D1%83%D0%BA%D0%BE%D0%B2%D0%BE%D0%B4%D1%81%D1%82%D0%B2%D0%BE_%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%B8%D1%81%D1%82%D0%B0  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2026-07-28T09:20:43Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Основные положения В систему «MEASOFT» встроен внутренний интерпретируемый язык программирования.

Sahifadagi asosiy bo'limlar: Основные положения; Описание синтаксиса; Функциональность базового объекта; Строковые функции; Функции перекодировки; Транслитерация; Экранирование; Хеширование; Функции работы с датой и временем; Функции приведения типов; Математические функции; Константы.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Системные доп. возможности

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%BD%D1%8B%D0%B5_%D0%B4%D0%BE%D0%BF._%D0%B2%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D0%B8  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-09T09:25:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Склад

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BA%D0%BB%D0%B0%D0%B4  
Category: Warehouse / inventory  
Relevance: HIGH  
Last wiki revision: 2021-02-20T08:36:10Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Warehouse/Inventory, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Служебные штрихкоды

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BB%D1%83%D0%B6%D0%B5%D0%B1%D0%BD%D1%8B%D0%B5_%D1%88%D1%82%D1%80%D0%B8%D1%85%D0%BA%D0%BE%D0%B4%D1%8B  
Category: Warehouse / inventory  
Relevance: MEDIUM  
Last wiki revision: 2021-09-13T14:02:16Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani warehouse / inventory oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Собеседования

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BE%D0%B1%D0%B5%D1%81%D0%B5%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F  
Category: Geography / routing  
Relevance: LOW  
Last wiki revision: 2022-05-12T09:57:52Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вкладка Собеседования хранит информацию о назначенных собеседованиях при подборе персонала.

Sahifadagi asosiy bo'limlar: Карточка собеседования.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Courier/Employee, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Создание корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2021-12-09T12:49:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Сотрудники

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B8  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2026-03-17T09:50:53Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here = Назначение = Вкладка предназначена для управления данными персонала организации.

Sahifadagi asosiy bo'limlar: Назначение; Виды сотрудников; Создание сотрудника; Карточка сотрудника; Основное; Реквизиты; График; Клиенты; Дополнительно; Удостоверение сотрудника; Увольнение сотрудника; Удаление сотрудника.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Справки о налоговом резидентстве

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B8_%D0%BE_%D0%BD%D0%B0%D0%BB%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D0%BC_%D1%80%D0%B5%D0%B7%D0%B8%D0%B4%D0%B5%D0%BD%D1%82%D1%81%D1%82%D0%B2%D0%B5  
Category: People / security  
Relevance: LOW  
Last wiki revision: 2025-10-22T12:41:44Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** 2025 Казахстан Беларусь Узбекистан Кыргызстан 2024 Казахстан Беларусь Узбекистан Кипр 2023 Казахстан Беларусь Узбекистан Кипр 2022 Казахстан Беларусь Латвия Киргизия Узбекистан Таджикистан Кипр 2021 Казахстан Беларусь Латвия Киргизия Узбекистан Таджикистан 2020 Казахстан Беларусь Латвия Киргизия Узбекистан Таджикистан 2019 Казахстан Беларусь Латвия Киргизия Узбекистан 2018 Казахстан

Sahifadagi asosiy bo'limlar: 2025; 2024; 2023; 2022; 2021; 2020; 2019; 2018.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Справочники

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D0%BF%D1%80%D0%B0%D0%B2%D0%BE%D1%87%D0%BD%D0%B8%D0%BA%D0%B8  
Category: People / security  
Relevance: MEDIUM  
Last wiki revision: 2021-09-07T08:10:03Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Фирмы Тарифы клиентов Зоны на карте Дополнительные услуги Печатные формы Марки автомобилей Автомобили Выходные дни Курсы валют Двоичные данные Районы Филиалы Перевозчики Города Зоны Коэффициенты Тарифы по зонам Зарплата (справочник) Статусы Внешние склады Метро Улицы

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Status/Reason, Client/Recipient, Warehouse/Inventory, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Срочные заказы

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D1%80%D0%BE%D1%87%D0%BD%D1%8B%D0%B5_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2026-01-29T14:25:01Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ;Срочные заказы : Заказы, которые принимаются и сразу выполняются. Оператор принимает заказ, сообщает курьеру адреса забора и доставки, а курьер информирует оператора о ходе его выполнения так же, по телефону, не заезжая в офис.

Sahifadagi asosiy bo'limlar: Вкладка «Срочные»; Фильтры; Функции контекстного меню; Карточка срочного заказа; Данные заказчика; Данные отправителя; Данные получателя; Параметры доставки; Информация о доставке; Общие элементы; Заказ пропуска; Настройка пропуска.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Статусная модель

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D1%82%D0%B0%D1%82%D1%83%D1%81%D0%BD%D0%B0%D1%8F_%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2025-07-21T13:17:24Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** =Виды статусов = Основные виды статусов, связанные с доставкой отправлений: * статус корреспонденции — пользовательский статус отправления, отображается в карточке корреспонденции.

Sahifadagi asosiy bo'limlar: Виды статусов; Статусы трекинга.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: status highlighting, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Статусы

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D1%82%D0%B0%D1%82%D1%83%D1%81%D1%8B  
Category: Status model  
Relevance: HIGH  
Last wiki revision: 2022-11-21T12:57:59Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для просмотра и редактирования статусов, используемых в системе MeaSoft.

Sahifadagi asosiy bo'limlar: Виды срочности.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Счета

URL: https://wiki.courierexe.ru/index.php/%D0%A1%D1%87%D0%B5%D1%82%D0%B0  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2026-06-16T12:11:06Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Управление счетами Для управления счетами выберите в меню Документы пункт Счета. Необходимо наличие прав на просмотр счетов.

Sahifadagi asosiy bo'limlar: Управление счетами; Карточка счета; Выставление счета; Массовое выставление счетов; Счет на предоплату; Печатная форма счета; Теги; Координаты; Кастомная детализация; Рассылка по e-mail; Экспорт счетов в 1С; Проведение платежа.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Тарифы

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B0%D1%80%D0%B8%D1%84%D1%8B  
Category: Courier / delivery  
Relevance: MEDIUM  
Last wiki revision: 2022-11-30T14:19:18Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** English version is here В программе MeaSoft тарифы на доставку представлены в следующих видах: * тарифы клиентов.

Sahifadagi asosiy bo'limlar: Тарифы клиентов; Предварительные шаги; Тарифы на городскую доставку; Тарифы на междугороднюю доставку; Общие междугородние тарифы; Индивидуальные междугородние тарифы; Тарифы агентов.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Payment/Cash, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Тарифы клиентов

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B0%D1%80%D0%B8%D1%84%D1%8B_%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2  
Category: Courier / delivery  
Relevance: MEDIUM  
Last wiki revision: 2022-05-31T14:37:09Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** =Тарифы= Справочник «Тарифы» предназначен для создания и хранения тарифов клиентов на городские и индивидуальные междугородние доставки.

Sahifadagi asosiy bo'limlar: Тарифы; Городские отправления; Доставка; Забор; Междугородние отправления; Прочее; Услуги.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Тарифы курьеров

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B0%D1%80%D0%B8%D1%84%D1%8B_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%BE%D0%B2  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-04-22T09:02:43Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Тарифы по зонам

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B0%D1%80%D0%B8%D1%84%D1%8B_%D0%BF%D0%BE_%D0%B7%D0%BE%D0%BD%D0%B0%D0%BC  
Category: Geography / routing  
Relevance: MEDIUM  
Last wiki revision: 2021-10-07T10:14:32Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник предназначен для тарификации стоимости доставки по зонам. Зоны устанавливаются в справочнике Зоны.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Терминология

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B5%D1%80%D0%BC%D0%B8%D0%BD%D0%BE%D0%BB%D0%BE%D0%B3%D0%B8%D1%8F  
Category: Order / shipment  
Relevance: LOW  
Last wiki revision: 2018-06-05T13:43:36Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Назначение = Данная страница предназначена для сбора и описания терминов, используемых в базе знаний и программе.

Sahifadagi asosiy bo'limlar: Назначение; Основные принципы работы в программе; Карта; Междугородние перевозки или Манифесты; Складской учет; Прочее.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Manifest/Act, Payment/Cash, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Термины и определения

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B5%D1%80%D0%BC%D0%B8%D0%BD%D1%8B_%D0%B8_%D0%BE%D0%BF%D1%80%D0%B5%D0%B4%D0%B5%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-01-10T11:54:39Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Тест

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B5%D1%81%D1%82  
Category: Status model  
Relevance: LOW  
Last wiki revision: 2022-05-20T15:04:29Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Статусы * статус корреспонденции — пользовательские статусы. Их можно добавлять, а через нас настраивать автоматизации, срабатывающие при их изменении.

Sahifadagi asosiy bo'limlar: Статусы трекинга.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani status model oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Тикеты

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D0%B8%D0%BA%D0%B5%D1%82%D1%8B  
Category: API / integration  
Relevance: HIGH  
Last wiki revision: 2024-04-24T07:47:04Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Система тикетов предназначена для автоматического приема и обработки заявок клиентов, поступающих в программу MeaSoft по электронной почте.

Sahifadagi asosiy bo'limlar: Тикеты; Разделы; Поиск по тикетам; Область тикетов и сообщений; Область тикетов; Список сообщений тикета; Область сообщения; Настройка; Аккаунты; Черный список; Пользователи; Использование.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Трекинг курьеров

URL: https://wiki.courierexe.ru/index.php/%D0%A2%D1%80%D0%B5%D0%BA%D0%B8%D0%BD%D0%B3_%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80%D0%BE%D0%B2  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-01-18T08:54:09Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Удостоверение

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D0%B4%D0%BE%D1%81%D1%82%D0%BE%D0%B2%D0%B5%D1%80%D0%B5%D0%BD%D0%B8%D0%B5  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-09-14T10:01:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Courier/Employee.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Улицы

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D0%BB%D0%B8%D1%86%D1%8B  
Category: Geography / routing  
Relevance: LOW  
Last wiki revision: 2021-09-02T15:28:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** В справочнике можно отслеживать привязку улица и дом к станциям метро. Улицы попадают в справочник автоматически при заполнении карточек, если вы указываете При вводе адресов необходимо придерживаться правил написания адресов, описанных здесь .

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani geography / routing oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Управляющие коды

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D1%8F%D1%8E%D1%89%D0%B8%D0%B5_%D0%BA%D0%BE%D0%B4%D1%8B  
Category: People / security  
Relevance: LOW  
Last wiki revision: 2021-09-13T14:03:24Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani people / security oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Устранение неполадок

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BD%D0%B5%D0%BF%D0%BE%D0%BB%D0%B0%D0%B4%D0%BE%D0%BA  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2025-10-22T08:31:06Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Ошибки при запуске системы Если при запуске MeaSoft появляются ошибки или работают не все вкладки программы, проверьте системный формат даты в параметрах Windows.

Sahifadagi asosiy bo'limlar: Ошибки при запуске системы; Не отображаются заголовки таблиц и элементы карточек; Неверно указана единица измерения; Неверные подписи в строке состояния; Разница времени между сервером и рабочей станцией; Печатает «иероглифы»; Иероглифы в программе; Устранение неполадок при отправке электронной почты; Ошибки печати кассовых чеков; Неверно работает COM-сканер штрихкодов; Существенное замедление работы программы при загрузке реестра Excel; Ошибочное представление данных для Excel отчетов.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **P0**

---

## Учет корреспонденции

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D1%87%D0%B5%D1%82_%D0%BA%D0%BE%D1%80%D1%80%D0%B5%D1%81%D0%BF%D0%BE%D0%BD%D0%B4%D0%B5%D0%BD%D1%86%D0%B8%D0%B8  
Category: Order / shipment  
Relevance: HIGH  
Last wiki revision: 2026-02-05T10:44:47Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** ;Отправление (корреспонденция) : Совокупность предметов, принятых от одного отправителя и доставляемых на один адрес.

Sahifadagi asosiy bo'limlar: Создание корреспонденции; Адреса; Действия с адресами; Фильтр; Изменение выборки отправлений; Коррекция адресов; Учет корреспонденции; Кейсы; Передача заборов; Предтаможенное изъятие.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani order / shipment oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Учет наличных по бухгалтерии

URL: https://wiki.courierexe.ru/index.php/%D0%A3%D1%87%D0%B5%D1%82_%D0%BD%D0%B0%D0%BB%D0%B8%D1%87%D0%BD%D1%8B%D1%85_%D0%BF%D0%BE_%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D0%B8  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2022-03-01T12:00:06Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Модуль учета наличных денежных средств предназначен для отслеживания и учета движения наличных денежных средств курьерской службы и представляет собой набор отчетов в главном меню Отчеты > Бухгалтерия.

Sahifadagi asosiy bo'limlar: Начало использования модуля учета наличных в бухгалтерии; Отчеты и функции модуля; Передать деньги другому сотруднику; Принять деньги от сотрудника в бухгалтерию; Выдать деньги из бухгалтерии; Внесение наличных в бухгалтерию; Отчетный период; Документы о движении денег в бухгалтерии; Деньги на руках у менеджеров; Финансовый отчет за период; Движение денег в бухгалтерии; Выдача денег курьеру и оплата АПД.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

---

## Файлы для загрузки

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B0%D0%B9%D0%BB%D1%8B_%D0%B4%D0%BB%D1%8F_%D0%B7%D0%B0%D0%B3%D1%80%D1%83%D0%B7%D0%BA%D0%B8  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2025-02-12T09:29:22Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** На этой странице собраны документы, которые можно загрузить и использовать при настройке системы.

Sahifadagi asosiy bo'limlar: Популярные документы; Примеры составления документов; Документы для клиентов; Документы для курьеров; Примеры шаблонов загрузки; Примеры скриптов для доп. возможностей; Импорт входящих отчетов партнеров; Импорт выписок по эквайрингу; Печатные формы для корреспонденции; Шаблоны рассылки из адресов; Печатные формы для манифестов; Печатные формы этикеток при комплектации в манифесты.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Филиалы

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D1%8B  
Category: API / integration  
Relevance: MEDIUM  
Last wiki revision: 2022-04-27T14:06:51Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник Филиалы предназначен для управления данными филиалов курьерской службы и ее партнеров.

Sahifadagi asosiy bo'limlar: Вкладка «Основное»; Вкладка «Дополнительно»; Вкладка «Тариф»; Вкладка «Интеграция»; Многофилиальность.

### Muhim business rule

- **MEASOFT FACT:** Actionlar rol yoki sozlama orqali cheklanadi.
- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani api / integration oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Финансы

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D1%8B  
Category: Payment / finance  
Relevance: LOW  
Last wiki revision: 2020-11-19T12:44:57Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** #Зарплата сотрудников #Акты передачи денег клиентам # Счета клиентам #Платежи #Отчеты #Кассы #Модуль учета наличных

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani payment / finance oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Фирма

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B8%D1%80%D0%BC%D0%B0  
Category: Organization / network  
Relevance: MEDIUM  
Last wiki revision: 2021-10-27T09:12:35Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani organization / network oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Фирмы

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B8%D1%80%D0%BC%D1%8B  
Category: Organization / network  
Relevance: MEDIUM  
Last wiki revision: 2026-09-10T13:44:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Справочник Фирмы предназначен для управления данными юридических лиц компании. Чтобы открыть справочник, в меню выберите Справочники > Фирмы.

Sahifadagi asosiy bo'limlar: Создание фирмы; Устройства; Добавление фискального регистратора; Добавление POS-терминала.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Manifest/Act, Payment/Cash, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani organization / network oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Asosiy workflow barqarorlashgach konfiguratsiya yoki yordamchi modul sifatida qo'shamiz.

### Hozir kerakmi yoki keyin?

Priority: **P2**

---

## Фискальный регистратор

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D0%B8%D1%81%D0%BA%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9_%D1%80%D0%B5%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B0%D1%82%D0%BE%D1%80  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2021-10-27T09:13:31Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Функции

URL: https://wiki.courierexe.ru/index.php/%D0%A4%D1%83%D0%BD%D0%BA%D1%86%D0%B8%D0%B8  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2026-03-25T16:10:30Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** = Планирование курьерам = Устаревшая функция, используйте другие виды планирования.

Sahifadagi asosiy bo'limlar: Планирование курьерам; Распечатать форму MX-3; Распознавание отсканированных ведомостей; Инвентаризация корреспонденции; Корреспонденция; Движение накладных и возвратов; Идентификация возвратов; Трекинг курьеров; Печать служебных штрихкодов; Печать наклеек на возврат; Печать этикеток для адресного хранения; Управляющие коды.

### Muhim business rule

- **MEASOFT FACT:** Object holati keyingi action va ko'rinishlarga ta'sir qiladi.
- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Bog'langan yozuvni o'chirish o'rniga bekor qilish yoki bloklash qo'llanadi.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Status/Reason, Courier/Employee, Client/Recipient, Manifest/Act, Warehouse/Inventory.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: context action, filter/search, status highlighting, bulk action, scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: diagnostic/audit trail, synchronization, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Честный ЗНАК

URL: https://wiki.courierexe.ru/index.php/%D0%A7%D0%B5%D1%81%D1%82%D0%BD%D1%8B%D0%B9_%D0%97%D0%9D%D0%90%D0%9A  
Category: Courier / delivery  
Relevance: LOW  
Last wiki revision: 2022-10-25T06:50:15Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** С 2019 года началось внедрение единой национальной системы маркировки «Честный ЗНАК».

Sahifadagi asosiy bo'limlar: Формат кода Честного ЗНАКа; Как передавать коды в MeaSoft; Работа с маркированными товарами; Товары со складским учетом; Товары без складского учета; Доставка маркированных товаров; Вывод проданных товаров из оборота; Ошибки при пробитии чека с маркированными товарами.

### Muhim business rule

- **MEASOFT FACT:** Skanerlash qo'lda tanlash xatosini kamaytiradigan asosiy UX vositasi.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Client/Recipient, Payment/Cash, Warehouse/Inventory, Attachment/Document.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: scan-first flow.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## ЭДО

URL: https://wiki.courierexe.ru/index.php/%D0%AD%D0%94%D0%9E  
Category: Other / reference  
Relevance: LOW  
Last wiki revision: 2022-02-03T09:50:43Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Sahifa hozir faqat yo'naltirish yoki qisqa ma'lumot vazifasini bajaradi.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Alohida majburiy transition qoidasi ko'rsatilmagan; sahifa ko'proq ma'lumotnoma yoki sozlash vazifasida.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Configuration/reference data.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani other / reference oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: server-validated domain operation.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Bevosita emas. Faqat shu imkoniyatga ehtiyoj paydo bo'lsa qayta baholanadi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Hozir production modeliga qo'shmaymiz.

### Hozir kerakmi yoki keyin?

Priority: **NOT NEEDED**

---

## Яндекс.Маршрутизация

URL: https://wiki.courierexe.ru/index.php/%D0%AF%D0%BD%D0%B4%D0%B5%D0%BA%D1%81.%D0%9C%D0%B0%D1%80%D1%88%D1%80%D1%83%D1%82%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F  
Category: Courier / delivery  
Relevance: HIGH  
Last wiki revision: 2023-02-09T13:50:37Z

### MeaSoft'da nima qiladi

**MEASOFT FACT:** Вы можете планировать маршруты курьеров с помощью сервиса Яндекс.Маршрутизация. Чтобы подключить сервис, запросите в техподдержке MeaSoft ссылку на подключение, зарегистрируйтесь и пришлите нам API-ключ.

Sahifa qisqa ma'lumot yoki boshqa sahifaga yo'naltirish beradi.

### Muhim business rule

- **MEASOFT FACT:** Muhim natija alohida tasdiqlash bosqichiga ega.
- **MEASOFT FACT:** Xato holati operatorga ko'rinadi va qayta urinish/recovery yo'li bor.

### Muhim data model

**OUR INTERPRETATION:** Asosiy obyektlar: Order/Shipment, Courier/Employee, Warehouse/Inventory, Attachment/Document, Branch/Location.

### Muhim workflow

**OUR INTERPRETATION:** Sahifa sarlavhalari va action tavsiflari bu funksiyani courier / delivery oqimining bir qismi sifatida ko'rsatadi. Action, actor, precondition va natijani serverda alohida qayd qilish kerak.

### Muhim UX pattern

**MEASOFT FACT:** Aniqlangan patternlar: domain-specific list/form interaction.

### Muhim technical pattern

**OUR INTERPRETATION:** Aniqlangan patternlar: integration contract, diagnostic/audit trail, configuration-driven behavior.

### Bizning loyihaga qo'llasa bo'ladimi?

**OUR RECOMMENDATION:** Ha. Fast-food kontekstiga moslashtirib, mavjud modul chegaralarini buzmay incremental joriy etiladi.

### Qanday qo'llaymiz?

**OUR RECOMMENDATION:** Action endpoint, immutable event, RBAC tekshiruvi va kerak bo'lsa idempotency bilan model qilamiz.

### Hozir kerakmi yoki keyin?

Priority: **P1**

