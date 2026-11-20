# z-Index — son yeniləmənin quraşdırılması

Bu ZIP tam `client`, `server`, `shared`, miqrasiyalar və kök konfiqurasiya fayllarını ehtiva edir. Bazan, şəkillərin və şəxsi `.env` faylların ZIP-ə daxil edilməyib. Əvvəlki baza və quraşdırmadan istifadə et; yenidən şirkət yaratmaq lazım deyil.

1. Bütün backend/frontend/worker proseslərini dayandır. PostgreSQL işlək qalsın. Köhnə `server` qovluğunda `npm run backup -- --offline` icra et; backup həm bazanı, həm də uploads fayllarını saxlayır. Backup hazır olmadan davam etmə.
2. ZIP-i ayrıca müvəqqəti qovluğa çıxart. `client`, `server`, `shared` və kök faylları mövcud layihəyə köçür. Köhnə `server/.env`, varsa `client/.env.local`, şəkillər və `.git` qovluğunu saxla. Köhnə `node_modules` və `dist` qovluqlarını yeni mənbə kimi istifadə etmə.
3. `server/.env`-də `DATABASE_URL`, `JWT_SECRET` və `PLATFORM_OWNER_SECRET` əvvəlki dəyərlərlə qalsın. Əgər şəkillər ayrı yerdədirsə, `UPLOADS_DIR` həmin qovluğun tam ünvanını göstərsin. `SUPPORT_EMAIL=zindex.software@gmail.com`, `PRIVACY_EMAIL=zindex.software@gmail.com`, `SERVICE_OPERATOR_NAME=z-Index`, `BILLING_PROVIDER=manual` əlavə et və ya yenilə.
4. Terminalı `server` qovluğunda aç, ardıcıl icra et:

```sh
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm test
npm run dev
```

Miqrasiya bu buraxılışın alış versiyası, ləğv metadata-sı, hesab statusu və audit tarixçəsi cədvəlini yaradır. Köhnə alış məbləğləri sətirlər üzrə qəpik dəqiqliyi ilə hesablanır. Əvvəlki tətbiq olunmamış miqrasiyalar da ardıcıl icra edilir. `migrate reset` və `db push` işlətmə. Hər hansı əmr xəta verərsə, onu həll etmədən növbəti mərhələyə keçmə.

5. İkinci terminalı `client` qovluğunda aç:

```sh
npm ci
npm test
npm run lint -- --max-warnings=0
npm run build
npm run dev
```

6. `http://localhost:5173` aç və adi şirkət girişi + şəxsi PIN ilə daxil ol. Operator paneli `/operator/companies` ünvanındadır və serverdəki ayrıca operator sirrini tələb edir. Müştərilərin bu sirrə ehtiyacı yoxdur.

## Sən saytda nəyi yoxlayasan

- Müştərilər → müştəri detalı → redaktə: ad, telefon, salon, ünvan, ərazi və xəritə nöqtəsini dəyiş. Keçmiş qaimə və ilkin borc dəyişməməlidir.
- Alış tarixçəsi → detal → redaktə: miqdar və alış qiymətini dəyiş, səbəb yaz. Stok yalnız fərq qədər dəyişməlidir. Ləğv et və tarixçədə səbəbi/əməliyyatı gör. Satılıb qurtaran malın alışını stok mənfiyə düşəcək şəkildə ləğv etmək mümkün olmamalıdır.
- Operator: şirkət axtar, şifrə/PIN yenilə, abunəliyi uzat, deaktiv et/aktivləşdir, tarixçəyə bax. Bu dəyişikliklər şirkətin köhnə sessiyalarını bağlayır. Müddəti uzatmaq kartdan pul tutmur.
- Global Starter: aylıq $19.99, illik $199.99. Şirkətin əməliyyat valyutası abunəlik qiymətindən ayrıdır.
- Dəstək: mövzu və məktub yaz; Gmail-də hazırlanmış məktubu aç. Göndər düyməsini Gmail-də özün basırsan.
- Şirkət ayarlarında loqo yüklə/saxla; ana səhifəyə qayıt. PDF qaimədə də loqonu yoxla.
- Bu ay $100 satış və $20 məhsul qaytarması et: xalis satış $80 olmalıdır. Müştəriyə $20 pul geri ödəmək rəqəmi yenidən azaltmamalıdır. Əvvəlki ayın satışı bu ay qaytarılsa, qaytarma bu ayın xalis satışından çıxılır.
- İlkin borclu müştəri Excel idxalı, ödəniş, qaimə çapı, dörd dil və adi iş axınlarına qısa regresiya sınağı et.

Paddle bu versiyada qoşulmur. Canlı hosting/DNS/HTTPS, real telefon və printer yoxlamaları ayrıca qəbul mərhələsidir; `DEPLOYMENT.md` buna hazırlıq planıdır.
