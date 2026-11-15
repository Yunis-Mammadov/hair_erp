# Son audit düzəlişləri — 13 noyabr 2026

Başlanğıc versiya: GitHub `0584942`. Bu sənəd audit hissəsini təsvir edir. Cari vahid paket 7-ci qrupu da daxil edir: [GROUP7-RELEASE](GROUP7-RELEASE.md).

**Əvvəl oxu:** [quraşdırma](docs/audit-fixes/QURASDIRMA.md). Backup ifşası üçün ayrıca [Git tarixçəsi və girişlərin yenilənməsi](docs/audit-fixes/BACKUP-TEMIZLEME.md) addımları var.

| Audit | Paketdəki dəyişiklik | Vəziyyət |
|---|---|---|
| F01 | Backup-ların Git indeksindən çıxarılması, CI fayl yoxlaması, `.env.example` istisnası, təhlükəsiz operator əmrləri və təmizləmə təlimatı | Kod hazırdır; uzaq Git tarixçəsi və real girişlərin dəyişdirilməsi operator addımıdır |
| F02 | İmza feature yoxlaması ortaq router daxilindədir; `/orders` və `/exp/orders` eyni qorunur | Testlə yoxlanıb |
| F03 | Satıcı imzası yalnız ADMIN; alıcı imzası ADMIN/DRIVER; PNG byte/ölçü validasiyası; əvəzləmə qadağası; SHA ilə audit; imzalanmış qaimənin redaktəsi bağlıdır | Testlə yoxlanıb |
| F04 | Redaktə zamanı müştəri/məhsul üzrə aktiv PaymentSoldItem miqdarları qorunur | Tək və paralel sorğularla yoxlanıb |
| F05 | Basic-də ortaq şirkət müştəriləri; Business/Premium ekspeditorunda cari təyinat. Qaimə siyahısı/detail və qaytarma detail-i uyğunlaşdırılıb | Testlə yoxlanıb |
| F06 | Dockerfile, `.dockerignore`, nümunə env-lər, same-origin `/api` standartı, yerli Vite proxy və CI container smoke addımı | Yerli build/modul testləri keçib; Docker burada icra olunmayıb |
| F07 | Boş şirkətdə ilk maliyyə əməliyyatından əvvəl valyuta təsdiqi; adminə ayarlar keçidi. Tarixi qeydlərin valyutası saxlanır | Tək və paralel sorğularla yoxlanıb |
| F08 | Yanlış paymentType və təkrarlanan query dəyəri 400 qaytarır | Testlə yoxlanıb |
| F09 | Flag yalnız boolean; problemNote tip/uzunluq yoxlaması | Testlə yoxlanıb |
| F10 | Qəbz/loqo bağlanmadan əvvəl həmin şirkətin real, uyğun ölçülü şəkil faylı yoxlanır; replay əvvəlki cavabı təhlükəsiz saxlayır | Testlə yoxlanıb |
| F11 | Renewal PIN limiti normallaşdırılmış e-poçtdan tapılan şirkət/IP-yə bağlanır; əlavə IP limiti var | Boşluq/case variantları ilə yoxlanıb |
| F12 | Stok filterləri, başlıqlar, əməliyyat adları, qiymətin valyuta formatı və satış nəticə sayı EN/AZ/TR/RU təqdim olunur | Komponent və dil testləri ilə yoxlanıb |
| F13 | Köhnə axtarış nəticələri dərhal gizlənir; gecikmiş/uğursuz cavab köhnə məhsulu aktiv etmir | Gecikmiş cavabları idarə edən komponent testi keçib |

## Uyğunluq

- Audit hissəsi miqrasiya tələb etmirdi. Cari paketdə 7-ci qrup üçün yeni `202611130001_group7_extras` var. Köhnə migration.sql faylları paketə daxil edilmir; yenilənmiş [quraşdırma addımlarını](docs/group7/QURASDIRMA.md) istifadə et.
- Mövcud `.env`, uploads, müştəri/satış/ödəniş məlumatları paketlə əvəz edilmir.
- Mövcud PIN-lər avtomatik dəyişdirilmir. Real ifşa varsa, operator ayrıca dəyişməlidir.
- Müştərilərarası və şirkətlərarası borclar birləşdirilmir; qiymətlər və pul hesablaması dəyişmir.
- İmza şəkli maksimum 200 kB nəticə, 1600×600 və 1 milyon pixel limiti ilə PNG-dir; eyni imzanın təkrarı əlavə audit yaratmır.
- Ümumi JS chunk ölçü xəbərdarlığı qala bilər. Bu paket performans iddiası etmir.

Yoxlama nəticələri [NETICELER.md](docs/audit-fixes/NETICELER.md) faylındadır.
