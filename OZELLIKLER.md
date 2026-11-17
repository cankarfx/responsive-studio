# Responsive Studio — Özellikler

Ücretsiz, açık kaynak (MIT) Chrome eklentisi. İndirme: https://github.com/cankarfx/responsive-studio/releases/latest

## Açılış ve temel kullanım

| Özellik | Açıklama |
|---|---|
| Tek tıkla açılış | Araç çubuğu ikonu, Ctrl+Shift+Y (Mac: ⌘+Shift+Y) ya da sağ tık → "Bu sayfayı Responsive Studio'da aç" |
| Adres çubuğu | Stüdyo içinden istediğiniz adrese gidin (Ctrl+L) |
| Geri / İleri / Yenile | Tüm ekranlarda aynı anda gezinme ve yenileme (Ctrl+R) |
| Otomatik yenileme | Sayfayı belirli aralıklarla kendiliğinden yeniler |
| Giriş yapılmış siteler | Oturumunuz açık kalır; üye paneli, yönetim ekranı gibi sayfalar da test edilir |
| iframe engellerini aşma | Kendini çerçeve içinde göstermeyi reddeden siteler de açılır |
| Yerel geliştirme | `localhost`, yerel IP ve `file://` adresleri desteklenir |
| Yüklenemeyen ekran uyarısı | Açılamayan ekran için nedenini anlatan uyarı bandı çıkar |
| İpuçları | Her düğmenin üzerine gelince ne işe yaradığı yazar |

## Cihazlar ve ekranlar

| Özellik | Açıklama |
|---|---|
| 191 cihaz | iPhone, Galaxy, Pixel, Xiaomi, iPad, katlanabilirler, MacBook, Surface, 4K ve ultra geniş monitör, Apple Watch, TV, Steam Deck |
| Varsayılan 11 ekran | Telefon, tablet, Windows dizüstü/masaüstü ve MacBook'tan oluşan "Popüler" set |
| Gerçekçi Windows ölçüleri | %125 ölçeklemeli ekranlar gerçek tarayıcı alanı ve piksel oranıyla gelir |
| Hazır setler | Popüler, Windows, Mobil, Tablet, Masaüstü, Tailwind, Bootstrap, Material, Apple, Katlanabilir, Uç durumlar |
| Kendi setleriniz | Açık ekranları set olarak kaydedip tek tıkla geri yükleyin |
| Açılış seti seçimi | Stüdyo açılınca hangi setin geleceğini Ayarlar'dan seçin |
| Cihaz arama | Ada, markaya ya da ölçüye göre arayın; Enter ilk sonucu ekler |
| Ölçüyle ekran ekleme | Arama kutusuna `500x700` yazıp Enter'a basın, o boyutta ekran eklenir |
| Özel cihaz | Kendi genişlik, yükseklik, piksel oranı ve dokunmatik ayarınızla cihaz oluşturun |
| Sık kullanılanlar | En çok kullandığınız cihazları yıldızlayıp üstte tutun |
| Tarayıcı profilleri | Chrome, Edge, Firefox, Safari, Opera, Samsung Internet, WebView kimliğiyle açın |
| Cihaz çerçevesi | Telefon kasası, çentik, Dynamic Island ve ana ekran çubuğu göstergesi |
| Çevirme | Ekranı tek tek ya da hepsini birden dikey/yatay çevirin (R) |
| Serbest boyutlandırma | Ekran kenarından sürükleyerek boyutu değiştirin, ölçü canlı görünür |
| Sürükleyerek sıralama | Ekranı başlığından tutup istediğiniz yere taşıyın, sıra kaydedilir |
| Ekran gizleme / kaldırma | Bir ekranı geçici gizleyin ya da tamamen çıkarın |
| Yatay taşma uyarısı | Sayfa yana taşıyorsa ekranın başlığında işaret çıkar |

## Yerleşim ve görünüm

| Özellik | Açıklama |
|---|---|
| Yerleşim seçenekleri | Izgara, tek sıra, tek sütun ya da ortalanmış |
| Aralık ayarı | Ekranlar arasındaki boşluğu ayarlayın |
| Ölçekleme | Otomatik sığdırma (Ctrl+0), elle yakınlaştırma (Ctrl + / −) ya da ekran başına ölçek |
| Yan panel | Cihaz kütüphanesi, setler ve ayarlar; Ctrl+B ile açılıp kapanır |
| Arayüz teması | Koyu ya da açık stüdyo görünümü |

## Senkron etkileşim

| Özellik | Açıklama |
|---|---|
| Kaydırma senkronu | Bir ekranda kaydırın, hepsi aynı oranda ya da aynı piksel kadar kaysın |
| Tıklama senkronu | Menü açma, düğmeye basma tüm ekranlarda tekrarlanır |
| Form ve klavye senkronu | Formu bir kez doldurun, tüm ekranlara yazılsın |
| Hover senkronu | Fareyle üzerine geldiğiniz eleman tüm ekranlarda vurgulanır |
| Gezinme senkronu | Bir bağlantıya tıklayınca tüm ekranlar yeni sayfaya geçer |
| Senkronu ayrı ayrı kapatma | Kaydırma, tıklama, yazma, hover ve gezinme tek tek açılıp kapatılabilir |
| Tek ekran modu | "Yalnızca bu ekranda çalış" ile senkron geçici durur; Esc ile çıkılır |

## Parmak modu (gerçekçi dokunmatik davranış)

| Özellik | Açıklama |
|---|---|
| Dokunmatik algılama | Site kendini gerçekten dokunmatik ekranda sanır (CSS ve JavaScript tutarlı) |
| Hover yok | Mobil ekranlarda `:hover` stilleri ve fareyle tetiklenen efektler çalışmaz, tıpkı telefondaki gibi |
| Dokunma olayları | Dokunma olayları üretilir, çoklu dokunma desteği bildirilir |
| Parmakla kaydırma | Basılı tutup sürükleyince sayfa kayar, bırakınca ivmeyle devam eder |
| Görsel üzerinde kaydırma | Görsel ya da bağlantı üzerinden başlasanız da nesne tutulmaz, sayfa kayar |
| Parmak imleci | Hangi ekranın dokunmatik olduğu imleçten anlaşılır |
| Tek tıkla kapatma | Hover durumlarını incelemek için modu kapatabilirsiniz |
| Parmak modu tanısı | Bir sitede beklenmedik davranış olursa her ekranın ayrıntılı dökümü |

## İnceleme araçları (bindirmeler)

| Özellik | Açıklama |
|---|---|
| Kontur | Tüm elemanların sınırlarını türüne göre renkli çizer (O) |
| Taşma bulucu | Yatay kaydırmaya sebep olan elemanları kırmızıyla işaretler ve kaç piksel taştığını listeler (T) |
| Izgara | Kolon ızgarası, taban çizgisi ya da kare ızgara bindirir (G) |
| Denetçi | Tıkladığınız eleman tüm ekranlarda vurgulanır; ölçü, kutu modeli ve stiller panelde (I) |
| Cetvel | Artı kılavuzlar, eleman ölçüsü ve sürükleyerek piksel mesafesi (M) |
| Tasarım bindirmesi | Figma/Photoshop PNG'sini ekranın üzerine koyun, opaklık ve fark moduyla karşılaştırın, ok tuşlarıyla hizalayın |
| Damlalık | Ekrandan renk seçin, kodu panoya kopyalanır |

## Raporlar

| Özellik | Açıklama |
|---|---|
| Kırılım noktaları | Sitenin CSS'indeki tüm medya sorgularını çıkarır; tek tıkla o genişlikte ekran ekler |
| Bağlantı denetimi | Sayfadaki tüm bağlantıları kontrol eder, kırık (404) olanları işaretler |
| Görsel denetimi | Kırık görselleri ve gereğinden büyük indirilen görselleri bulur |
| Font listesi | Kullanılan yazı tipi aileleri, ağırlıkları ve önizlemeleri |
| Web Vitals | LCP, CLS, INP, FCP, TTFB değerleri her ekran için ayrı ve renkli |
| Meta etiketleri | Title, description, canonical, robots, Open Graph, Twitter kartı, hreflang, başlık yapısı |
| Konsol | Tüm ekranlardaki hata ve uyarılar tek listede, tekrarlar sayılı |

## Kullanıcı tercihleri ve görme

| Özellik | Açıklama |
|---|---|
| Koyu mod | Sitenin koyu tasarımını tüm ekranlarda görün; bilgisayar ayarına dokunmaz, ekranlar yeniden yüklenmez |
| Azaltılmış hareket | Animasyonların gerçekten kapandığını doğrulayın |
| Yüksek kontrast / zorunlu renkler | Bu tercihlerde sitenin nasıl göründüğünü test edin |
| Renk körlüğü simülasyonu | Protanopi, döteranopi, tritanopi, protanomali, döteranomali, akromatopsi |
| Görsel filtreler | Gri ton, bulanık (göz kısma testi), yüksek kontrast, ters renk |
| Metin ölçekleme | Yazı boyutunu %125–%200 büyütüp düzenin bozulup bozulmadığına bakın |

## Erişilebilirlik ve kalite denetimleri

| Özellik | Açıklama |
|---|---|
| Tam erişilebilirlik denetimi | WCAG 2.0 / 2.1 / 2.2 AA kurallarına göre otomatik tarama (axe-core), ihlaller önem sırasıyla |
| Renk kontrastı | Okunması zor metinleri gerçek arka plana göre hesaplayıp listeler |
| Başlık yapısı | H1–H6 hiyerarşisi, atlanan seviyeler, birden fazla H1 uyarısı |
| Landmark / ARIA | Ekran okuyucu gezinme bölgelerini ve eksiklerini gösterir |
| Alt metin denetimi | Eksik, anlamsız ya da çok uzun görsel açıklamaları |
| Tab sırası | Klavyeyle gezinme sırası ve hatalı odak ayarları |
| Dokunma hedefleri | 44×44 pikselden küçük, parmakla basılması zor düğmeler |
| Sosyal önizleme | Google, X, Facebook, LinkedIn, WhatsApp, Slack, Discord, Telegram, iMessage kart görünümleri |
| PWA ve favicon | Manifest, uygulama ikonları, tema rengi, service worker ve HTTPS kontrolü |

## Ekran görüntüsü ve kayıt

| Özellik | Açıklama |
|---|---|
| Tam sayfa ekran görüntüsü | Tek ekranın baştan sona görüntüsü, gerçek boyutta |
| Tüm ekranlar → ZIP | Her cihazın görüntüsü ayrı dosya olarak tek ZIP'te |
| Kontakt föy | Tüm cihazlar tek, etiketli bir görselde; müşteri sunumu için |
| Panoya kopyalama | Görüntüyü doğrudan yapıştırılabilir şekilde kopyalar |
| Ekran kaydı | Stüdyodaki çalışmanızı WebM video olarak kaydeder, ek izin gerekmez |

## Geliştirici araçları

| Özellik | Açıklama |
|---|---|
| Canlı CSS | Yazdığınız CSS tüm ekranlara anında uygulanır, sayfa yenilense de kalır |
| Canlı JS | Yazdığınız JavaScript'i tüm ekranlarda bir kez çalıştırır |
| CSS değişkenleri | Sitenin tasarım değişkenlerini değerleri ve renk önizlemeleriyle listeler |
| Depolama | localStorage ve sessionStorage içeriğini görün, silin (tüm ekranlarda) |
| Çerezler | Çerezleri görün ve silin; izin yalnızca siz onaylarsanız istenir |
| Özel HTTP başlıkları | İsteklere Authorization, API anahtarı gibi başlıklar ekleyin; yalnızca test edilen siteye gider |
| Basic auth yardımcısı | Kullanıcı adı ve paroladan doğru başlığı üretir |

## Kayıt, ayarlar ve gizlilik

| Özellik | Açıklama |
|---|---|
| Çalışma alanları | Adres, cihazlar, yerleşim ve ayarları bir proje adıyla kaydedip geri yükleyin |
| Dışa / içe aktarma | Tüm ayar ve setleri JSON dosyası olarak yedekleyin ya da başka bilgisayara taşıyın |
| Oturum kalıcılığı | Stüdyo kapanıp açılınca kaldığınız yerden devam eder |
| Sekmeler arası ayar senkronu | Bir sekmede değiştirdiğiniz ayar diğer stüdyo sekmelerine de geçer |
| Birden fazla stüdyo sekmesi | Her sekme kendi ekran düzenini korur; biri diğerinin düzenini ezmez |
| Yükleme aralığı | Çok ekran sunucuyu yorarsa ekranların sırayla yüklenme aralığını artırın |
| Temizle | Tüm kayıtlı veriyi iki adımlı onayla sıfırlar |
| Klavye kısayolları | Adres, yenileme, panel, ölçek, çevirme ve tüm bindirmeler için kısayollar |
| Sıfır veri toplama | Hiçbir veri dışarı gönderilmez; her şey yalnızca sizin bilgisayarınızda saklanır |
| Türkçe arayüz | Tüm menüler, ipuçları ve raporlar Türkçe |
| Açık kaynak | MIT lisanslı; kodu inceleyebilir, değiştirebilir ve geliştirebilirsiniz |
