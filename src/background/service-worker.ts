/**
 * SERVICE WORKER (MV3)
 *
 * Sorumluluklar:
 *  1. Araç çubuğu / kısayol / sağ tık ile viewer sekmesini açmak
 *  2. SADECE viewer sekmesine kısıtlı session DNR kuralları ile iframe
 *     engellerini (X-Frame-Options, CSP frame-ancestors) kaldırmak
 *  3. Viewer açıkken content script'leri kaydetmek, kapanınca kaldırmak
 */

const VIEWER_PATH = 'viewer.html'
const RULE_HEADERS = 1000 // header temizleme kuralı kimliği
const RULE_UA = 1001 // HTTP User-Agent override kuralı kimliği
const RULE_HEADERS_CUSTOM = 1002 // kullanıcının özel istek başlıkları
const SCRIPT_IDS = ['rs-emulation', 'rs-bridge']

/* ─── Viewer sekmelerinin takibi ─────────────────────────────────── */

async function getViewerTabs(): Promise<number[]> {
  const { viewerTabs } = await chrome.storage.session.get('viewerTabs')
  return Array.isArray(viewerTabs) ? viewerTabs : []
}

async function setViewerTabs(ids: number[]) {
  await chrome.storage.session.set({ viewerTabs: [...new Set(ids)] })
}

/**
 * Şu anda stüdyo sayfasını ANA ÇERÇEVEDE gösteren sekmeler.
 *
 * `runtime.getContexts` eklentinin kendi sayfalarını izin gerektirmeden
 * listeler; böylece `tabs` iznine (kurulumda "tarama geçmişinizi okuma"
 * uyarısı) gerek kalmaz.
 */
async function liveViewerTabIds(): Promise<Set<number>> {
  const viewerUrl = chrome.runtime.getURL(VIEWER_PATH)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['TAB' as chrome.runtime.ContextType],
  })
  return new Set(
    contexts
      .filter((c) => c.frameId === 0 && c.tabId >= 0 && c.documentUrl?.startsWith(viewerUrl))
      .map((c) => c.tabId),
  )
}

/** Kayıtlı sekmeler gerçekten hâlâ stüdyo sayfasında mı diye doğrular. */
async function syncViewerTabs(): Promise<number[]> {
  const ids = await getViewerTabs()
  const live = await liveViewerTabIds()
  const alive = ids.filter((id) => live.has(id))
  if (alive.length !== ids.length) await setViewerTabs(alive)
  return alive
}

/* ─── Gönderen doğrulaması ───────────────────────────────────────── */

/** Mesaj, bir sekmenin ana çerçevesinde açık olan stüdyo sayfasından mı geliyor? */
function fromViewer(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id
    && sender.frameId === 0
    && sender.tab?.id != null
    && !!sender.url?.startsWith(chrome.runtime.getURL(VIEWER_PATH))
}

/**
 * Yerel ağ / loopback adresi mi? (localhost, 127/8, 10/8, 172.16/12,
 * 192.168/16, 169.254/16, 100.64/10, IPv6 ::1, fc00::/7, fe80::/10, .local)
 */
function isPrivateUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  let h: string
  try { h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '') } catch { return false }
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '::1' || h === '0.0.0.0') return true
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h)
  if (m) {
    const a = +m[1], b = +m[2]
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
  }
  return h.includes(':') && /^(f[cd]|fe[89ab])/.test(h)
}

/** Yalnızca web adresleri (http/https) — `fetch` ve sekme açma için. */
function isWebUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

/* ─── DNR: iframe engellerini yalnızca viewer sekmesinde kaldır ──── */

async function refreshRules() {
  const tabs = await syncViewerTabs()
  const removeIds = [RULE_HEADERS]
  const addRules: chrome.declarativeNetRequest.Rule[] = []

  if (tabs.length) {
    addRules.push({
      id: RULE_HEADERS,
      priority: 1,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'frame-options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'content-security-policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'content-security-policy-report-only', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'cross-origin-embedder-policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'cross-origin-resource-policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
        ],
      },
      condition: {
        // KRİTİK: yalnızca viewer sekmesi. Kullanıcının normal gezinme
        // güvenliği hiçbir şekilde etkilenmez.
        tabIds: tabs,
        resourceTypes: [
          /* Yalnızca alt çerçeve: stüdyonun ana çerçevesi eklenti sayfası.
             main_frame olsaydı sekme başka siteye gittiğinde o sayfa da
             kuralın temizlenmesinden önce korumasız yüklenirdi. */
          'sub_frame' as chrome.declarativeNetRequest.ResourceType,
        ],
      },
    })
  }

  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: removeIds, addRules })
}

/** Sekme geneli HTTP User-Agent + Client Hints override'ı. */
async function setHttpUserAgent(ua: string | null, ch: Record<string, string> | null) {
  const tabs = await syncViewerTabs()
  const addRules: chrome.declarativeNetRequest.Rule[] = []

  if (ua && tabs.length) {
    const headers: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
      { header: 'user-agent', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: ua },
    ]
    for (const [k, v] of Object.entries(ch ?? {})) {
      headers.push({ header: k, operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: v })
    }
    addRules.push({
      id: RULE_UA,
      priority: 2,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: headers,
      },
      condition: {
        tabIds: tabs,
        resourceTypes: Object.values({
          sub: 'sub_frame', xhr: 'xmlhttprequest', script: 'script',
          img: 'image', css: 'stylesheet', font: 'font', media: 'media', other: 'other',
        }) as chrome.declarativeNetRequest.ResourceType[],
      },
    })
  }

  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_UA], addRules })
}

/**
 * Kullanıcının tanımladığı özel HTTP istek başlıkları.
 *
 * Yalnızca stüdyo sekmesinde geçerlidir (`tabIds`), yani `Authorization` gibi
 * hassas başlıklar normal gezinmeye sızmaz. Basic auth, feature flag ve
 * önizleme ortamı jetonları için kullanılır.
 */
async function setCustomHeaders(headers: { name: string; value: string }[], host: string) {
  const tabs = await syncViewerTabs()
  const clean = headers.filter((h) => h.name.trim() && h.value.trim())
  const addRules: chrome.declarativeNetRequest.Rule[] = []

  if (clean.length && tabs.length && host) {
    addRules.push({
      id: RULE_HEADERS_CUSTOM,
      priority: 3,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: clean.map((h) => ({
          header: h.name.trim().toLowerCase(),
          operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
          value: h.value,
        })),
      },
      condition: {
        tabIds: tabs,
        /* Yalnızca önizlenen sitenin alan adı (ve alt alan adları) — reklam,
           analitik ve CDN gibi üçüncü taraflara Authorization sızmasın. */
        requestDomains: [host],
        resourceTypes: [
          'sub_frame', 'xmlhttprequest', 'script', 'image',
          'stylesheet', 'font', 'media', 'other',
        ] as chrome.declarativeNetRequest.ResourceType[],
      },
    })
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_HEADERS_CUSTOM], addRules,
  })
  return clean.length
}

/* ─── Content script kaydı (yalnızca viewer açıkken) ─────────────── */

async function registerScripts() {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS })
  if (existing.length === SCRIPT_IDS.length) return
  const ids = existing.map((s) => s.id)
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids })

  await chrome.scripting.registerContentScripts([
    {
      id: 'rs-emulation',
      js: ['content-emulation.js'],
      matches: ['<all_urls>'],
      allFrames: true,
      matchOriginAsFallback: true,
      runAt: 'document_start',
      world: 'MAIN',
      persistAcrossSessions: false,
    },
    {
      id: 'rs-bridge',
      js: ['content-bridge.js'],
      matches: ['<all_urls>'],
      allFrames: true,
      matchOriginAsFallback: true,
      runAt: 'document_start',
      world: 'ISOLATED',
      persistAcrossSessions: false,
    },
  ])
}

async function unregisterScripts() {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS })
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) })
  }
}

/** Viewer sekmesi sayısına göre kuralları ve script'leri eşitler. */
async function reconcile() {
  const tabs = await syncViewerTabs()
  await refreshRules()
  if (tabs.length) await registerScripts()
  else {
    await unregisterScripts()
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_HEADERS, RULE_UA, RULE_HEADERS_CUSTOM],
    })
  }
}

/* ─── Viewer açma ────────────────────────────────────────────────── */

function isOpenable(url: string | undefined): url is string {
  return !!url && /^(https?|file):/i.test(url)
}

async function openViewer(rawUrl?: string, openerTabId?: number) {
  const url = isOpenable(rawUrl) ? rawUrl : 'https://example.com'
  const viewerUrl = `${chrome.runtime.getURL(VIEWER_PATH)}?url=${encodeURIComponent(url)}`
  /* Sekme kaydı, sayfa yüklenince stüdyonun kendi `registerViewer`
     mesajıyla yapılır — o ana kadar sayfa henüz bağlam olarak görünmez. */
  return chrome.tabs.create({
    url: viewerUrl,
    openerTabId: openerTabId && openerTabId > 0 ? openerTabId : undefined,
  })
}

chrome.action.onClicked.addListener(async (tab) => {
  await openViewer(tab.url, tab.id)
})

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'rs-open-page',
      title: "Bu sayfayı Responsive Studio'da aç",
      contexts: ['page', 'frame'],
    })
    chrome.contextMenus.create({
      id: 'rs-open-link',
      title: "Bağlantıyı Responsive Studio'da aç",
      contexts: ['link'],
    })
  })
  await reconcile()
})

chrome.runtime.onStartup.addListener(() => { void reconcile() })

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'rs-open-link' && info.linkUrl) await openViewer(info.linkUrl, tab?.id)
  else await openViewer(info.frameUrl ?? info.pageUrl ?? tab?.url, tab?.id)
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const ids = await getViewerTabs()
  if (ids.includes(tabId)) {
    await setViewerTabs(ids.filter((i) => i !== tabId))
    await reconcile()
  }
})

/* Viewer sekmesi başka bir adrese giderse kuralları kaldır.
   (`tabs` izni olmadan `info.url` gelmeyebilir; bu yüzden her yeni
   yüklemede sekmenin hâlâ stüdyo olup olmadığı bağlamlardan doğrulanır.) */
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete' && !info.url) return
  const ids = await getViewerTabs()
  if (ids.includes(tabId)) await reconcile()
})

/* ─── Pro Mod hakkında (ölçüm notu) ──────────────────────────────────
 *
 * `chrome.debugger` tabanlı bir "Pro Mod" denendi ve KALDIRILDI. Nedenleri,
 * Chrome 152 üzerinde ölçülerek belirlendi:
 *
 *  1. Chrome, `debugger` iznini İSTEĞE BAĞLI olarak vermiyor.
 *     `optional_permissions` içinde bildirilse bile `permissions.request()`
 *     şu hatayla reddediyor: "Only permissions specified in the manifest may
 *     be requested." (Karşılaştırma: `cookies` aynı koşulda veriliyor.)
 *     Yani Pro Mod ancak KALICI ve korkutucu bir kurulum izniyle mümkün.
 *
 *  2. Buna karşılık CDP'nin alt çerçevelerde (OOPIF) sunabildiği tek şey
 *     `prefers-color-scheme` emülasyonuydu. `setDeviceMetricsOverride`
 *     reddediliyor, `setTouchEmulationEnabled` ve `Network.setUserAgentOverride`
 *     başarı dönüp hiçbir etki yaratmıyor (bkz. YOL-HARITASI.md §2.4).
 *
 * Tek bir özellik için kalıcı hata ayıklama izni istemek kötü bir takas.
 * Gerçek CSS koyu mod emülasyonu Faz 3'te, CDP'siz bir yolla yapılacak:
 * sayfanın stylesheet'lerindeki `prefers-color-scheme` media kurallarını
 * yeniden yazmak.
 */

/* ─── Viewer ↔ SW mesajlaşması ───────────────────────────────────── */

/** Content script'lerin de gönderebildiği tek komut; geri kalanı yalnızca stüdyo sayfasına açık. */
const CONTENT_ALLOWED = new Set(['fetch'])

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id
  /* Güvenlik: başka eklentiler (onMessageExternal ayrı) ya da bir sitenin
     içine gömülmüş sayfalar ayrıcalıklı komut gönderememeli. */
  if (sender.id !== chrome.runtime.id || typeof msg?.t !== 'string'
    || (!CONTENT_ALLOWED.has(msg.t) && !fromViewer(sender))) {
    sendResponse({ ok: false, error: 'Yetkisiz gönderen' })
    return false
  }
  ;(async () => {
    try {
      switch (msg.t) {
        case 'registerViewer': {
          if (tabId != null) {
            await setViewerTabs([...(await getViewerTabs()), tabId])
            await reconcile()
          }
          sendResponse({ ok: true, tabId })
          break
        }
        case 'setHttpUserAgent': {
          await setHttpUserAgent(msg.ua ?? null, msg.ch ?? null)
          sendResponse({ ok: true })
          break
        }
        case 'setCustomHeaders': {
          const n = await setCustomHeaders(
            Array.isArray(msg.headers) ? msg.headers : [],
            typeof msg.host === 'string' ? msg.host : '',
          )
          sendResponse({ ok: true, count: n })
          break
        }
        case 'cookiesFor': {
          if (!chrome.cookies) { sendResponse({ ok: false, error: 'İzin yok' }); break }
          const list = await chrome.cookies.getAll({ url: msg.url })
          sendResponse({ ok: true, cookies: list })
          break
        }
        case 'cookieRemove': {
          if (!chrome.cookies) { sendResponse({ ok: false, error: 'İzin yok' }); break }
          await chrome.cookies.remove({ url: msg.url, name: msg.name })
          sendResponse({ ok: true })
          break
        }
        case 'cookieClearAll': {
          if (!chrome.cookies) { sendResponse({ ok: false, error: 'İzin yok' }); break }
          const all = await chrome.cookies.getAll({ url: msg.url })
          for (const c of all) {
            const scheme = c.secure ? 'https' : 'http'
            await chrome.cookies.remove({
              url: `${scheme}://${c.domain.replace(/^\./, '')}${c.path}`, name: c.name,
            }).catch(() => {})
          }
          sendResponse({ ok: true, count: all.length })
          break
        }
        case 'captureVisible': {
          /* Kullanıcı bu arada başka sekmeye geçtiyse o sekmenin görüntüsü
             alınmasın — yalnızca stüdyo sekmesi öndeyken yakala. */
          if (!sender.tab?.active) {
            sendResponse({ ok: false, error: 'Stüdyo sekmesi önde değil' })
            break
          }
          const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
            format: msg.format === 'jpeg' ? 'jpeg' : 'png',
          })
          sendResponse({ ok: true, dataUrl })
          break
        }
        /* MV3'te content script'ler cross-origin fetch yapamaz; bu istekler
           host izinlerine sahip olan service worker üzerinden geçer. */
        case 'fetch': {
          const url: unknown = msg.url
          const kind: unknown = msg.kind
          const wantText = kind === 'css' || kind === 'manifest'
          if (!isWebUrl(url)) {
            sendResponse({ ok: false, status: 0, error: 'Yalnızca http/https adresleri' })
            break
          }
          /* Yalnızca stüdyo sekmesinin kendisi ya da içindeki karelerden */
          const viewerTabs = await getViewerTabs()
          if (sender.tab?.id == null || !viewerTabs.includes(sender.tab.id)) {
            sendResponse({ ok: false, status: 0, error: 'Stüdyo dışından istek' })
            break
          }
          /* Yerel ağ: yalnızca önizlenen site de yerel ağdaysa (localhost geliştirme) */
          const trusted = fromViewer(sender) || isPrivateUrl(sender.url)
          if (isPrivateUrl(url) && !trusted) {
            sendResponse({ ok: false, status: 0, error: 'Yerel ağ adresi engellendi' })
            break
          }
          try {
            /* credentials: 'omit' — kullanıcının çerezleri hiçbir zaman gönderilmez */
            const opts = { redirect: 'follow', credentials: 'omit', cache: 'no-store' } as const
            let r = await fetch(url, { ...opts, method: wantText ? 'GET' : 'HEAD' })
            /* Bazı sunucular HEAD'i reddeder — GET ile bir kez daha dene */
            if (!wantText && (r.status === 405 || r.status === 501)) {
              r = await fetch(url, { ...opts, method: 'GET' })
            }
            /* Yönlendirme ile yerel ağa kaçış */
            if (isPrivateUrl(r.url) && !trusted) {
              sendResponse({ ok: false, status: 0, error: 'Yerel ağ adresi engellendi' })
              break
            }
            let text: string | undefined
            if (wantText) {
              const type = (r.headers.get('content-type') ?? '').toLowerCase()
              const typeOk = kind === 'css'
                ? type.includes('text/css')
                : /json|manifest/.test(type)
              if (!typeOk) {
                sendResponse({ ok: false, status: r.status, error: `Beklenmeyen içerik türü: ${type || 'yok'}` })
                break
              }
              text = await r.text()
            }
            sendResponse({ ok: true, status: r.status, text })
          } catch (e) {
            sendResponse({ ok: false, status: 0, error: String((e as Error).message).slice(0, 120) })
          }
          break
        }
        case 'openTab': {
          if (!isWebUrl(msg.url)) { sendResponse({ ok: false, error: 'Geçersiz adres' }); break }
          await chrome.tabs.create({ url: msg.url })
          sendResponse({ ok: true })
          break
        }
        default:
          sendResponse({ ok: false, error: 'Bilinmeyen komut' })
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e as Error)?.message ?? e) })
    }
  })()
  return true // asenkron yanıt
})
