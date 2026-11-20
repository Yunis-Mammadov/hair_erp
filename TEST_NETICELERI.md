# Yekun yoxlama — 15 noyabr 2026

Bu buraxılış `Yunis-Mammadov/hair_erp` reposunun `fdeb68cef1f5d2999c43cb8cc5eed82633343bb2` versiyasına əsaslanan tam mənbə üzərində hazırlanıb. İstifadəçinin Windows bazasına və uzaq GitHub reposuna dəyişiklik edilməyib.

| Yoxlama | Nəticə |
|---|---|
| Backend `npm test` | 202/202 keçdi, 0 uğursuz, 0 atlanmış |
| Frontend `npm test` | 61/61 keçdi, 0 uğursuz, 0 atlanmış |
| Native PostgreSQL 18.6 və production yoxlamaları | 31/31 keçdi, 0 uğursuz, 0 atlanmış |
| Prisma validate / generate | Keçdi, Prisma 6.19.3 |
| Təmiz bazaya `prisma migrate deploy` | Bütün miqrasiyalar tətbiq edildi |
| Tətbiq olunan miqrasiyalarla cari Prisma sxeminin müqayisəsi | Uyğundur |
| Frontend lint, xəbərdarlıqların xəta kimi yoxlanması | Keçdi |
| Frontend production build | Keçdi |
| Backend və frontend dependency audit | Hər ikisində 0 məlum zəiflik |

Mühit: Linux, Node 24, PostgreSQL 18.6. Saylar Node test runner-in hesabatıdır; üst testləri və alt testləri ehtiva edir.

## Yeni davranışlara aid sübutlar

- Müştəri redaktəsi telefon və koordinatları yoxlayır, şirkət/rol/təyinat sərhədlərini qoruyur, köhnə formanı 409 ilə rədd edir. Qaimə snapshot-u və ilkin borc dəyişmir; eyni əməliyyat iki dəfə audit yaratmır.
- Alışın miqdarını 4-dən 2-yə endirmək stokdan yalnız 2 çıxır. İlkin yaradılma vaxtı qorunur, səbəb və operator tarixçəyə yazılır. Sonrakı ləğv qalan alış miqdarını geri çevirir, sənədi və sətirləri saxlayır. Stok çatmadıqda sənəd və balans dəyişmir. Başqa şirkətin məhsulu, təkrarlanan sətir, icazəsiz rol və səhv məbləğ rədd edilir.
- Minlik dəqiqliyində alış miqdarı və qəpik üzrə yuvarlaqlaşdırma yoxlanıb. Miqrasiya köhnə alışın 0.005 × 1.00 xərcini 0.01 kimi hesablayır, stoku və ilkin sənədi dəyişmir.
- Paralel satış/alış ləğvi mənfi stok yaratmır; paralel eyni ləğv yalnız bir dəfə tətbiq olunur; paralel müştəri düzəlişləri bir-birinin nəticəsini itirmir.
- Operator şifrə yeniləməsi, aktivləşdirmə/deaktivləşdirmə, müddət uzatma, versiya yoxlaması və audit testdən keçib. Şifrə/PIN auditdə saxlanmır, köhnə sessiyalar bağlanır. Əl ilə uzatma ödəniş və billing event yaratmır; operator blokunu başqa billing aktivləşməsi keçə bilmir.
- 30.00 satış − 10.00 qaytarma = 20.00 aylıq xalis satış. Sonrakı 10.00 pul geri ödənişi rəqəmi ikinci dəfə azaltmır. Əvvəlki ayın satışının cari ayda qaytarılması cari aya düşür; mənfi xalis satış düzgün göstərilir.
- Dashboard loqo ünvanını imzalı qaytarır. PDF öz şirkətinə aid təsdiqlənmiş lokal loqonu yerləşdirir; başqa şirkətin və xarici serverin şəklini oxumur.
- Müştəri, alış, dəstək və operator formaları DOM səviyyəsində yoxlanıb. Dəstək forması istifadəçinin özünün göndərəcəyi Gmail/mailto qaralaması hazırlayır və avtomatik çatdırılma iddiası göstərmir.
- Real `pg_dump`/`pg_restore` bazanı və şəkilləri ayrıca bazaya bərpa edir; ilkin borc, alış sətirləri, audit tarixçəsi, stok və ödənişlər müqayisə edilir.
- Dockerfile-dəki production fayl düzülüşü ayrıca qovluqda qurulub: backend/scripts/shared, hazır UI, `/ready`, `/login`, JS asset, private şəkil mühafizəsi, operator mühafizəsi və manual billing yoxlanıb.

## Hədlər və qalan xarici işlər

- Bu mühitdə Docker daemon yoxdur; real image build/run GitHub CI və hədəf serverdə ayrıca keçməlidir. Production fayl düzülüşünün yoxlanması Docker daemon testinin əvəzi deyil.
- Canlı `z-index.online` DNS/HTTPS/hosting və Paddle hesabına giriş verilməyib; aktivləşdirilməyib. Paddle məqsədli olaraq manual rejimdədir.
- Fiziki printer, real telefon GPS icazəsi və Gmail-dən məktubun çatması istifadəçi tərəfindən hədəf cihazlarda sınaqdan keçirilməlidir. Real məktub və ödəniş göndərilməyib.
- Brauzer DOM testləri interaksiyaları yoxlayır; tam real brauzerdə vizual qəbul və çap yoxlaması ayrıca lazımdır.
- Build-də əsas JS chunk təxminən 750 KB-dır; 500 KB xəbərdarlığı qalır. Build keçib, lakin zəif mobil şəbəkələrdə ilk açılışı pilotda ölçmək lazımdır. Xəbərdarlıq həddi artırılaraq gizlədilməyib.
- Yeni ZIP-də şəxsi env, uploads və backup yoxdur. Əvvəllər Git tarixçəsinə düşmüş dump-ları mənbə ZIP-i və `.gitignore` silmir; ayrıca tarixçə təmizliyi lazımdır.
