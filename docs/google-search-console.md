# Google Search Console

Sayt: https://mazettofood.uz

1. Search Console ichida Domain property qo'shing: `mazettofood.uz`.
2. Google ko'rsatgan TXT yozuvini domenning DNS sozlamalariga kiriting, so'ng Verify bosing.
3. Sitemaps bo'limida `https://mazettofood.uz/sitemap.xml` yuboring.
4. URL Inspection orqali bosh sahifa va `/menu` uchun Test Live URL, so'ng Request Indexing bosing.
5. Page Indexing bo'limida indekslash holatini kuzating. Indekslash sanasi va qidiruvdagi o'rin Google tomonidan belgilanadi.

## Tayyorlangan Sozlamalar

- Menyu va mahsulotlar server HTML javobida ko'rinadi.
- Har bir mahsulot uchun alohida title, description, canonical, Open Graph va Product JSON-LD.
- Bosh sahifada WebSite va Restaurant JSON-LD.
- `robots.txt` Googlebot uchun ochiq; `sitemap.xml` katalog asosida yangilanadi.
- Savat, checkout, profil, buyurtmalar va sinov sahifalari `noindex` bilan belgilangan.
- Mavjud bo'lmagan mahsulot haqiqiy HTTP 404 qaytaradi.
- Search Console tasdiqlash kodi taxminan qo'shilmagan. Domain property uchun DNS TXT usuli ishlatiladi.

## Server Ulanishi

Customer-web xizmatida `CUSTOMER_SEO_API_URL=http://mazetto-food-backend-pdslpm:4000/api/v1` saqlansin. Xizmat backend bilan bir xil `dokploy-network` tarmog'ida ishlashi kerak. Bu faqat server uchun; brauzer API manzilini o'zgartirmaydi.

Manbalar: [Google indekslash talablari](https://developers.google.com/search/docs/essentials/technical), [Sitemap yuborish](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
