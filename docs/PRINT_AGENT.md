# MAZETTO Print Agent

Print agent cheklarni backend API dan olib, muvaffaqiyatli chop etilgandan keyingina `printed=true` qilib belgilaydi.

## Kerakli sozlamalar

- `MAZETTO_API_URL` - backend API, masalan `https://api.mazettofood.uz/api/v1`.
- `MAZETTO_PRINT_AGENT_TOKEN` - `RECEIPT_VIEW` va `RECEIPT_PRINT` permissionlari bor xodim tokeni.
- `MAZETTO_BRANCH_ID` - ixtiyoriy, faqat bitta filial cheklarini olish uchun.
- `MAZETTO_PRINT_DRY_RUN` - default dry-run. Real chop etish uchun `false`.
- `MAZETTO_PRINTER_MODE` - `file`, `stdout`, yoki `tcp`.
- `MAZETTO_PRINT_OUTPUT_DIR` - `file` rejimida chek fayllari yoziladigan papka.
- `MAZETTO_PRINTER_HOST` va `MAZETTO_PRINTER_PORT` - `tcp` rejimidagi ESC/POS printer uchun. Port default `9100`.
- `MAZETTO_PRINT_HEALTH_PORT` - lokal boshqaruv/status sahifasi porti, default `7357`.

## Ishga tushirish

Dry-run tekshiruv:

```bash
pnpm --filter print-agent start -- --once
```

Faylga chiqarish:

```bash
MAZETTO_PRINT_DRY_RUN=false MAZETTO_PRINTER_MODE=file pnpm --filter print-agent start
```

Tarmoq printeriga yuborish:

```bash
MAZETTO_PRINT_DRY_RUN=false MAZETTO_PRINTER_MODE=tcp MAZETTO_PRINTER_HOST=192.168.1.50 pnpm --filter print-agent start
```

Agar printer xato qaytarsa yoki ulanish uzilsa, chek `printed` bo‘lib belgilanmaydi va keyingi siklda qayta urinadi.

## Lokal status

Agent ishlaganda status oynasi `http://127.0.0.1:7357/` da chiqadi. JSON holat: `/status`, health: `/health`.
## Ishonchli navbat rejimi

`MAZETTO_PRINT_PROTOCOL=jobs` agentni ishonchli chop etish navbatiga o‘tkazadi. Har bir chek uchun alohida ish yaratiladi, agent uni vaqtinchalik band qiladi, printer muvaffaqiyatli tugatgandan keyingina ish va chek chop etilgan deb belgilanadi. Ulanish uzilsa, ish kutish ro‘yxatiga qaytadi; takroriy xatolar esa `DEAD_LETTER` holatida saqlanadi.

Muhim: eski `receipts` usuli va `jobs` usuli bir vaqtda ishlamasin. Production o‘tish tartibi:

1. Backendni yangi versiyaga chiqaring, lekin `MAZETTO_DURABLE_PRINT_JOBS` o‘chiq qolsin.
2. Eski receipt-poller agentni to‘xtating.
3. Yangi agentni `MAZETTO_PRINT_PROTOCOL=jobs` va `MAZETTO_PRINT_DRY_RUN=false` bilan ishga tushiring. Uning `/health` sahifasi tayyor holat qaytarganini tekshiring.
4. Backendda `MAZETTO_DURABLE_PRINT_JOBS=true` ni yoqing va backendni qayta yuklang.

Shundan oldingi cheklar navbatga qo‘shilmaydi, yangi sotuv esa aynan bir marta navbatga tushadi. Dry-run rejimida agent ishni band qilmaydi va hech narsani chop etilgan deb belgilamaydi.
