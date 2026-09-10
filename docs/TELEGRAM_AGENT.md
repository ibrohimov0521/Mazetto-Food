# MAZETTO Telegram Agent

Telegram buyurtma mantiqi backenddagi `TelegramModule` ichida qoladi. `telegram-bot` app esa webhookni o'rnatish, tekshirish va kuzatish uchun alohida agent vazifasini bajaradi.

## Muhim env

- `TELEGRAM_BOT_TOKEN` - Telegram bot tokeni.
- `TELEGRAM_WEBHOOK_SECRET` - backend webhook secret.
- `MAZETTO_PUBLIC_API_URL` - public backend API, masalan `https://api.mazettofood.uz/api/v1`.
- `MAZETTO_BACKEND_HEALTH_URL` - health check URL; berilmasa `${MAZETTO_PUBLIC_API_URL}/health`.
- `MAZETTO_TELEGRAM_HEALTH_PORT` - lokal status porti, default `7358`.

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
