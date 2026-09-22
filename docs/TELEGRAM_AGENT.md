# MAZETTO Telegram Agent

Telegram buyurtma mantiqi backenddagi `TelegramModule` ichida qoladi. `telegram-bot` app esa webhookni o'rnatish, tekshirish va kuzatish uchun alohida agent vazifasini bajaradi.

## Muhim env

- `TELEGRAM_BOT_TOKEN` - Telegram bot tokeni.
- `TELEGRAM_WEBHOOK_SECRET` - backend webhook secret.
- `MAZETTO_TELEGRAM_BOT_MODE` - `customer` yoki `staff`. Customer bot eski buyurtma botidir; staff bot alohida konteynerda `staff` bo'ladi.
- `TELEGRAM_STAFF_BOT_TOKEN` - BotFather'dan yangi xodim bot tokeni. Faqat `staff` rejimida ishlatiladi.
- `TELEGRAM_STAFF_WEBHOOK_SECRET` - staff bot uchun alohida webhook secret.
- `MAZETTO_TELEGRAM_WEBHOOK_PATH` - ixtiyoriy yo'l; staff uchun standart `telegram/staff-webhook`, customer uchun `telegram/webhook`.
- `MAZETTO_PUBLIC_API_URL` - public backend API, masalan `https://api.mazettofood.uz/api/v1`.
- `MAZETTO_BACKEND_HEALTH_URL` - health check URL; berilmasa `${MAZETTO_PUBLIC_API_URL}/health`.
- `MAZETTO_TELEGRAM_HEALTH_PORT` - lokal status porti, default `7358`.

## Ikki botli production sozlama

Mijoz botining mavjud service'i quyidagicha qoladi:

`TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` + `MAZETTO_TELEGRAM_BOT_MODE=customer`

Yangi staff service shu image'dan alohida ishga tushiriladi:

`TELEGRAM_STAFF_BOT_TOKEN` + `TELEGRAM_STAFF_WEBHOOK_SECRET` + `MAZETTO_TELEGRAM_BOT_MODE=staff`

Staff webhook manzili:

`https://api.mazettofood.uz/api/v1/telegram/staff-webhook/<TELEGRAM_STAFF_WEBHOOK_SECRET>`

Staff xodimlari admin paneldagi profilida Telegram foydalanuvchi ID bilan bog'lanadi. Botga `/myid` yuborib olingan ID shu maydonga yoziladi. Bitta xodim bir nechta rolga ega bo'lsa, staff bot panelida barcha ruxsatli bo'limlar ko'rinadi; amallar backend permission va filial doirasi bilan tekshiriladi.

## Ishlatish

Webhookni o'rnatish:

```bash
pnpm --filter telegram-bot start -- --set-webhook --once
```

Faqat tekshirish:

```bash
pnpm --filter telegram-bot start -- --once
```

Doimiy monitoring:

```bash
pnpm --filter telegram-bot start
```

Status oynasi: `http://127.0.0.1:7358/`, JSON status: `/status`, health: `/health`.
