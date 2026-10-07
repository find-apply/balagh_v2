import type { AudienceKnowledge, AuthorRole, ContentLevel, Language, Platform, Script } from './types'

export const PLATFORMS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
  facebook_reels: 'Facebook Reels',
  snapchat: 'Snapchat',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
}

/** The platform decides the frame, so the brief never asks for a ratio: short-video feeds are vertical,
 * the rest wide. A mixed list (the generic choice) is vertical. */
export type Aspect = '9:16' | '16:9'

export const PLATFORM_ASPECT: Record<Platform, Aspect> = {
  tiktok: '9:16',
  instagram_reels: '9:16',
  youtube_shorts: '9:16',
  facebook_reels: '9:16',
  snapchat: '9:16',
  youtube: '16:9',
  linkedin: '16:9',
  x: '16:9',
}

export const ASPECTS: Record<Aspect, string> = { '9:16': 'عمودي 9:16', '16:9': 'عريض 16:9' }

export function aspectOf(platforms: Platform[]): Aspect {
  return platforms.length > 0 && platforms.every((p) => PLATFORM_ASPECT[p] === '16:9') ? '16:9' : '9:16'
}

export const LANGUAGES: Record<Language, string> = { ar: 'العربية', en: 'الإنجليزية' }

export const KNOWLEDGE: Record<AudienceKnowledge, string> = {
  familiar: 'يعرف المصطلحات الإسلامية',
  basic: 'معرفة أولية',
  new: 'يتعرّف على الإسلام',
}

export const LEVELS: Record<ContentLevel, string> = {
  A: 'أ · معلومات مستقرة',
  B: 'ب · شرح واستدلال',
  C: 'ج · مسألة خلافية',
  D: 'د · فتوى شخصية',
}

export const REVIEWERS = { scholarly: 'المراجع العلمي', audience: 'مراجع الجمهور', meaning: 'مراجع المعنى' }

export const ROLES = { creator: 'صانع المحتوى', scholar: 'مراجع شرعي', language: 'مراجع لغوي وثقافي' }

export const AUTHORS: Record<AuthorRole, { label: string; hint: string }> = {
  specialist: { label: 'مختص شرعي', hint: 'شيخ أو طالب علم: تراجع محتواك بنفسك وتعتمده، وتطلب مراجعة غيرك إن شئت' },
  creator: { label: 'غير مختص', hint: 'صانع محتوى بلا تخصص شرعي: كل نسخة يراجعها مختص شرعي قبل النشر، عبر رابط المراجعة' },
}

export const CHARACTERS: Record<string, string> = { narr: 'الراوي', salim: 'سالم', maryam: 'مريم', nour: 'نور' }

export const STORY_SCENES = { story: 'مشهد', text: 'النص الشرعي', words: 'نفهم معا', quiz: 'سؤال', outro: 'الخاتمة' }

export const VIDEO_STATUS = {
  queued: 'في الانتظار',
  voicing: 'يولّد الصوت والصور',
  imaging: 'يولّد الصور',
  rendering: 'يصيّر الفيديو',
  done: 'جاهز',
  failed: 'فشل',
}

export const CLAIMS = { preserved: 'محفوظ', altered: 'تغيّر', dropped: 'محذوف', added: 'مضاف' }

export function scriptLabel(s: Script): string {
  const kind = s.localized_from ? 'نسخة موطّنة' : 'النسخة الأصلية'
  return `${LANGUAGES[s.target.language]} · ${kind}${s.version > 1 ? ` · التصحيح ${s.version - 1}` : ''}`
}

export function toMarkdown(s: Script): string {
  const lines = [
    `# ${s.title}`,
    '',
    `- الجمهور: ${s.target.audience}`,
    `- اللغة: ${LANGUAGES[s.target.language]}${s.target.dialect ? ` (${s.target.dialect})` : ''}`,
    `- المدة: ${s.duration_seconds} ثانية`,
    `- المنصات: ${s.platforms.map((p) => PLATFORMS[p]).join('، ')}`,
    `- مستوى المحتوى: ${LEVELS[s.content_level]}`,
    '',
    '## السيناريو',
    '',
  ]
  s.scenes.forEach((sc, i) => {
    lines.push(`### المشهد ${i + 1} (${sc.start_second}-${sc.end_second} ث)`, '')
    lines.push(`- الصورة: ${sc.visual}`)
    if (sc.voiceover) lines.push(`- التعليق الصوتي: ${sc.voiceover}`)
    if (sc.on_screen_text) lines.push(`- النص على الشاشة: ${sc.on_screen_text}`)
    if (sc.grounding) lines.push(`- يستند الشرح إلى (${sc.grounded ? 'وُجد في المعتمد' : 'لم يوجد في المعتمد'}): «${sc.grounding}»`)
    lines.push('')
  })
  lines.push(`**الدعوة إلى الفعل:** ${s.call_to_action}`, '', `**الصوت:** ${s.audio}`, '', '## المصادر', '')
  s.references.forEach((r) => {
    lines.push(`- ${r.source} (${r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}): ${r.arabic}`)
    if (r.translation_source) lines.push(`  - ${r.translation_source}: ${r.text}`)
    r.tafsir.forEach((t) => lines.push(`  - ${t.source}: ${t.text}`))
    if (r.sharh) lines.push(`  - ${r.sharh.source} (${r.sharh.grade}، ${r.sharh.attribution}): ${r.sharh.text}`)
  })
  if (s.unverified_claims.length) {
    lines.push('', '## وقائع لم يُتحقق منها (للمراجع البشري)', '')
    s.unverified_claims.forEach((c) => lines.push(`- ${c}`))
  }
  lines.push('', '## المنشورات', '')
  s.posts.forEach((p) => lines.push(`### ${PLATFORMS[p.platform]}`, '', p.caption, '', p.hashtags.join(' '), ''))
  lines.push('## الاعتماد', '', `صاحب المحتوى: ${AUTHORS[s.author].label}${s.author === 'specialist' ? ' (مراجعة ذاتية)' : ''} · الصفة معلَنة من المستخدم، غير موثّقة`, '')
  s.approvals.forEach((a) => lines.push(`- ${ROLES[a.role]}: ${a.name} (${new Date(a.at).toLocaleString('ar')})`))
  lines.push('', '---', '', s.ai_disclosure)
  return lines.join('\n')
}
