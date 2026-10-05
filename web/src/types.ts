// Mirrors the API's app/schemas.py.

export type Language = 'ar' | 'en'
export type AudienceKnowledge = 'familiar' | 'basic' | 'new'
export type ContentLevel = 'A' | 'B' | 'C' | 'D'
export type Platform =
  | 'tiktok'
  | 'instagram_reels'
  | 'youtube_shorts'
  | 'facebook_reels'
  | 'snapchat'
  | 'youtube'
  | 'linkedin'
  | 'x'

export interface AudienceSpec {
  audience: string
  language: Language
  dialect: string | null
  audience_knowledge: AudienceKnowledge
  tone: string | null
}

export interface Brief extends AudienceSpec {
  idea: string | null
  platforms: Platform[]
  duration_seconds: number | null
}

export interface LocalizeRequest extends AudienceSpec {
  platforms: Platform[] | null
  duration_seconds: number | null
  notes: string | null
}

export interface Evidence {
  id: string
  kind: 'quran' | 'hadith'
  text: string
  source: string
  translation_en: string | null
  translation_source: string | null
}

export interface Idea {
  id: string
  title: string
  hook: string
  concept: string
  why_it_works: string
  duration_seconds: number
  duration_reason: string
  content_level: ContentLevel
  level_reason: string
  needs_specialist_review: boolean
  evidence: Evidence[]
  unverified: string[]
}

export interface Scene {
  start_second: number
  end_second: number
  visual: string
  voiceover: string
  on_screen_text: string
  evidence_ids: string[]
}

export interface Tafsir {
  text: string
  source: string
}

export interface Reference {
  evidence_id: string
  kind: 'quran' | 'hadith'
  usage: 'quoted' | 'paraphrased'
  text: string
  arabic: string
  source: string
  translation_source: string | null
  tafsir: Tafsir[]
}

export interface PlatformPost {
  platform: Platform
  caption: string
  hashtags: string[]
}

export interface TermCheck {
  term_ar: string
  approved_en: string
  rule: string
  status: 'used' | 'missing'
}

export interface Finding {
  reviewer: 'scholarly' | 'audience' | 'meaning'
  scene: number
  severity: 'blocking' | 'suggestion'
  issue: string
  fix: string
}

export interface ClaimCheck {
  claim: string
  status: 'preserved' | 'altered' | 'dropped' | 'added'
  note: string
}

export interface ReviewReport {
  findings: Finding[]
  claims: ClaimCheck[]
  blocking: number
  note: string
}

export type ReviewRole = 'creator' | 'scholar' | 'language'

export interface Approval {
  role: ReviewRole
  name: string
  at: string
}

export interface Script {
  id: string
  idea_id: string
  version: number
  localized_from: string | null
  revised_from: string | null
  target: AudienceSpec
  platforms: Platform[]
  title: string
  duration_seconds: number
  hook: string
  scenes: Scene[]
  call_to_action: string
  audio: string
  references: Reference[]
  content_level: ContentLevel
  needs_specialist_review: boolean
  review_note: string
  warnings: string[]
  posts: PlatformPost[]
  adaptation_notes: { change: string; reason: string }[]
  terminology: TermCheck[]
  review: ReviewReport | null
  approvals: Approval[]
  required_approvals: { role: ReviewRole; reason: string }[]
  approved: boolean
  ai_disclosure: string
}

export interface Project {
  id: string
  brief: Brief
  ideas: Idea[]
  scripts: Record<string, Script>
}
