# Responsive Studio — İhtiyaç Analizi ve Yol Haritası

> Profesyonel web tasarımcıları için Chrome tabanlı çoklu-viewport test stüdyosu.
> Tek tıkla, açık olan siteyi onlarca cihaz boyutunda aynı anda, canlı ve etkileşimli görüntüler.
>
> Bu dosya **neyin neden** yapıldığını, ölçümleri ve iptal edilen fikirleri tutar.
> Kodu değiştirecekseniz önce [GELISTIRICI-REHBERI.md](./GELISTIRICI-REHBERI.md).

---

## 1. Amaç

Hazırlanan web sitelerinin farklı bilgisayar, cihaz, tarayıcı ve ekran ölçülerinde nasıl göründüğünü
**anında ve aynı ekranda** görebilmek. DevTools'un tek-cihaz kısıtını ve sürekli boyut değiştirme
zahmetini ortadan kaldırmak.

---

## 2. Teknik Araştırma Bulguları (kritik kısıtlar ve çözümleri)

### 2.1 Iframe engelleme (X-Frame-Options / CSP frame-ancestors)
**Sorun:** Sitelerin çoğu `X-Frame-Options: DENY|SAMEORIGIN` veya
`Content-Security-Policy: frame-ancestors` gönderir; iframe'e alınamazlar.

**Çözüm:** MV3 `declarativeNetRequest` API'si ile `modifyHeaders` → `remove` operasyonu
(Chrome 86+). Kritik detay: `RuleCondition.tabIds` **yalnızca session-scoped kurallarda**
destekleniyor. Bu sayede header silme kuralları **sadece görüntüleyici sekmemize** uygulanır;
kullanıcının normal gezinme güvenliği hiç bozulmaz. (Piyasadaki eklentilerin çoğu bu kuralları
global uyguluyor — güvenlik açığı yaratıyor.)

Silinecek header'lar: `x-frame-options`, `content-security-policy`,
`content-security-policy-report-only`.

### 2.2 Oturum kaybı (giriş yapılmış site testi)
**Sorun:** Normalde bir siteyi başka origin'de iframe'lediğinde `SameSite` çerezleri gitmez,
storage partition ayrışır → site "çıkış yapmış" görünür.

**Çözüm (araştırmada bulundu):** Chrome resmî dokümantasyonu:
- *"Third-party cookies are never blocked even in subframes if the top-level page for a given tab
  is a `chrome-extension://` page."*
- *"If a page with the `chrome-extension://` scheme includes an iframe, and the extension has
  **host permissions** for the site it is embedding, that site will also have access to its
  top-level partition."*
- *"Requests from an extension to third-party origins are treated as same-site when the extension
  has host permissions... `SameSite=Strict` cookies can be sent."*

→ `host_permissions: ["<all_urls>"]` ile **giriş yapılmış oturumlar korunur.** Bu, Responsive
Viewer gibi rakiplerin çözemediği bir problem. Mimarinin görüntüleyiciyi ayrı bir
`chrome-extension://` sekmesinde açması bu yüzden zorunlu.

### 2.3 Frame başına User-Agent (Chrome API sınırı)
**Sorun:** `declarativeNetRequest` koşulları frame'i ayırt edemez (`frameId` koşulu yok).
Aynı sekmedeki 10 iframe'e 10 farklı UA **başlığı** gönderilemez.

**Çözüm (uygulandı):** Her frame'e `document_start`'ta MAIN world script enjekte edilir;
`navigator.userAgent`, `navigator.userAgentData`, `navigator.platform`, `maxTouchPoints`,
`screen.*`, `devicePixelRatio` frame'e özel değerlerle override edilir. JS ile cihaz tespiti
yapan sitelerin ezici çoğunluğu bununla doğru davranır. Sunucu taraflı UA tespiti için sekme
geneli tek bir HTTP UA override'ı (DNR) ayrıca sunulur.

### 2.3.1 Yapılandırma nasıl taşınır — ÖLÇÜLEN GERÇEK
İlk tasarım, yapılandırmayı iframe'in `name` niteliği üzerinden taşıyordu. **Test bunu
çürüttü:** Chrome, bir çerçeve cross-origin gezindiğinde browsing-context adını sıfırlıyor,
dolayısıyla `window.name` framed sayfada boş geliyor.

**Uygulanan çözüm:** yapılandırma **URL fragment'ında** taşınıyor
(`https://site.com/#__rs=<json>`). Fragment sunucuya hiç gönderilmez, yani isteği değiştirmez.
Emülasyon script'i `document_start`'ta fragment'i okur, uygular, `window.name`'e yedekler
(köprü script'i için) ve `history.replaceState` ile adresi **sayfanın kendi JS'i çalışmadan
önce** temizler. Sayfanın orijinal fragment'ı varsa geri konur.

Yeniden yükleme notu: yalnızca fragment değişirse tarayıcı aynı-belge gezinmesi yapar ve sayfa
yenilenmez; bu yüzden yenileme gerektiğinde `<iframe>` elemanı tamamen yeniden oluşturulur.

### 2.4 Gerçek DPR ve CSS medya emülasyonu — ÖLÇÜLEN SINIRLAR
Chrome 152 üzerinde `chrome.debugger` ile alt çerçeve (OOPIF) hedeflerine bağlanılıp test
edildi. Sonuçlar:

| Yetenek | Nerede uygulandı | Sonuç |
|---|---|---|
| `Emulation.setEmulatedMedia` → `prefers-color-scheme` | üst düzey hedef | ✅ **alt çerçevelere geçiyor** |
| `Emulation.setEmulatedMedia` → `pointer` / `hover` / `prefers-reduced-motion` | üst düzey hedef | ❌ alt çerçevelere geçmiyor (ama §2.15'e bakın — CDP'siz çözüldü) |
| `Emulation.setDeviceMetricsOverride` | alt frame oturumu | ❌ *"Command can only be executed on top-level targets"* |
| `Emulation.setTouchEmulationEnabled` | alt frame oturumu | ❌ başarı döner, CSS'e yansımaz |
| `Network.setUserAgentOverride` | alt frame oturumu | ❌ başarı döner, sunucu gerçek UA'yı görür |

### 2.5 Faz 2'de ölçülen üç Chrome davranışı

**a) MV3 content script'leri cross-origin `fetch` yapamaz.** Bağlantı denetimi ve dış
stylesheet indirme (kırılım noktası tespiti) sessizce başarısız oluyordu. Bu istekler host
izinlerine sahip **service worker** üzerinden geçirildi; Vikipedi'nin CDN'den gelen
`load.php` stylesheet'i böyle taranabiliyor.

**b) iframe'e `src`, eleman DOM'a eklenmeden atanırsa sayfa `innerWidth` değerini 0 okuyor.**
Gezinme sıfır boyutlu bir çerçevede başladığı için, sayfanın erken çalışan satır içi
script'leri yanlış genişlik görüyordu — `innerWidth`'e göre yerleşim kuran siteler bozuk
render ediyordu. Çözüm: önce `appendChild`, sonra yerleşimi zorla (`void el.offsetWidth`),
en son `src`.

**c) Sayfanın `console` çağrıları yalnızca MAIN world'den yakalanabiliyor.** ISOLATED
world'deki köprü script'i ayrı bir JS bağlamında olduğu için sayfanın `console.error`
çağrılarını göremiyor. Konsol toplayıcı emülasyon script'ine (MAIN world) taşındı;
`chrome.runtime` erişimi olmadığı için doğrudan `parent.postMessage` ile viewer'a iletiyor.

**Doğrulanmış çalışan:** `PerformanceObserver` ile LCP, CLS, FCP alt çerçevelerde çalışıyor
(gerçek sitede ölçüldü: Vikipedi'de LCP 1036ms, CLS 1.001). INP yalnızca etkileşim sonrası
dolar.

### 2.6 Ekran görüntüsü — çözünürlük tuzağı
`chrome.tabs.captureVisibleTab` yalnızca **görünür** alanı, **ekranda göründüğü ölçekte**
verir. Ekranlar küçültülmüş gösterildiği için ilk uygulama 360px'lik bir cihazı 337px olarak
yakalıyordu. Çözüm: yakalamadan önce o çerçeve geçici olarak **1:1 ölçeğe** çekiliyor, sonra
tuval hem dikey hem **yatay** dilimlenip birleştiriliyor. Retina ekranda çıktı 2× cihaz
pikseli oluyor. Yakalama sırasında denetçi vurgusu da temizleniyor.

### 2.7 Faz 3: gerçek CSS medya emülasyonu — çalışan yöntem

Pro Mod'un (CDP) başaramadığı şey, **stylesheet yeniden yazımıyla** izin gerektirmeden
başarıldı ve gerçek Chrome'da doğrulandı:

Sayfanın stylesheet'lerindeki `@media (prefers-color-scheme: dark)` gibi koşullar, her zaman
eşleşen `(min-width: 0px)` veya hiç eşleşmeyen `(min-width: 999999px)` ile değiştiriliyor.
Koşulun geri kalanı (`and (min-width: 600px)` gibi) korunuyor.

| Katman | Yöntem | Durum |
|---|---|---|
| Aynı-origin ve satır içi `<style>` | `CSSMediaRule.media.mediaText` yeniden yazımı | ✅ |
| Cross-origin `<link>` stylesheet | SW ile indir → göreli adresleri mutlaklaştır → `@import` zincirini aç → yeniden yaz → satır içi enjekte et, özgününü `disabled` yap | ✅ |
| Sonradan eklenen CSS (SPA / lazy) | `MutationObserver` | ✅ |
| Geri alma | Özgün `mediaText` geri yazılır, enjekte edilenler silinir, `<link>`'ler yeniden etkinleştirilir | ✅ |
| JS `matchMedia` | MAIN world yaması, ISOLATED köprüden `postMessage` ile güncellenir | ✅ |
| UA widget'ları (form, kaydırma çubuğu) | `:root { color-scheme }` | ✅ |

Doğrulanan özellikler: `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`,
`forced-colors`. Test: işletim sistemi koyu temadayken açık mod zorlandı; hem satır içi hem
**harici** stylesheet doğru tepki verdi, `Otomatik`'e dönünce sayfa bozulmadan eski haline
döndü.

### 2.8 Faz 3'te bulunan iki kusur
- **Göreli `og:image` adresleri** viewer'ın origin'ine göre çözülüyordu (sosyal önizleme
  kartları boş çıkıyordu). Meta değerleri artık çerçeve içinde, `location.href`'e göre
  mutlaklaştırılıyor.
- **SVG'ler "gereğinden büyük görsel" olarak işaretleniyordu.** SVG çözünürlükten bağımsız
  olduğu için doğal/görünen boyut karşılaştırması onlara uygulanmıyor artık.

### 2.9 Faz 4'te ölçülen kritik MV3 kısıtı

**ISOLATED world'den sayfaya eklenen satır içi `<script>` MV3'te çalışmıyor.**

```
MAIN world'den:     script elemanı ekle → çalıştı ✓
ISOLATED world'den: script elemanı ekle → SESSİZCE çalışmadı ✗
```

Content script'in izole dünyası kendi CSP'sine tabi ve oradan oluşturulan script elemanları
yürütülmüyor. Sayfanın CSP'sini kaldırmak bunu değiştirmiyor — kısıt izole dünyanın kendisinde.

Bu yüzden canlı JS enjeksiyonu MAIN world script'ine devredildi: köprü (ISOLATED) kodu
`window.postMessage` ile MAIN world'e iletiyor, orada `new Function(code)()` ile çalışıyor.
İki dünya aynı `window` nesnesini paylaştığı için bu kanal güvenilir ve hızlı.

`<style>` elemanları bu kısıttan etkilenmiyor — canlı CSS enjeksiyonu ISOLATED world'de
sorunsuz çalışıyor.

### 2.10 Araç çubuğu kalabalıklaşması
Faz 4 sonunda araç çubuğunda 20 öğe birikmişti ve **Konsol düğmesi 1600px'lik pencerede
ekrandan taşıyordu** — yatay kaydırma olsa da erişilemez hâle gelmişti. Tarama düğmeleri
"Rapor", erişilebilirlik denetimleri "Erişilebilirlik", geliştirici araçları "Geliştirici"
menülerinde toplanarak 15 öğeye indirildi. Bindirme araçları (Kontur, Taşma, Izgara, Denetçi,
Cetvel) sık kullanıldıkları için doğrudan düğme olarak bırakıldı.

### 2.11 Menü kırpılma hatası
Araç çubuğundaki menüler açıldığında yalnızca ince bir çizgi olarak görünüyordu. Neden:
`.subbar` yatay kaydırma için `overflow-x: auto; overflow-y: hidden` taşıyor ve
`position: absolute` ile konumlanan menü bu 38px'lik kutuya **dikeyde kırpılıyordu**.

Çözüm: menü `position: fixed` ile, tetikleyici düğmenin `getBoundingClientRect()` değerinden
hesaplanan koordinatlara çiziliyor; sağ kenardan taşarsa içeri çekiliyor. Bu ayrıca menünün
çubuğun kaydırma genişliğine katkı vermesini de engelliyor.

### 2.12 Global ipucu (tooltip)
Tarayıcının yerleşik `title` ipucu ~1 sn gecikmeli, biçimlendirilemez ve uzun metinlerde
okunaksız. Tek bir yüzen katman, belge düzeyinde olay delegasyonuyla `title` taşıyan her
elemanı yakalıyor: değeri `data-tip`'e taşıyor, `title`'ı kaldırıyor (çift ipucu çıkmasın) ve
metni olmayan ikon düğmeleri için `aria-label` olarak geri yazıyor. Böylece her bileşene ayrı
ipucu kodu eklemeye gerek kalmadı ve ikon butonlar erişilebilir kaldı.

### 2.13 Masaüstü presetleri: ekran ≠ viewport
Windows'ta en çok kullanılan çözünürlüklerin hazır gelmesi için gerçek kullanım verisi
incelendi ve iki şey düzeltildi:

**a) Ölçekleme, DPR demektir.** StatCounter'a göre dünyada 2. en yaygın masaüstü
"çözünürlüğü" **1536×864** — bu ayrı bir ekran değil, 1920×1080 ekranın Windows %125
ölçeklemesidir. `screen.width` 1536 döndürür ama `devicePixelRatio` **1.25**'tir. Bu fark
`srcset` / `image-set()` seçimini belirlediği için responsive testte önemlidir; presetler
buna göre eklendi (%100 → 1, %125 → 1.25, %150 → 1.5, %200 → 2).

**b) Ekran çözünürlüğü tarayıcı viewport'u değildir.** screensize.net verisine göre en yaygın
masaüstü viewport'u **1920×920** — yani 1080'lik ekranda görev çubuğu ve tarayıcı arayüzü
~160 px yiyor. Katalogdaki masaüstü girdileri ekran yüksekliğini kullanıyordu; artık:

- `width`/`height` → **tarayıcı viewport'u** (test edilen gerçek alan)
- `screenW`/`screenH` → **fiziksel ekran**, `screen.width/height` bunu döndürür
- `window.outerHeight` → viewport + tarayıcı arayüzü
- `screen.availHeight` → ekran − görev çubuğu

Telefon ve tabletlerde ikisi aynı olduğu için bu alanlar isteğe bağlı bırakıldı.

Açılış seti de bu veriye göre yenilendi ve Ayarlar'dan değiştirilebilir hâle getirildi.
Bugünkü hâli **11 ekran**:

| Sınıf | Ekranlar |
|---|---|
| Telefon | 320 (iPhone SE 2016 — en dar gerçek cihaz, yatay taşmaları yakalar), 360 (Galaxy S25), 393 (iPhone 16), 440 (iPhone 17 Pro Max) |
| Tablet | 800 (Galaxy Tab S9 — Android UA), 820 (iPad Air 11 — iOS UA) |
| Windows | 1366×608 (kurumsal HD dizüstü), 1536×736 (FHD %125), 1536×832 (16:10 %125 — güncel kurumsal dizüstü), 1920×920 (en yaygın masaüstü) |
| macOS | 1470×844 (MacBook Air 13) |

İki tablet aynı genişliğe yakın ama farklı UA/`userAgentData` ve farklı tarayıcı motoru
profili taşıdığı için ayrı tutuldu. 1536 iki kez geçiyor: genişlik aynı, **yükseklik**
farklı (16:9 → 736, 16:10 → 832) ve “ilk ekranda ne görünüyor” sorusunu ayıran şey bu.

**16:10 kurumsal dizüstü neden eklendi?** 2021'den beri ThinkPad T/X, Dell Pro (eski
Latitude) ve HP EliteBook 800 serisi 1920×1200 panele geçti; Windows bu panelde 14"
için %125 öneriyor → CSS ekranı 1536×960, viewport 1536×832. Kurumsal filoda 1366×768 ile
birlikte en sık karşılaşılan ikinci yapılandırma.

### 2.14 Eklenti hata listesindeki gürültü
`chrome://extensions` hata sayfasında üç tür kayıt görüldü. Üçü de araştırıldı:

**a) iframe sandbox uyarısı — kaçınılmaz ve bilinçli.**
`sandbox="allow-scripts allow-same-origin"` kullanıldığında Chrome her zaman
*"can escape its sandboxing"* uyarısı yazar. Sandbox'ın gerekliliği ölçüldü: kapatıldığında
`top.location` atayan bir test sayfası **stüdyo sekmesini anında kaçırdı** (kullanıcı hareketi
bile gerekmedi). `allow-same-origin` ise oturum korunması için zorunlu (§2.2). Dolayısıyla
uyarı, gerçek bir korumanın bedeli — README'de açıklandı.

**b) Sitenin kendi konsol hataları eklentiye atfediliyordu — düzeltildi.**
`console.error` doğrudan eklenti kodundan sarmalandığında, sayfanın hataları çağrı yığınında
eklenti script'ini gördüğü için eklentiye atfediliyordu. Test sayfasının kendi
`console.error('Test hatasi')` çağrısının `chrome://extensions` listesinde göründüğü
doğrulandı. Çözüm: konsol yakalama ve canlı JS çalıştırma, `<script>` elemanı olarak
**sayfanın kendi bağlamına** enjekte ediliyor; böylece sitenin hataları siteye ait kalıyor.
Sayfa CSP'si satır içi script'i engellerse eski yönteme düşülüyor.

**c) `ThrottlerException: Too Many Requests` — aracın yan etkisi, giderildi.**
Sekiz ekranın aynı anda yüklenmesi, sitenin API'sine sekiz kat istek gönderip hız
sınırlayıcıyı tetikliyordu. Kademeli yükleme eklendi (varsayılan 150 ms, Ayarlar'dan
değiştirilebilir); ölçümde istekler ~150 ms aralıklarla ulaştı.

### 2.15 Parmak modu — "imkânsız" sanılan şey aslında yapılabiliyordu

Faz 3'te CSS `@media (pointer: coarse)` ve `(hover: none)` emülasyonunun iframe içinde
imkânsız olduğu yazılmıştı. Bu **CDP için** doğruydu (§2.4 tablosu). Ama koyu mod için
geliştirilen **stylesheet yeniden yazma** tekniği (§2.7) bu özelliklere de birebir uyuyor;
yani belgelenen sınırı projenin kendi tekniği zaten aşıyordu.

Mobil ekranların parmakla kullanılıyormuş gibi davranması gerektiği için konu yeniden ele
alındı ve **parmak modu** eklendi (dokunmatik cihazlarda varsayılan açık):

| Katman | Yöntem | Durum |
|---|---|---|
| CSS `(pointer: coarse)` / `(any-pointer: coarse)` | media koşulu yeniden yazımı | ✅ |
| CSS `(hover: none)` / `(any-hover: none)` | media koşulu yeniden yazımı | ✅ |
| `:hover` stilleri | **seçici** yeniden yazımı — `:hover` içeren parçalar kuraldan çıkarılır (`a:hover, a:focus` → `a:focus`) | ✅ |
| JS `matchMedia('(pointer: coarse)')` | MAIN world yaması (Faz 1) | ✅ |
| Dokunma olayları | pointer → TouchEvent köprüsü (Faz 1) | ✅ |
| `maxTouchPoints`, `ontouchstart` | MAIN world yaması (Faz 1) | ✅ |

`:hover` bir media özelliği değil sözde-sınıf olduğu için media yeniden yazımı ona yetmiyor;
bu yüzden kural seçicileri ayrıca düzenleniyor. Gerçek bir telefonda hover stilleri hiç
uygulanmaz — hover'la açılan menülerin parmakla açılmaması en yaygın mobil hatalardan biri ve
ancak bu emülasyonla görülebiliyor.

Masaüstü ekranlar etkilenmiyor. Hover durumlarını incelemek gerektiğinde araç çubuğundaki
**Parmak** düğmesiyle kapatılıp açılabiliyor; kapatınca özgün seçiciler geri yükleniyor.

### 2.15.1 İlk sürüm gerçek sitede çalışmadı — üç ayrı sebep

İlk sürüm gerçek sitelerde çalışmadı. Gerçek bir SPA'yı taklit eden test sayfası kuruldu
(ayrı porttan gelen cross-origin CDN stylesheet, sonradan enjekte edilen stil, JS ile hover)
ve üç ayrı kusur ortaya çıktı:

**a) Cross-origin stylesheet çoğu çerçevede hiç değiştirilmiyordu.**
`document_start`'ta `document.styleSheets` boş; tek dayanak MutationObserver'ın `<link>`
için bağladığı `load` dinleyicisiydi. Ama stylesheet, gözlemci geri çağrısı çalışmadan önce
yüklenebiliyor (tarayıcı önbelleği sıcakken sıklıkla) ve dinleyici geç bağlanıyordu.
Çözüm: tarama `DOMContentLoaded`, `load` ve 150/500/1200/2500/5000 ms'de tekrarlanıyor;
`<link>` eklendiğinde hem hemen hem yüklenince deneniyor. Tarama etkisiz-tekrarlı olduğu
için tekrarlar bedava.

**b) Eşzamanlı tarama turları birbirini eziyordu.**
`applyMedia` birden çok kaynaktan çağrılıyor ve içinde `await` var. Bir çağrının
`restoreAll()`'u, diğerinin yarım kalmış stylesheet değişimini bozup **sayfayı tamamen
stilsiz bırakabiliyordu** (bir çerçevede ölçüldü). Çözüm: çağrılar kuyruğa alındı, bir
`nesil` sayacı eski çağrıları geçersizleştiriyor ve `replaceExternal` kilidi `await`'ten
önce koyuluyor.

**c) JS ile yapılan hover hiç engellenmiyordu.**
CSS `:hover` nötrlemesi, `onmouseenter` ile stil değiştiren uygulamalara etki etmiyor.
Gerçek telefonda fare gezdirme olayları hiç tetiklenmez; yalnızca dokunma dizisinin parçası
olarak bir kez gelirler. `mouseover/out/enter/leave/move` olayları pencere yakalama
aşamasında bastırıldı (dokunma dizisi sırasında ve senkron için üretilen yapay olaylarda
geçirilir). Kendi denetçi ve cetvel araçlarımız bu bastırmadan etkilenmesin diye
`mouse*` yerine `pointer*` olaylarına geçirildi.
CDP'nin alt çerçevelerde sunabildiği tek şey `prefers-color-scheme` emülasyonuydu. Bunun için
bile `chrome.debugger` izni gerekiyor — ve **Chrome bu izni isteğe bağlı olarak vermiyor**:

```
optional_permissions: ["debugger"]  →  manifeste kabul ediliyor
chrome.permissions.request({permissions:['debugger']})
  →  "Only permissions specified in the manifest may be requested."
chrome.permissions.request({permissions:['cookies']})   // karşılaştırma
  →  true
```

Yani Pro Mod ancak **kalıcı, kapsamlı ve korkutucu bir kurulum izniyle** mümkün. Tek bir
özellik için bu takas yapılmadı; Pro Mod ve tüm CDP kodu kaldırıldı.

**Gerçek CSS koyu mod için yeni plan (Faz 3, izin gerektirmez):** content script, sayfanın
stylesheet'lerini gezip `@media (prefers-color-scheme: …)` kurallarının `mediaText`'ini
yeniden yazar (`all` / `not all`). Okunamayan cross-origin stylesheet'ler host izniyle
yeniden indirilip satır içi enjekte edilir.

> **Sonradan düzeltme:** bu tablodaki `pointer` / `hover` satırı CDP için hâlâ geçerli, ama
> sorunun kendisi §2.15'te stylesheet yeniden yazımıyla çözüldü. CDP gerekmiyor.

**Her durumda doğru çalışan:** genişlik tabanlı media query'ler. iframe gerçekten o
genişlikte olduğu için `@media (max-width: 600px)` vb. hiçbir hileye ihtiyaç duymadan doğru
sonuç verir — responsive testin %95'i budur.

### 2.5 Ekran görüntüsü
- **Standart:** `chrome.tabs.captureVisibleTab` + kaydır-ve-birleştir (Canvas). Saniyede 2 çağrı
  limiti var, tam sayfa yavaş.
- **Pro Mod:** `Page.captureScreenshot` + `captureBeyondViewport` + `clip` → tek seferde,
  pixel-perfect, dikişsiz tam sayfa.

### 2.6 Diğer notlar
- `chrome.debugger` MV3'te mevcut, `"debugger"` izni gerekir, aktifken sarı "hata ayıklanıyor"
  çubuğu çıkar → **varsayılan kapalı, isteğe bağlı**.
- `Referer` ve `Sec-Fetch-*` header'ları kısıtlı listede olabilir; bunlara bağımlı siteler için
  Pro Mod gerekir.
- Session DNR kural limiti: 5000 (fazlasıyla yeterli).

---

## 3. Rakip Analizi (özellik referansı)

| Araç | Tip | Güçlü yanı | Eksiği |
|---|---|---|---|
| Chrome DevTools | Yerleşik | Gerçek emülasyon, ücretsiz | Tek cihaz, sürekli geçiş |
| Responsive Viewer | Eklenti | Çoklu ekran, ücretsiz | Reklam, oturum kaybı, senkron zayıf, header'ları global siler |
| Polypane | Ayrı tarayıcı | 40+ hata ayıklama aracı, a11y, sosyal önizleme | Ücretli, ayrı tarayıcı |
| Sizzy | Ayrı tarayıcı | Canlı kod senkronu | Ücretli |
| Responsively App | Electron | Ücretsiz, çoklu ekran | Ayrı uygulama, oturum yok |

**Hedefimiz:** Polypane'in özellik derinliği + eklenti kolaylığı + oturum korunması.

---

## 4. Özellik Listesi (70 madde, 4 faz)

### FAZ 1 — Çekirdek Motor  ✅ v1.0 hedefi
| # | Özellik |
|---|---|
| 1 | Çoklu viewport ızgarası — sınırsız frame, tek URL, canlı |
| 2 | 200+ cihaz kütüphanesi (iOS, Android, tablet, katlanabilir, masaüstü, TV, saat) — doğru viewport/DPR/UA/dokunma |
| 3 | Özel cihaz oluşturucu (kaydet/düzenle/sil) |
| 4 | Dikey/yatay çevirme (frame başına + toplu) |
| 5 | Frame başına + genel yakınlaştırma, "ekrana sığdır" otomatik ölçek |
| 6 | Yerleşim modları: ızgara / yatay şerit / dikey sütun / serbest tuval / odak |
| 7 | Kenardan sürükleyerek serbest boyutlandırma + canlı px göstergesi |
| 8 | Cihaz çerçevesi (bezel) aç/kapa, çentik + `env(safe-area-inset-*)` simülasyonu |
| 9 | Frame göster/gizle, sürükle-bırak sıralama |
| 10 | Cihaz setleri: Mobil / Tablet / Masaüstü / Bootstrap / Tailwind / özel setler |
| 11 | Senkron kaydırma (oransal veya mutlak) |
| 12 | Senkron tıklama / yazma / form girişi |
| 13 | Senkron hover |
| 14 | Senkron gezinme (birinde URL değişince hepsi) |
| 15 | "Tek frame'de çalış" modu (senkronu geçici kapat) |
| 16 | Dokunma emülasyonu (pointer → touch olayları, `maxTouchPoints`) |
| 17 | Adres çubuğu + geri/ileri/yenile/tümünü yenile/sert yenile |
| 18 | Otomatik yenileme zamanlayıcı + localhost canlı yeniden yükleme |
| 51 | Frame başına UA + Client Hints (§2.3) — ✅ doğrulandı |
| 59 | Çalışma alanları (proje): URL + cihaz seti + ayarlar kaydet, hızlı geçiş |
| 60 | Oturum kalıcılığı (son durumu geri yükle) |
| 61 | Her şey için klavye kısayolları |
| 62 | Araç arayüzü için koyu/açık tema |
| 64 | Sekme / ayrık pencere olarak açma |
| 65 | %100 yerel, telemetri yok |
| 66 | Ayarları JSON olarak dışa/içe aktar |
| 68 | Klavye kısayolu ile anında açma (Ctrl+Shift+Y) |
| 69 | Sağ tık menüsü "Responsive Studio'da aç" |
| 70 | `localhost` ve `file://` desteği |

### FAZ 2 — İnceleme ve Görsel Araçlar  ✅ tamamlandı

> **Düzeltme notu:** Faz 2 kapatılırken 22 (cetvel/ölçüm), 28'in bir kısmı (CSS değişkenleri)
> ve 30 (canlı CSS/JS) yanlışlıkla ✅ işaretlenmişti ama teslim edilmemişti. Üçü de Faz 4
> başında tamamlandı ve test edildi.
| # | Özellik | Durum |
|---|---|---|
| 19 | Yatay taşma dedektörü (x-scroll'a sebep olan elemanı işaretle)  ✅ |
| 20 | CSS breakpoint tespiti — stylesheet'leri tarayıp media query'leri çıkar, cetvelde göster, "her breakpoint için frame ekle"  ✅ |
| 21 | Frame'ler arası eleman denetçisi (bir elemana tıkla → hepsinde vurgula + box model)  ✅ |
| 22 | Cetvel ve ölçüm aracı, artı-kılavuz çizgileri  ✅ |
| 23 | Izgara bindirmesi: kolon (12/16), taban çizgisi, 8pt  ✅ |
| 24 | Tüm elemanların konturunu göster / yerleşim kutuları  ✅ |
| 25 | Konsol toplayıcı — tüm frame'lerden hata/uyarı  ✅ |
| 26 | Ağ hatası özeti (kırık görsel, 404)  ✅ |
| 27 | Kırık bağlantı denetleyici  ✅ |
| 28 | Font & CSS bilgisi: hesaplanmış stiller, kullanılan fontlar, CSS değişkenleri  ✅ |
| 29 | Frame başına Web Vitals (LCP/CLS/INP)  ✅ |
| 30 | Canlı CSS/JS enjeksiyonu (tüm frame'lere uygulanan not defteri)  ✅ |
| 31 | Ekran görüntüsü: tek frame / tümü / tam sayfa / bezel'li  ✅ |
| 32 | PNG / JPG / PDF / ZIP dışa aktarma, panoya kopyalama  ✅ |
| 33 | Kontakt föy (tüm frame'ler etiketli tek görselde)  ✅ |
| 34 | Tasarım bindirmesi (pixel-perfect): PNG sürükle-bırak, opaklık, fark (difference) modu, ok tuşlarıyla kaydırma  ✅ |
| 35 | Renk seçici / damlalık  ✅ |

### FAZ 3 — Kalite ve Erişilebilirlik  ✅ tamamlandı
| # | Özellik | Durum |
|---|---|---|
| 36 | Renk kontrast denetleyici (WCAG AA/AAA)  ✅ |
| 37 | Renk körlüğü simülatörleri (protanopi, döteranopi, tritanopi, akromatopsi)  ✅ |
| 38 | Frame başına koyu/açık mod emülasyonu (`prefers-color-scheme`) — ikisini yan yana gör  ✅ |
| 39 | `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` emülasyonu  ✅ |
| 40 | Bulanıklık/gözü kısma testi, gri tonlama testi  ✅ |
| 41 | Yakınlaştırma / metin ölçekleme testi (%200 zoom, büyük font)  ✅ |
| 42 | Otomatik a11y denetimi (axe-core, yerel paketli)  ✅ |
| 43 | Başlık (heading) yapısı ana hattı  ✅ |
| 44 | Landmark / ARIA genel görünümü  ✅ |
| 45 | Tab sırası / odak sırası görselleştirme  ✅ |
| 46 | Alt metin denetimi  ✅ |
| 47 | Dokunma hedefi boyutu kontrolü (44×44)  ✅ |
| 48 | Meta etiket genel görünümü (title, description, canonical, robots, hreflang)  ✅ |
| 49 | Sosyal önizleme kartları: X, Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, Google SERP, iMessage  ✅ |
| 50 | Favicon / app ikonu, `manifest.json`, PWA kontrolü  ✅ |

### FAZ 4 — İleri Seviye  ✅ tamamlandı
| # | Özellik | Durum |
|---|---|---|
| 38 | Gerçek CSS `prefers-color-scheme` (stylesheet yeniden yazımı) | Faz 3'e taşındı — izin gerektirmeyen yol bulundu (§2.4.1) |
| 55 | Pro Mod (CDP) | ⛔ **İptal** — Chrome `debugger` iznini isteğe bağlı vermiyor (§2.4.1) |
| 52–54 | Ağ/CPU kısıtlama, coğrafi konum | ⛔ CDP'siz mümkün değil |
| 56 | Özel HTTP header'ları (auth, basic auth, feature flag) | ✅ **yapıldı** — yalnızca stüdyo sekmesinde geçerli |
| 57 | Çerez görüntüleyici ve temizleyici | ✅ **yapıldı** — `cookies` izni yalnızca panelden istenir |
| 58 | localStorage / sessionStorage görüntüleyici ve temizleyici | ✅ **yapıldı** |
| 67 | Etkileşim kaydı → WebM | ✅ **yapıldı** — `getDisplayMedia` + `MediaRecorder`, ek izin gerekmez. GIF yok: aynı süre için WebM hem çok daha küçük hem daha kaliteli |
| 31 | Tam sayfa ekran görüntüsü | ✅ Faz 2'de yapıldı |

> Hiçbir madde ölçülmeden vaat edilmiyor. §2.4, bu disiplinin neden gerekli olduğunu gösteriyor:
> makul görünen dört CDP yeteneğinden dördü de pratikte çalışmadı.

---

## 5. Mimari

```
┌─ Araç çubuğu ikonu / Ctrl+Shift+Y / sağ tık ──────────────┐
│                          ↓                                 │
│  background/service-worker.ts                              │
│   • viewer sekmesini açar (viewer.html?url=...)            │
│   • o tabId'ye özel SESSION DNR kuralları ekler            │
│     (x-frame-options + CSP sil, UA/CH header'ı yaz)        │
│   • sekme kapanınca kuralları temizler                     │
│   • Pro Mod: chrome.debugger attach/detach köprüsü         │
└────────────────────────────────────────────────────────────┘
                           ↓
┌─ viewer.html (chrome-extension:// sekmesi) ────────────────┐
│  Preact UI                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Üst çubuk: URL • yenile • zoom • yerleşim • senkron   │  │
│  ├───────────┬──────────────────────────────────────────┤  │
│  │ Cihaz     │  <iframe> <iframe> <iframe> ...           │  │
│  │ paneli    │  her biri gerçek boyutunda, ölçekli       │  │
│  └───────────┴──────────────────────────────────────────┘  │
│  postMessage (token'lı) ile frame'lerle doğrudan haberleşir │
└────────────────────────────────────────────────────────────┘
                           ↓ (her iframe'in içinde)
┌─ content/emulation.ts  (MAIN world, document_start) ───────┐
│  navigator.userAgent / userAgentData / platform            │
│  maxTouchPoints / screen.* / devicePixelRatio override     │
└────────────────────────────────────────────────────────────┘
┌─ content/bridge.ts  (ISOLATED world, all_frames) ──────────┐
│  scroll raporla/uygula • tıklama-yazma yansıt • hover      │
│  URL/başlık değişimi bildir • (Faz 2) taşma, breakpoint    │
└────────────────────────────────────────────────────────────┘
```

**Neden ayrı sekme (in-page overlay değil):** §2.2 — yalnızca `chrome-extension://` top-level
sayfada 3rd-party çerezler bloklanmaz ve host permission ile top-level storage partition'a erişim
verilir. Oturum korunması buna bağlı.

---

## 6. Teknoloji Kararları

- **Manifest V3**, Vite + TypeScript + **Preact** (~4KB, React API'si)
- İzinler: `storage`, `scripting`, `contextMenus`,
  `declarativeNetRequestWithHostAccess`; opsiyonel: `cookies`. **`debugger` yok** (§2.4.1)
  - Dağıtım öncesi temizlik (8 Kasım 2026): kullanılmayan `webNavigation` ve
    `unlimitedStorage` kaldırıldı; `tabs` yerine stüdyo sekmeleri izinsiz
    `runtime.getContexts` ile izleniyor.
- Güvenlik sınırları (8 Kasım 2026, `test/guvenlik.mjs`):
  - `web_accessible_resources` yalnızca `axe.min.js` — siteler `viewer.html`'i
    gömemez (gömülünce kendi sekmesine CSP/XFO kaldırma kuralı aldırabiliyordu)
  - Service worker: `fetch` dışındaki komutlar yalnızca ana çerçevedeki stüdyo
    sayfasından; `fetch`/`openTab` yalnızca http(s); ekran görüntüsü yalnızca
    stüdyo sekmesi öndeyken
  - Stüdyo mesaj kanalı: jeton `window.name`'de olduğundan site tarafından
    okunabilir — mesaj ayrıca `e.source` ile iddia ettiği karenin penceresinden
    gelmeli; panoya yalnızca renk kodu yazılır
  - **Content script'ler yalnızca stüdyonun doğrudan çocuğu olan çerçevede
    başlar** (`insideViewer`, `location.ancestorOrigins`). Yük (hash/window.name)
    taklit edilebildiği için, stüdyo açıkken NORMAL sekmedeki bir site kendi
    iframe'ine sahte yük koyup köprüyü çalıştırabiliyor ve `@import` zinciri
    üzerinden başka adreslerin içeriğini **çerezleriyle birlikte** okuyabiliyordu
    (ölçülerek doğrulandı, test E)
  - SW `fetch`: yalnızca stüdyo sekmesinden; `credentials: 'omit'`; metin
    isteklerinde içerik türü denetimi (`css` → text/css, `manifest` → json);
    önizlenen site yerel ağda değilse yerel ağ adresleri ve yönlendirmeleri reddedilir
  - Özel HTTP başlıkları `requestDomains` ile önizlenen sitenin alan adıyla
    sınırlı — Authorization üçüncü taraflara gitmez; kural panel açılmadan her
    oturumda `App.tsx`'ten kurulur
  - DNR kurallarında `main_frame` yok (stüdyonun ana çerçevesi eklenti sayfası)
- `host_permissions: ["<all_urls>"]` — oturum korunması için zorunlu (§2.2)
- Arayüz dili: **Türkçe**
- Sıfır telemetri, sıfır harici istek, tüm veri `chrome.storage.local`
- `axe-core` yerel olarak paketlenir (580 KB) ama **yalnızca kullanıcı denetimi başlattığında**
  dinamik `import()` ile yüklenir — sayfa gezinmesine hiçbir maliyeti yoktur
