# Lokal ma'lumotlar bazasini sozlash

Ushbu hujjat lokal ishlab chiqish bazasini tayyorlash uchun.
**Production bazasiga hech qanday aloqasi yo'q.**

## Holat

Bu mashinada 5432-portni **Windows'ga o'rnatilgan `postgresql-x64-18` servisi**
egallagan — `docker-compose.yml` dagi konteyner emas. `pg_hba.conf` barcha
ulanishlar uchun `scram-sha-256` talab qiladi, ya'ni parolsiz ulanib bo'lmaydi.

`.env` dagi `DATABASE_URL` `mazetto` foydalanuvchisiga ishora qiladi, lekin bu
rol mahalliy PostgreSQL 18 da mavjud emas:

```
Authentication failed against the database server,
the provided database credentials for `mazetto` are not valid
```

## 1-qadam — rol va bazani yaratish

Quyidagi komandani **o'zingiz** ishga tushiring. `psql` `postgres` superuser
parolini interaktiv so'raydi — u faqat sizning terminalingizda qoladi.

Claude Code seansida `!` prefiksi bilan:

```
! & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f docs/sql/create-local-dev-db.sql
```

Yoki oddiy terminalda:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f docs\sql\create-local-dev-db.sql
```

Skript idempotent — rol yoki baza allaqachon bo'lsa, xato bermaydi.

## 2-qadam — migratsiyalarni qo'llash

```bash
pnpm --filter backend prisma:migrate:deploy
```

## 3-qadam — seed

```bash
pnpm --filter backend exec tsx prisma/seed.ts
```

Seed permission va rollar bo'yicha **idempotent** (`upsert`), mavjud
ma'lumotni buzmaydi. U quyidagilarni qo'shadi:

| Permission | Kimga | Nima uchun |
|---|---|---|
| `SHIFT_VIEW_BRANCH` | BRANCH_MANAGER | `/admin/shifts` — filial smenalari |
| `PAYMENT_VIEW` | BRANCH_MANAGER, ACCOUNTANT | `/admin/payments` — to'lov tarixi |
| `AUDIT_VIEW` | faqat SUPER_ADMIN (`*` orqali) | `/admin/audit` — xavfsizlik jurnali |

Bu permissionlar qo'llanmaguncha `/admin/shifts`, `/admin/payments` va
`/admin/audit` sahifalari **403** qaytaradi. Kod tayyor — faqat seed kutmoqda.

## 4-qadam — tekshirish

```bash
pnpm --filter backend dev
curl http://localhost:4000/api/v1/health
```

## Muqobil: Docker

Agar Docker Desktop'dan foydalanmoqchi bo'lsangiz, 5432 band bo'lgani uchun
`docker-compose.yml` da portni o'zgartirish kerak (masalan `5433:5432`) va
`.env` dagi `DATABASE_URL` ni ham moslash kerak.
