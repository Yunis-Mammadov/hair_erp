> Əvvəlki funksiyaların tarixi təsviri. Cari quraşdırma üçün [BASLA_BURADAN.md](BASLA_BURADAN.md), cari nəticələr üçün [TEST_NETICELERI.md](TEST_NETICELERI.md) istifadə et.

# Starter: son audit düzəlişləri + 7-ci qrup

Bu, mövcud `miniERP` layihəsinə tətbiq edilən **vahid yeniləmə paketidir**. Son auditin F01–F13 düzəlişləri də daxildir; əvvəlki audit ZIP-ini ayrıca tətbiq etmək lazım deyil. Paket `0584942` GitHub versiyası üzərində hazırlanıb, node_modules və real məlumatları daşımır.

**Başla:** [Windows quraşdırma addımları](docs/group7/QURASDIRMA.md).

| Əlavə | Haradan açılır | Qayda |
|---|---|---|
| Borcun yaşı | Customers → Debt aging (admin); müştəri → Account statement | Qaimə tarixindən 0–30, 31–60, 61+ təqvim günü; yalnız qalan borc. Son ödəmə tarixi müəyyən edilmədiyindən “gecikmə” iddiası etmir. |
| Hesab çıxarışı | Müştəri detail → Account statement | Tarix aralığı, başlanğıc/son balans, satış, ödəniş, ödəniş ləğvi, qaytarma, refund; CSV/PDF. Mənfi balans müştəri kreditidir. |
| Endirim və vergi | New sale → Order summary; qaimə redaktəsi | Yalnız admin; əvvəl endirim, sonra vergi. 0–100%, iki onluq rəqəm, standart 0. Tariflər əl ilə seçilir. |
| PDF | Qaimə pəncərəsi və hesab çıxarışı → Download PDF / Share PDF | Serverdə hazırlanır; başqa şirkətə açıq link yaranmır. Dəstəkləyən HTTPS mobil brauzerdə sistem paylaşımı, digər halda yükləmə. |
| E-poçt xatırlatması | Müştəri detail → Email reminders (admin) | Müştərinin e-poçtu və razılığı, önbaxış, növbəyə əlavə etmə, status tarixçəsi. SMTP ayrıca sazlanır. |
| Klaviatura | Satış ekranı | Alt+K axtarışa fokus; axtarışda Enter görünən ilk uyğun məhsulu əlavə edir; Ctrl+Enter düzgün satışı təsdiqləyir. Açıq dialoqda satış təsdiqlənmir. |
| Kəsr miqdarlar | Stock → məhsul yarat/dəyiş → Unit | PIECE/BOX tam ədəd; KG/LITER üç onluq rəqəmədək. Stok və sənəd olduqdan sonra vahid dəyişmir. |
| Demo | Operator: `npm run demo:create` | Yeni, ayrı şirkət; nümunə məlumatları; 7 gün; e-poçt və ödənişli checkout qapalı. Mövcud şirkəti sıfırlamır. |

Qaimə sətirlərinə endirim/vergi qəpikləri dəqiq bölüşdürülür. Qaytarma məhsulun həmin satışdakı yekun dəyərindən hesablanır; hissə-hissə qaytarmalar birlikdə ilkin məbləği aşmır. Köhnə məhsullar `PIECE`, köhnə qaimələr 0% endirim/vergi ilə saxlanılır.

Dörd dil: English, Azərbaycanca, Türkçe, Русский. Mövcud paket qiymətləri və giriş ardıcıllığı dəyişdirilmir. Valyuta çevrilməsi edilmir.

Yoxlamalar və xarici sazlama sərhədləri: [NETICELER](docs/group7/NETICELER.md). İfşa olunmuş Git backup tarixçəsi/real girişlər üçün əvvəlki [F01 təlimatı](docs/audit-fixes/BACKUP-TEMIZLEME.md) qüvvədədir.
