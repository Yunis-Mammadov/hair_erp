# z-Index — 20 noyabr 2026: 7 günlük sınaq

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

Yeni `202611200001_seven_day_trial` miqrasiyası sınaq tarixlərini və e-poçt təsdiqi cədvəlini əlavə edir. Mövcud şirkətlər sınaq hesabına çevrilmir. Əvvəlki tətbiq olunmamış miqrasiyalar da ardıcıl icra edilir. `migrate reset` və `db push` işlətmə. Hər hansı əmr xəta verərsə, onu həll etmədən növbəti mərhələyə keçmə.

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

## Lokal sınaq qeydiyyatını aç

`server/.env` faylında bu sətrləri əlavə et və ya mövcud dəyərləri yenilə. Eyni dəyişəni iki dəfə yazma:

```env
NODE_ENV=development
TRIAL_SIGNUP_ENABLED=true
TRIAL_EMAIL_MODE=console
APP_URL=http://localhost:5173
BILLING_PROVIDER=manual
```

Backend-i yenidən başlat. `http://localhost:5173/trial` aç. E-poçtunu yaz, razılıq xanasını seç və keçidi istə. Bu lokal rejim **məktub göndərmir**. Backend terminalında `[LOCAL TRIAL EMAIL — NOT SENT]` ilə başlayan keçidi aç; keçid həssasdır, paylaşma. Şirkət adı/kodu, öz adın, valyuta, saat dilimi, şifrə və şəxsi PIN seç. Qaydaları qəbul edib hesabı yarat. Login e-poçtunu saxla; həmin e-poçt, seçdiyin şifrə və PIN ilə daxil ol.

7 gün aktivləşmə anından başlayır. Kart tələb olunmur. Admin daxil olmaqla ən çox 3 aktiv işçi hesabı var. Təkrar e-poçt yeni sınaq yaratmır. Təsdiq keçidi bir saat qüvvədədir; yenisini istəmək üçün ən azı 60 saniyə gözlə. Müddət bitəndə məlumatlar saxlanılır, adi giriş bağlanır. Admin `/renew` səhifəsində məhdud abunəlik girişindən istifadə edə bilər. Paddle aktiv olana qədər operator panelində abunəliyi əl ilə uzatmaq mümkündür; bu əməliyyat kartdan pul tutmur.

## Saytda sına

1. Çıxış et: ana səhifədə təqdimat, $19.99/ay və $199.99/il, sınaq düyməsi və dörd dil seçimi görünsün.
2. `/trial` → təsdiq keçidi → şirkət qurulması → şəxsi PIN ilə giriş axınını tamamla. Hələ forma tamamlanmamış şirkət yaranmır.
3. Şirkət panelində qalan günlər və bitmə tarixi görünsün. Məhsul, alış və müştəri yarat; hesab başqa şirkətin məlumatlarını göstərməsin.
4. Team and PINs bölməsində 2 işçi əlavə et; dördüncü aktiv hesab rədd edilməlidir.
5. Plan bölməsində sınaq statusu və abunəlik qiyməti düzgün görünsün. Paddle hələ manualdır; kartdan ödəniş tutulmur.
6. Köhnə admin hesabına daxil olub müştəriləri, Excel idxalını, alış/satışı və qaiməni yoxla. Köhnə məlumatlar qalmalıdır.

## Canlı e-poçt — server mərhələsində

Canlı serverdə `NODE_ENV=production`, `TRIAL_SIGNUP_ENABLED=true`, `TRIAL_EMAIL_MODE=smtp`, `APP_URL=https://z-index.online` və həqiqi SMTP göndəricisinin parametrləri olmalıdır. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` doldurulmalıdır. Parol və açarları GitHub-a və ya frontend-ə qoyma. Production konsol rejimini qəbul etmir. SMTP qoşulandan sonra real e-poçta təsdiq keçidinin çatmasını ayrıca sına. Bu paket real serverə yerləşdirilməyib və real məktub/ödəniş göndərməyib.
