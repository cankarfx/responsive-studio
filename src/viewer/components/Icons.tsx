/** Satır içi SVG ikon seti (harici bağımlılık yok). */
import type { JSX } from 'preact'

type P = JSX.SVGAttributes<SVGSVGElement>

const S = (d: string) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" {...p}
       dangerouslySetInnerHTML={{ __html: d }} />
)

export const IcLogo = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" {...p}>
    <rect x="2" y="4" width="13" height="10" rx="1.5" />
    <path d="M6 18h5" />
    <rect x="16" y="9" width="6" height="11" rx="1.5" />
  </svg>
)

export const IcBack = S('<path d="M15 18l-6-6 6-6"/>')
export const IcForward = S('<path d="M9 18l6-6-6-6"/>')
export const IcReload = S('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>')
export const IcRotate = S('<path d="M2.5 8.5A9.5 9.5 0 0 1 12 3a9 9 0 0 1 8 4.8"/><path d="M21.5 15.5A9.5 9.5 0 0 1 12 21a9 9 0 0 1-8-4.8"/><path d="M2 3v5h5"/><path d="M22 21v-5h-5"/>')
export const IcClose = S('<path d="M18 6L6 18M6 6l12 12"/>')
export const IcSearch = S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')
export const IcCheck = S('<path d="M20 6L9 17l-5-5"/>')
export const IcStar = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9z" />
  </svg>
)
export const IcStarOff = S('<path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9z"/>')
export const IcPlus = S('<path d="M12 5v14M5 12h14"/>')
export const IcTrash = S('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>')
export const IcSettings = S('<circle cx="12" cy="12" r="3.2"/><path d="M19.5 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.1-1.2L14.6 3h-4l-.4 2.7a7.6 7.6 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2.1 1.2l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.07-.4.1-.8.1-1.2z"/>')
export const IcDevices = S('<rect x="2" y="4" width="13" height="10" rx="1.5"/><path d="M6 18h5"/><rect x="16" y="9" width="6" height="11" rx="1.5"/>')
export const IcFolder = S('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')
export const IcSave = S('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>')
export const IcGrid = S('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>')
export const IcRows = S('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>')
export const IcColumns = S('<rect x="4" y="3" width="16" height="5" rx="1"/><rect x="4" y="10" width="16" height="5" rx="1"/><rect x="4" y="17" width="16" height="4" rx="1"/>')
export const IcFocus = S('<rect x="5" y="4" width="14" height="16" rx="2"/>')
export const IcScroll = S('<path d="M12 4v16"/><path d="M8 8l4-4 4 4"/><path d="M8 16l4 4 4-4"/>')
export const IcClick = S('<path d="M9 3v11l2.6-2.4 2 4.6 2.4-1-2-4.6H17z"/><path d="M4 4l1.5 1.5M4 12h2M12 4V2M19 5l-1.5 1.5"/>')
export const IcKeyboard = S('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>')
export const IcHover = S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>')
export const IcLink = S('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>')
export const IcCamera = S('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>')
export const IcEye = S('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>')
export const IcEyeOff = S('<path d="M17.9 17.9A10.7 10.7 0 0 1 12 19c-7 0-11-7-11-7a19 19 0 0 1 5.1-5.9M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a19 19 0 0 1-2.2 3.2M1 1l22 22"/>')
export const IcTarget = S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>')
export const IcExternal = S('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/>')
export const IcMinus = S('<path d="M5 12h14"/>')
export const IcZoom = S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>')
export const IcMoon = S('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>')
export const IcSun = S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
export const IcBolt = S('<path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>')
export const IcWarn = S('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>')
export const IcCopy = S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
export const IcDrag = S('<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>')

/* Faz 4 / arayüz sadeleştirme ikonları */
export const IcDropper = S('<path d="M19 3a2.8 2.8 0 0 0-4 0l-1.6 1.6-1-1L11 5l8 8 1.4-1.4-1-1L21 9a2.8 2.8 0 0 0 0-4z"/><path d="M12.5 6.5L4 15v5h5l8.5-8.5"/>')
export const IcTerminal = S('<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M6.5 9l3 3-3 3M12.5 15h5"/>')
export const IcRecord = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </svg>
)
export const IcStop = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
  </svg>
)
export const IcReport = S('<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 13v4M12 11v6M15.5 14v3"/>')
export const IcA11y = S('<circle cx="12" cy="4.5" r="1.8"/><path d="M4.5 8.5h15"/><path d="M12 8.5v5.5M12 14l-3.5 6.5M12 14l3.5 6.5"/>')
export const IcCode = S('<path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/>')

export const IcTouch = S('<path d="M9 11V5.5a1.8 1.8 0 0 1 3.6 0V11"/><path d="M12.6 11.5V9.8a1.7 1.7 0 0 1 3.4 0v1.7"/><path d="M16 11.8v-.6a1.7 1.7 0 0 1 3.4 0v5.3a4.5 4.5 0 0 1-4.5 4.5h-2.7a5 5 0 0 1-3.6-1.5l-3.1-3.2a1.8 1.8 0 0 1 2.5-2.5L9 15.2V11"/>')
