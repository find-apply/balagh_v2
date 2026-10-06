import type { AudienceKnowledge, ContentLevel, Language, Platform, Script } from './types'

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
  const kind = s.localized_from ? 'موطَّن' : 'أصلي'
  return `${LANGUAGES[s.target.language]} · ${kind} · ن${s.version}`
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
    lines.push('')
  })
  lines.push(`**الدعوة إلى الفعل:** ${s.call_to_action}`, '', `**الصوت:** ${s.audio}`, '', '## المصادر', '')
  s.references.forEach((r) => {
    lines.push(`- ${r.source} (${r.usage === 'quoted' ? 'اقتباس حرفي' : 'بالمعنى'}): ${r.arabic}`)
    if (r.translation_source) lines.push(`  - ${r.translation_source}: ${r.text}`)
  })
  lines.push('', '## المنشورات', '')
  s.posts.forEach((p) => lines.push(`### ${PLATFORMS[p.platform]}`, '', p.caption, '', p.hashtags.join(' '), ''))
  lines.push('## الاعتماد', '')
  s.approvals.forEach((a) => lines.push(`- ${ROLES[a.role]}: ${a.name} (${new Date(a.at).toLocaleString('ar')})`))
  lines.push('', '---', '', s.ai_disclosure)
  return lines.join('\n')
}
