import type { AudienceKnowledge, AuthorRole, ContentLevel, Language, Platform, Script, VideoTemplate } from './types'

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

/** Why a render failed, in words a creator can act on. The server's own Arabic messages are shown as they are;
 * a technical one (Remotion, a timeout, a missing key) becomes a plain sentence. */
export function videoErrorText(error: string | null | undefined): string {
  const e = (error ?? '').trim()
  if (/[\u0600-\u06FF]/.test(e)) return e
  if (/magnific|image/i.test(e)) return 'تعذّر صنع صور هذا القالب الآن. أعد المحاولة، أو اختر قالبا بلا صور مثل الزخرفة الهندسية.'
  if (!e || /timeout|timed out/i.test(e)) return 'استغرق إنشاء الفيديو أطول من المعتاد فتوقّف. أعد المحاولة بعد قليل.'
  return 'حدث خطأ في خادم الفيديو. أعد المحاولة، وإن تكرر فتواصل مع الإدارة.'
}

/** The same test the server applies: the story templates are for an audience of children. */
export const isChildren = (audience: string) =>
  /أطفال|طفل|أولاد|صغار|براعم|\bkids?\b|\bchildren\b|\bchild\b|\b(?:[3-9]|1[0-2])\s*(?:إلى|الى|-|–|to)\s*(?:[4-9]|1[0-2])\s*(?:سنوات|سنة|years?)/i.test(audience)

/** A template as a picker shows it: one card per template (its frame for this platform), and whether it can be chosen. */
export interface TemplateOption {
  template: VideoTemplate
  /** The ids of every frame of this template, to mark it chosen whichever frame was picked. */
  family: string[]
  group: 'fit' | 'other' | 'blocked'
  /** Why it sits in its group: the frame it will show in, or why this script cannot use it. */
  reason: string | null
  /** A blocked children's template can be reached by localizing the script for children. */
  needsKids: boolean
}

/** Sorts the library for a script: what fits its platform and audience, what fits only its audience (another
 * frame), and what its audience cannot use, with the reason, so nothing disappears without a word. */
export function templateOptions(templates: VideoTemplate[], aspect: Aspect, audience: string): TemplateOption[] {
  const kids = isChildren(audience)
  const families = new Map<string, VideoTemplate[]>()
  for (const t of templates) {
    const root = t.variant_of ?? t.id
    families.set(root, [...(families.get(root) ?? []), t])
  }
  const order = { fit: 0, other: 1, blocked: 2 }
  return [...families.values()]
    .map((members): TemplateOption => {
      const template = members.find((m) => m.aspect === aspect) ?? members.find((m) => !m.variant_of) ?? members[0]
      const family = members.map((m) => m.id)
      if (template.story !== kids)
        return {
          template, family, group: 'blocked', needsKids: template.story,
          reason: template.story ? 'للأطفال فقط: شخصياته وصوته مصمَّمة لهم.' : 'لجمهور غير الأطفال: لجمهور الأطفال قوالبه الخاصة.',
        }
      if (!template.ready) return { template, family, group: 'blocked', needsKids: false, reason: 'قريبا.' }
      if (template.aspect !== aspect)
        return {
          template, family, group: 'other', needsKids: false,
          reason: template.aspect === '16:9' ? 'عريض 16:9: يظهر في منصتك بشريطين أعلى الفيديو وأسفله.' : 'عمودي 9:16: يظهر في منصتك بشريطين على جانبيه.',
        }
      return { template, family, group: 'fit', needsKids: false, reason: null }
    })
    .sort((a, b) => order[a.group] - order[b.group])
}
