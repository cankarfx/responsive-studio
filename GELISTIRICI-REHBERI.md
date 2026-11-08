# Responsive Studio — Geliştirici Rehberi

> Bu dosya, eklentiyi **değiştirmek** için gereken her şeyi tek yerde tutar: mimari, veri akışı,
> her dosyanın görevi, mesaj protokolü, durum şeması, testler ve tuzaklar.
>
> - Kullanıcıya dönük anlatım: [README.md](./README.md)
> - Neyin neden yapıldığı, ölçüm notları ve iptal edilen fikirler: [YOL-HARITASI.md](./YOL-HARITASI.md)
>
> **Değişiklik yapmadan önce YOL-HARITASI.md §2'yi okuyun.** Orada Chrome'un hangi yeteneğinin
> neden kullanılamadığı ölçümle yazılı; aynı çıkmaz sokaklara tekrar girmeyin.

---

## 1. Bir bakışta

| | |
|---|---|
| Ne yapar | Açık siteyi onlarca cihaz boyutunda aynı anda, canlı ve etkileşimli gösterir |
| Platform | Chrome MV3 eklentisi, minimum Chrome 120 |
| Dil / araçlar | TypeScript, Preact, Vite + esbuild |
| Arayüz dili | Türkçe (i18n yok — metinler bileşenlerin içinde) |
| Kod | ~8.850 satır TS/TSX + 808 satır CSS |
| Paket boyutu | ~800 KB (580 KB'si axe-core, yalnızca denetimde yüklenir) |
| Dış bağımlılık | `preact`, `axe-core` (ikisi de yerel paketlenir) |
| Veri | %100 yerel, `chrome.storage.local`; telemetri ve harici istek yok |

---

## 2. Kurulum ve geliştirme

```bash
npm install
npm run build          # dist/ üretir — Chrome'a YÜKLENEN klasör burasıdır
npm run dev            # esbuild + vite izleme modu
npm run typecheck      # tsc --noEmit
npm test               # gerçek Chrome'da 16 test paketi (§9)
```

Chrome'a yükleme: `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** →
**`dist`** klasörünü seç (kök klasörü değil). Kod değişiminden sonra `npm run build` + o
sayfadaki yenile (↻) simgesi.

### Yapı hattı (build)

İki ayrı adım, çünkü MV3'ün parçaları farklı formatlar ister:

| Adım | Ne üretir | Format | Neden |
|---|---|---|---|
| `scripts/build-ext.mjs` (esbuild) | `service-worker.js` | ESM | manifest'te `"type": "module"` |
| aynı adım | `content-bridge.js`, `content-emulation.js` | **IIFE** | content script'ler modül olamaz |
| aynı adım | `public/*` kopyası + `axe.min.js` | — | statik dosyalar |
| `vite build` | `viewer.html` + `assets/viewer.{js,css}` | ESM | Preact arayüzü, JSX derlemesi |

`scripts/make-icons.mjs` ikonları bağımlılıksız üretir (saf Node ile PNG kodlayıcı); yalnızca
ikon tasarımı değişirse elle çalıştırılır.

---

## 3. Mimari

```
┌─ Araç çubuğu ikonu · Ctrl+Shift+Y · sağ tık menüsü ────────────────────┐
│                               ↓                                        │
│  background/service-worker.ts                                          │
│   • viewer sekmesini açar, açık viewer sekmelerini takip eder           │
│   • SADECE o sekmeye kısıtlı session DNR kuralları yazar                │
│   • viewer açıkken content script'leri kaydeder, kapanınca kaldırır     │
│   • cross-origin fetch, çerez ve ekran yakalama köprüsü                 │
└────────────────────────────────────────────────────────────────────────┘
                                ↓ chrome.runtime.sendMessage
┌─ viewer.html  (chrome-extension:// sekmesi, Preact) ───────────────────┐
│  Toolbar · SyncBar · ToolsBar · Sidebar · Canvas · Drawer · Tooltip     │
│  store.ts tek kaynak; bus.ts çerçevelerle konuşur                       │
└────────────────────────────────────────────────────────────────────────┘
                                ↓ postMessage (token'lı, doğrudan)
┌─ her <iframe> içinde iki dünya ────────────────────────────────────────┐
│  MAIN world  → content/emulation.ts                                     │
│     navigator/screen/matchMedia override, konsol yakalama, canlı JS      │
│  ISOLATED    → content/bridge.ts                                        │
│     senkron etkileşim, inspect.ts, media.ts, touch.ts, a11y.ts           │
└────────────────────────────────────────────────────────────────────────┘
```

### Neden ayrı sekme, neden iki dünya

- **Ayrı `chrome-extension://` sekmesi zorunlu.** Yalnızca top-level sayfa bir eklenti sayfası
  olduğunda Chrome alt çerçevelerde 3rd-party çerezleri engellemiyor ve host izniyle gömülü
  siteye kendi top-level storage partition'ını veriyor. Oturumun açık kalması buna bağlı
  (YOL-HARITASI §2.2).
- **MAIN world zorunlu** olan üç iş var: `navigator.*` override'ları (sayfa kodu çalışmadan
  önce), sayfanın `console` çağrılarını görmek, canlı JS çalıştırmak. ISOLATED world bunların
  hiçbirini yapamaz.
- **ISOLATED world zorunlu** olan: `chrome.runtime` erişimi (service worker'a mesaj).

### Çerçeveye yapılandırma nasıl ulaşır

`iframe.name` **kullanılamaz** — Chrome cross-origin gezinmede browsing-context adını
sıfırlıyor (ölçüldü). Yapılandırma **URL fragment'ında** taşınıyor:

```
https://site.com/#__rs={"token":…,"fid":…,"ua":…,"width":…}
```

Fragment sunucuya gönderilmez. `emulation.ts` `document_start`'ta okur, uygular, `window.name`'e
yedekler (köprü için) ve `history.replaceState` ile adresi **sayfanın kendi JS'i çalışmadan**
temizler. Sayfanın orijinal fragment'ı varsa geri konur. Ayrıntı: `lib/payload.ts`.

> Yalnızca fragment değişirse tarayıcı aynı-belge gezinmesi yapar ve sayfa **yenilenmez**.
> Bu yüzden yenileme gerektiğinde `<iframe>` elemanı tamamen yeniden oluşturulur.

---

## 4. Dosya dosya ne var

### `src/lib/` — paylaşılan

| Dosya | İçerik |
|---|---|
| `types.ts` | Tüm tip tanımları: `DeviceSpec`, `Frame`, `AppSettings`, `FramePayload`, mesaj birlikleri, tarama sonuç tipleri. **Protokol değişikliği buradan başlar.** |
| `ua.ts` | User-Agent ve Client Hints üretimi. Chrome sürümünü **çalışma anında** `navigator.userAgent`'tan okur — sabit sürüm gömülü değil, eklenti eskimiyor. |
| `payload.ts` | Fragment'a yazma/okuma/temizleme (§3). |

### `src/devices/catalog.ts`

191 cihaz + 11 hazır set. Her cihaz dikey (portrait) CSS pikseli. Masaüstü girdilerinde
`width`/`height` **tarayıcı viewport'u**, `screenW`/`screenH` **fiziksel ekran**
(YOL-HARITASI §2.13). Windows ölçeklemesi `dpr` ile temsil edilir (%125 → 1.25).

Açılış seti `set-populer` (11 ekran). **Bu seti değiştirirsen** `test/regresyon.mjs` ve
`test/varsayilan.mjs` içindeki kare sayısı / genişlik / dokunmatik sayısı beklentilerini
de güncelle — ikisi de tam sayı karşılaştırıyor.

### `src/background/service-worker.ts`

| Sorumluluk | Not |
|---|---|
| Viewer sekmesi açma ve takibi | `chrome.storage.session` içinde `viewerTabs`; canlılık `runtime.getContexts` ile (`tabs` izni yok) |
| Gönderen doğrulaması | `fromViewer(sender)`: yalnızca ana çerçevedeki stüdyo sayfası; içerik betiklerine yalnızca `fetch` açık (§8.1) |
| DNR kuralları | `RULE_HEADERS=1000` (X-Frame-Options/CSP sil), `RULE_UA=1001`, `RULE_HEADERS_CUSTOM=1002` |
| Content script kayıt/kaldırma | Yalnızca viewer açıkken; normal gezinmeye hiç dokunulmaz |
| Mesaj komutları | `registerViewer` `setHttpUserAgent` `setCustomHeaders` `cookiesFor` `cookieRemove` `cookieClearAll` `captureVisible` `fetch` `openTab` |

**Kritik:** DNR kuralları `condition.tabIds` ile **yalnızca stüdyo sekmesine** bağlı.
`tabIds` sadece *session-scoped* kurallarda destekleniyor. Bu kısıt kaldırılırsa kullanıcının
normal gezinme güvenliği bozulur.

### `src/content/` — çerçeve içi

| Dosya | Dünya | Görev |
|---|---|---|
| `emulation.ts` | MAIN | `navigator`/`screen`/`matchMedia`/`devicePixelRatio` override, dokunma köprüsü, **sayfa tarafı köprü** (konsol yakalama + canlı JS) |
| `bridge.ts` | ISOLATED | Mesaj yönlendirme, senkron kaydırma/tıklama/giriş/hover/gezinme, ölçüm raporu |
| `inspect.ts` | ISOLATED | Bindirme araçları (kontur, taşma, ızgara, denetçi, cetvel) + tüm `runScan` taramaları |
| `media.ts` | ISOLATED | Gerçek CSS medya emülasyonu, `:hover` nötrleme, görme simülasyonu, metin ölçeği, parmak imleci |
| `touch.ts` | ISOLATED | Sürükleyerek kaydırma, ivme, dokunuş/sürükleme ayrımı |
| `a11y.ts` | ISOLATED | Kontrast, başlık, landmark, alt metin, tab sırası, dokunma hedefi, axe-core, PWA |

### `src/viewer/` — arayüz

| Dosya | Görev |
|---|---|
| `store.ts` | Tek durum kaynağı + `actions` / `tools` eylemleri + `chrome.storage.local` kalıcılığı |
| `bus.ts` | Çerçevelerle postMessage; `TOKEN` oturuma özel, sahte mesajları eler |
| `capture.ts` | Ekran görüntüsü motoru: 2B dilimleme, kontakt föy, bağımlılıksız ZIP, EyeDropper |
| `record.ts` | `getDisplayMedia` + `MediaRecorder` → WebM |
| `App.tsx` | Kabuk: tema, kısayollar, durum → çerçeve yayınları |
| `components/FrameView.tsx` | Tek ekran: iframe'i **emirli** kurar (nitelik sırası kritik), bezel, bindirme, boyutlandırma |
| `components/Drawer.tsx` | 23 sekmeli alt panel |
| `components/ToolsBar.tsx` | Bindirme araçları + Rapor/Erişilebilirlik/Geliştirici menüleri + `Menu` bileşeni |
| `components/Tooltip.tsx` | Global ipucu — `title` niteliğini devralır, `aria-label`'a çevirir |

---

## 5. Mesaj protokolü

Üç kanal var. Hepsi `lib/types.ts`'te tiplenir.

### Viewer → çerçeve (`ToFrameMessage`)

`scroll` `click` `input` `hover` `key` `ping` `css` `js` `measure` `reload`
`tool` `scan` `highlight` `setHeight` `scrollTo` `filter` `media` `vision` `textScale` `storageOp`

### Çerçeve → viewer (`FromFrameMessage`)

`ready` `scroll` `click` `input` `hover` `key` `navigate` `metrics` `error`
`console` `scan` `inspect` `color` `overflowList`

Taşıma: `window.postMessage({ __rs: TOKEN, m })`. Köprü `e.origin`'i eklenti origin'iyle,
viewer ise `__rs` jetonunu **ve** `e.source`'un iddia edilen karenin penceresi olduğunu
doğrular (jeton site tarafından okunabilir, tek başına yetmez — §8.1). Service worker turu **yok** — kaydırma senkronu gecikmesiz.

### Viewer → service worker

`chrome.runtime.sendMessage`, komut listesi §4'te.

### Çerçeve içi dünyalar arası

ISOLATED → MAIN, aynı `window` üzerinden:
`{ __rsMedia: token, overrides }` (matchMedia yamasını güncelle) ve
`{ __rsExec: token, code }` (canlı JS çalıştır).

---

## 6. Durum şeması

```ts
AppState = {
  url, draftUrl, reloadKey, history, historyIndex,   // gezinme
  frames: Frame[], layout, zoom, gap,                // tuval
  sync, chromeOpts, settings, workspaces,            // ayarlar
  media, vision, textScale,                          // emülasyon
  tool, grid, drawer, scans, consoleLogs,            // araçlar
  inspected, overflowItems, capture, recording,
  panel, frameInfo, toast,
}
```

- `Frame`: `fid deviceId width height dpr landscape browser zoom hidden colorScheme forceH overlay`
  — `fid` örnek kimliği (aynı cihaz iki kez eklenebilir), `forceH` yalnızca ekran görüntüsü
  sırasında geçici.
- `AppSettings`: `theme proMode httpUserAgent autoReload customDevices deviceSets favorites
  defaultBrowser customHeaders injectCss injectJs startupSet loadStagger touchMode frameBusting`
- Kalıcılık: `chrome.storage.local` anahtarı **`rs_state_v1`**, 400 ms gecikmeli yazım.
  Şema kırılırsa anahtarı `rs_state_v2` yapın ve `hydrate()`'e geçiş kodu ekleyin.
- `hydrate()` kayıtlı ayarları `DEFAULT_SETTINGS` üzerine yayar; **yeni alan eklerken
  varsayılanı `DEFAULT_SETTINGS`'e koymak yeterli**, eski kayıtlar bozulmaz.

---

## 7. Sık yapılan değişiklikler

### Yeni cihaz eklemek
`src/devices/catalog.ts` → `DEVICES` dizisine `d(...)` satırı. Masaüstüyse `screen: [w, h]`
ve gerçek `dpr` verin, `note` ile gerçek ekran çözünürlüğünü yazın.

### Yeni bindirme aracı
1. `types.ts` → `InspectTool` birliğine ekle
2. `inspect.ts` → `setTool` switch'ine dal + `teardown` temizliği
3. `ToolsBar.tsx` → çip
4. Gerekirse `App.tsx` klavye kısayolu

Bindirmeler **kapalı Shadow DOM** içine çizilir (`ensureRoot`), sayfa DOM'u kirletilmez.

### Yeni tarama (rapor)
1. `types.ts` → `ScanKind` + `ScanResult` alanı (+ sonuç tipi)
2. `inspect.ts` → `runScan` switch'ine dal (ağır işler `a11y.ts`'e)
3. `store.ts` → `DrawerTab`
4. Yeni görünüm bileşeni + `Drawer.tsx` sekmesi + ilgili menüye giriş

Tarama sonuçları `app.scans[fid][kind]` altında saklanır; sayfa tüm ekranlarda aynı olduğu
için çoğu tarama **ilk hazır çerçevede** çalışır (`scan`), ekrana göre değişenler hepsinde
(`scanAll` — vitals, kontrast, dokunma hedefleri, parmak tanısı).

### Yeni ayar
`types.ts` `AppSettings` + `store.ts` `DEFAULT_SETTINGS` + `Sidebar.tsx` ayar satırı.
Çerçeveye ulaşması gerekiyorsa `FramePayload`'a ekleyip `FrameView`'daki `key` dizisine koyun
(yoksa değişince çerçeve yenilenmez).

---

## 8. Tuzaklar — bunlara dikkat

| Tuzak | Sonuç | Doğrusu |
|---|---|---|
| iframe'e `src`'yi DOM'a eklemeden atamak | Sayfa `innerWidth`'i **0** okur | `appendChild` → `void el.offsetWidth` → `src` |
| `iframe.name` ile yapılandırma taşımak | Cross-origin gezinmede silinir | URL fragment (`lib/payload.ts`) |
| Yalnızca `document.styleSheets` taramak | `adoptedStyleSheets` ve Shadow DOM kaçar | `media.ts` içindeki `tumSheetler()` |
| `<link>` için sadece `load` dinlemek | Önbellekten gelen CSS kaçırılır | Hemen dene + `load` + tekrarlı tarama |
| `applyMedia`'yı eşzamanlı çağırmak | Sayfa stilsiz kalabilir | `kuyruk` + `nesil` sayacı (zaten var) |
| ISOLATED world'den `<script>` enjekte etmek | MV3'te **çalışmaz** | MAIN world'e `postMessage` ile devret |
| `console.error`'ı eklenti kodundan sarmalamak | Sitenin hataları eklentiye atfedilir | Sayfa bağlamına enjekte et (`pageBridgeSource`) |
| Araç çubuğu menüsünü `position: absolute` yapmak | `.subbar` overflow'una kırpılır | `position: fixed`, koordinat JS'ten |
| Parmak modunda `mouse*` dinlemek | Bastırma yüzünden araçlar susar | `pointer*` kullan |
| `chrome.permissions.request`'i SW'den çağırmak | Kullanıcı hareketi yok, başarısız | Viewer sayfasından, `await` ÖNCESİNDE |
| `chrome.debugger`'ı isteğe bağlı izin sanmak | Chrome vermiyor | Pro Mod iptal edildi (YOL-HARITASI §2.4.1) |
| Tüm ekranları aynı anda yüklemek | Sunucuda `429` | Kademeli yükleme (`loadStagger`) |
| Content script'i yük (hash/`window.name`) var diye başlatmak | Normal sekmedeki site sahte yükle köprüyü çalıştırır | `insideViewer()` — `location.ancestorOrigins` taklit edilemez |
| SW'de `sender`'ı doğrulamadan komut çalıştırmak | Herhangi bir sitenin çerçevesi stüdyo komutlarını kullanır | `fromViewer(sender)`; içerik betiklerine yalnızca `fetch` |
| SW `fetch`'te çerez göndermek | Site, kullanıcının oturumuyla başka adresleri okur | `credentials: 'omit'` + yerel ağ engeli + içerik türü |
| Özel başlık kuralını alan adı sınırsız kurmak | `Authorization` üçüncü taraf CDN'lere gider | `requestDomains: [host]` |
| `postMessage(..., '*')` ile üst pencereye yazmak | İç içe gömülü çerçeveler dinler | Hedef = `location.ancestorOrigins[0]` |
| `pagehide`'da koşulsuz kaydetmek | Testin `storage.clear`'ından sonra eski durum geri yazılır | `dirty` bayrağı — yalnızca değişiklik varsa |
| `pkill -f "test/.profil"` | Kendi kabuğunu öldürür (exit 144) | `pkill -f "test/[s]erve.mjs"` deseni |

**`sandbox` uyarısı normaldir.** `allow-scripts` + `allow-same-origin` birlikte kullanıldığında
Chrome her zaman uyarır. Kaldırılırsa site stüdyo sekmesini kaçırıyor (ölçüldü),
`allow-same-origin` ise oturum için zorunlu. Kasıtlı bir takas.

### 8.1 Güvenlik modeli

Stüdyo açıkken content script'ler **tüm sekmelere** kayıtlıdır (alt çerçevelerde çalışabilmeleri
için başka yol yok). Bu yüzden her katman "bu kod gerçekten stüdyonun içinde mi?" sorusunu
kendisi sorar:

| Katman | Kontrol | Dosya |
|---|---|---|
| Content script başlangıcı | `insideViewer(EXT_ORIGIN)`: tam bir ata, o da eklenti origin'i | `lib/payload.ts`, `bridge.ts`, `emulation.ts` |
| Çerçeve → viewer | Jeton + `e.source === frames.get(fid).contentWindow` | `viewer/bus.ts` |
| Viewer → pano | Yalnızca `#rrggbb` biçimli renk kodu | `viewer/bus.ts` |
| MAIN ↔ ISOLATED | Jeton + `e.source === window` | `emulation.ts` |
| Service worker | `fromViewer(sender)`; `fetch` yalnızca stüdyo sekmesinin çerçevelerinden | `service-worker.ts` |
| SW `fetch` | `credentials:'omit'`, `cache:'no-store'`, http(s), özel ağ adresi (ve oraya yönlendirme) yalnızca önizlenen site de yereldeyse, `kind` → içerik türü denetimi | `service-worker.ts` |
| DNR kuralları | `tabIds` = stüdyo sekmeleri; `main_frame` yok; özel başlıklar `requestDomains` | `service-worker.ts` |
| WAR | Yalnızca `axe.min.js` — siteler `viewer.html`'i gömemez | `public/manifest.json` |
| Arayüzde dış veri | `helpUrl`/og görseli/simge yalnızca https/http/`data:image` | `A11yViews.tsx`, `Social.tsx` |

**Bilinçli olarak açık bırakılanlar:** `axe.min.js` WAR'da olduğu için siteler eklentinin
kurulu olduğunu anlayabilir (parmak izi); jeton önizlenen sayfa tarafından okunabilir (e.source
kontrolüyle zararsız); özel cihaz penceresinde odak tuzağı yok.

**Kural:** yeni bir SW komutu veya köprü özelliği eklerken `test/guvenlik.mjs`'e saldırı
senaryosu ekle ve önce eski kodda başarısız olduğunu gör.

---

## 9. Testler

Testler **gerçek Chrome'da**, Chrome DevTools Protocol üzerinden çalışır — jsdom yok, gerçek
iframe'ler, gerçek cross-origin yükleme, gerçek fare olayları.

```bash
npm test                     # 16 paketin tamamı
node test/calistir.mjs faz3  # yalnızca seçilenler
npm run test:kur             # Chrome + sunucuları açık bırak (elle inceleme)
```

| Paket | Neyi korur |
|---|---|
| `regresyon` | Header bypass, cihaz emülasyonu, viewport≠ekran, senkron |
| `varsayilan` | Açılış seti, Windows ölçekleme DPR'ı |
| `faz2` / `faz2c` | Konsol, kırılım noktaları, taşma, bağlantı/görsel denetimi, bindirme, vitals |
| `faz3` / `faz3b` / `faz3c` | Medya emülasyonu, görme simülasyonu, a11y denetimleri, sosyal önizleme, araç çubuğu |
| `faz4` | Cetvel, canlı kod, CSS değişkenleri, depolama, HTTP başlıkları |
| `parmak` / `modern` / `kaydirma` | Parmak modunun dört katmanı |
| `atif` | Sitenin hataları eklentiye atfedilmemeli |
| `sirala` | Ekranları başlıktan sürükleyerek yeniden sıralama |
| `ui` | Menü kırpılması, ipucu, araç çubuğu taşması |
| `kayit` | WebM ekran kaydı |
| `guvenlik` | A: WAR kapalı · B: SW komut yetkisi · C: sahte mesaj/pano/iç içe çerçeve · D: kural temizliği · E: normal sekmeden sızdırma girişimi (8897'de kötü sunucu) · F: başlık kapsamı · G: başlıklar yeni oturumda · H: yüklenemeyen ekran uyarısı · I: tek ekran gezinmesinde emülasyon |

### Altyapı

| Dosya | Görev |
|---|---|
| `test/cdp.mjs` | Bağımlılıksız CDP istemcisi (Node'un yerleşik `WebSocket`'i) |
| `test/reload.mjs` | Eklentiyi `Extensions.loadUnpacked` ile yükler/yeniler |
| `test/serve.mjs` | Test sitesi (8899) — `X-Frame-Options: DENY` + CSP gönderir, başlıkları yankılar |
| `test/cdn-serve.mjs` | Ayrı origin (8898) — gerçek cross-origin CSS için |
| `test/fixtures/site/` | Test sayfaları: `index.html` (genel), `spa.html` (cross-origin + JS hover), `modern.html` (adoptedStyleSheets + Shadow DOM), `kaydir.html` (kaydırma), `bust.html` (frame-busting) |

**Eklenti kimliği `dist/` klasörünün mutlak yolundan türetilir.** Paketlenmemiş eklentilerde
Chrome, kimliği `sha256(mutlak_yol)` hex'inin ilk 32 karakterini `0→a … f→p` eşlemesiyle
harfe çevirerek üretir. Testlerde bu kimlik sabit yazılı (`EXT`). **Projeyi başka bir klasöre
taşırsanız kimlik değişir ve testler çalışmaz** — yeni kimliği şöyle hesaplayıp test
dosyalarındaki `EXT` sabitini güncelleyin:

```bash
node -e "const {createHash}=require('crypto');
const h=createHash('sha256').update(process.cwd()+'/dist','utf8').digest('hex').slice(0,32);
console.log([...h].map(c=>String.fromCharCode(97+parseInt(c,16))).join(''))"
```

**Chrome 137+ `--load-extension` bayrağını yok sayıyor.** Eklenti CDP'nin
`Extensions.loadUnpacked` komutuyla yükleniyor; bunun için Chrome
`--enable-unsafe-extension-debugging` ile başlatılmalı. Kayıt testi ayrıca
`--auto-accept-this-tab-capture` ister. Hepsi `test/calistir.mjs` içinde.

### Test yazarken

- **Koordinatla nişan almak kırılgan.** `Input.dispatchMouseEvent` her zaman üst pencereye
  gider; çerçeve içindeki bir elemana tıklamak için elemanın rect'ini çerçeveden okuyup
  frame-box başlangıcıyla toplayın (`test/kaydirma.mjs` içindeki `elemanKoordu`).
- Görünür alanın altındaki ekranlar fare olaylarını almaz — önce `scrollIntoView`.
- Depolama temizlemeden önce `chrome.storage`'ın hazır olmasını bekleyin (yarış var).
- Sistem teması testi etkiler: koyu mod testini **açık** moda zorlayarak yapın, tersi anlamsız.
- Testler aynı tarayıcıyı paylaşır; paralel çalıştırmayın (koşucu sıralı çalıştırır).
- **Yükleme için sabit `sleep` kullanmayın.** Açılış seti 11 kare ve aralıklı yükleniyor;
  sabit süreler set büyüdükçe kırılıyor. `cdp.mjs` → `karelerHazirTab(tab)` tüm kareler
  `data-ready="1"` olana kadar bekler (`FrameView.tsx` bu niteliği `ready` mesajına göre yazar).
- **`data-ready` = DOMContentLoaded, ≠ “sayfa tamamen oturdu”.** Geç enjekte edilen stili
  (fixture'lar 800 ms sonra ekliyor) veya parmak modunun yeniden taramalarını
  (`media.ts` 150/500/1200/2500/**5000** ms) bekleyen testler kapının üstüne ayrıca
  `sleep(6000)` koyar — `parmak.mjs` ve `modern.mjs` böyle.
- **CDP `Runtime.evaluate` sonucunu körlemesine okumayın.** Kare henüz o elemanı üretmediyse
  `result.value` `undefined` gelir ve hata `x.w is undefined` diye çok sonra patlar;
  `exceptionDetails`'i yazdırın (`parmak.mjs` → `okuHepsi`).

---

## 10. Bilinen sınırlar

Ayrıntılı ölçümler YOL-HARITASI.md §2'de. Özet:

| Konu | Durum |
|---|---|
| Genişlik tabanlı media query'ler | ✅ Gerçek — iframe fiilen o genişlikte |
| `prefers-*`, `pointer`, `hover` CSS'i | ✅ Stylesheet yeniden yazımıyla gerçek |
| Frame başına UA, DPR, `screen.*`, dokunma | ✅ JS düzeyinde |
| Frame başına gerçek HTTP `User-Agent` başlığı | ⛔ Chrome alt çerçevede desteklemiyor; sekme geneli tek UA mümkün |
| `env(safe-area-inset-*)` | ⛔ Değiştirilemiyor; çentik yalnızca görsel çizilir |
| Gerçek Safari/Firefox motoru | ⛔ Hiçbir Chrome eklentisi yapamaz |
| Kapalı Shadow DOM | ⛔ Erişilemez (dil sınırı) |
| Tam sayfa görüntü hızı | ⚠️ Chrome saniyede ~2 yakalama ile sınırlı |

---

## 11. Sırada ne olabilir

Yol haritasındaki 70 maddenin tamamı tamamlandı. Yapılmamış, denenmeye değer fikirler:

- **Frame başına gerçek HTTP UA** — `Fetch.requestPaused` olayı `frameId` taşıyor; CDP ile
  denenebilir ama `debugger` izni sorunu geri gelir (YOL-HARITASI §2.4.1)
- **Ağ/CPU kısıtlama** — aynı izin sorunu
- **Gerçek cihaz bulutu entegrasyonu** — gerçek Safari/Firefox için tek yol
- **Çalışma alanı paylaşımı** — JSON dışa aktarma zaten var, bağlantıyla paylaşım eklenebilir

---

## 12. Dağıtım ve sürüm yayınlama

Eklenti Chrome Web Store'da **değil**; herkese açık GitHub reposundan dağıtılır:
https://github.com/cankarfx/responsive-studio — kullanıcılar Releases'tan ZIP indirip
"Paketlenmemiş öğe yükle" ile kurar (README'de adım adım).

```bash
# 1) public/manifest.json ve package.json → version (aynı olmalı)
npm run paket        # temiz build + release/responsive-studio-vX.Y.Z.zip
npm test
git add -A && git commit -m "vX.Y.Z: ..." && git push
gh release create vX.Y.Z release/responsive-studio-vX.Y.Z.zip --title "vX.Y.Z" --notes "..."
```

- `scripts/paketle.mjs` sürümler uyuşmazsa durur; ZIP'in içinde tek bir `responsive-studio/`
  klasörü olur (kullanıcı doğrudan onu seçer).
- `scripts/build-ext.mjs` üçüncü taraf lisanslarını (`axe-core`, `preact`) `dist/licenses/`'a kopyalar.
- `release/`, `dist/`, `test/.profil/` git'e girmez (`.gitignore`).
- Repoda özel güvenlik bildirimi açık (Security → Report a vulnerability).
