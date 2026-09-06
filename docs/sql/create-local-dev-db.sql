-- MAZETTO FOOD — lokal ishlab chiqish bazasini yaratish
--
-- Ishga tushirish:
--   psql -U postgres -f docs/sql/create-local-dev-db.sql
--
-- Idempotent: rol yoki baza allaqachon mavjud bo'lsa, xato bermaydi.
--
-- OGOHLANTIRISH: bu FAQAT lokal ishlab chiqish uchun. Bu yerdagi parol
-- `.env.example` dagi ochiq dev qiymati; production'da hech qachon
-- ishlatilmasin.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mazetto') THEN
    CREATE ROLE mazetto LOGIN PASSWORD 'mazetto';
    RAISE NOTICE 'mazetto roli yaratildi';
  ELSE
    RAISE NOTICE 'mazetto roli allaqachon mavjud';
  END IF;
END
$$;

-- CREATE DATABASE tranzaksiya blokida ishlamaydi, shuning uchun \gexec
SELECT 'CREATE DATABASE mazetto OWNER mazetto'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mazetto')
\gexec

GRANT ALL PRIVILEGES ON DATABASE mazetto TO mazetto;

\echo ''
\echo 'Tayyor. Keyingi qadamlar:'
\echo '  pnpm --filter backend prisma:migrate:deploy'
\echo '  pnpm --filter backend exec tsx prisma/seed.ts'
