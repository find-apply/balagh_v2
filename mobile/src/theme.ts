/** The site's palette (web/src/index.css :root), so the app and the site look like one product. */
export const C = {
  bg: '#f7f6f2',
  surface: '#ffffff',
  ink: '#14201c',
  muted: '#66716c',
  line: '#e6e2d8',
  lineStrong: '#d6d1c3',
  brand: '#0c5a4a',
  brandSoft: '#e7f1ed',
  brandInk: '#ffffff',
  gold: '#b0893a',
  goldSoft: '#f6efdf',
  okBg: '#e3f2ea',
  ok: '#17603f',
  warnBg: '#fcf0d4',
  warn: '#7a5200',
  badBg: '#fbe5e2',
  bad: '#9c2b1f',
  infoBg: '#e6edfa',
  info: '#264f9e',
}

export const R = 16

/** The site's fonts, bundled: IBM Plex Sans Arabic for the interface, Amiri Quran for the Qur'an's script, whose
 * marks (small high letters, rounded zeros) the system fonts draw as empty boxes. A custom font has one file
 * per weight, so the weight is chosen by family name rather than by fontWeight. */
export const F = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  quran: 'AmiriQuran_400Regular',
}

const QURANIC = /[\u06D6-\u06ED\u08F0-\u08FF]/

/** The corpus writes the open tanween as the KFGQPC font does (U+065E, U+0656, U+0657); Amiri Quran draws it at
 * its Unicode places, so it is mapped for display only, as the lesson videos do (lessons/build_kursi.py). */
const OPEN_TANWEEN: Record<string, string> = { '\u065e': '\u08f1', '\u0656': '\u08f2', '\u0657': '\u08f0' }
export const shownQuran = (t: string) => t.replace(/[\u065e\u0656\u0657]/g, (c) => OPEN_TANWEEN[c])

/** Text with the Qur'an's own marks is set in the Qur'an font, wherever it appears (a quote, a scene's voice-over). */
export const isQuranic = (t: unknown) => typeof t === 'string' && QURANIC.test(t)
