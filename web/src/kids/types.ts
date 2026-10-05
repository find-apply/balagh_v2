import type { Language, Reference } from '../types'

export type AgeBand = '4-6' | '7-9' | '10-12'
export type GuardianRole = 'educator' | 'parent'

export interface StoryRequest {
  topic: string | null
  age_band: AgeBand
  language: Language
  dialect: string | null
  characters: { name: string; trait: string }[] | null
  duration_seconds: number | null
}

export interface StoryScene {
  start_second: number
  end_second: number
  setting: string
  narration: string
  dialogue: { speaker: string; line: string }[]
  evidence_ids: string[]
}

export interface Story {
  id: string
  request: StoryRequest
  duration_seconds: number
  title: string
  moral: string
  characters: { name: string; age: string; trait: string; catchphrase: string }[]
  scenes: StoryScene[]
  closing_question: string
  parent_note: string
  teaser: { hook: string; voiceover: string; caption: string }
  references: Reference[]
  unverified: string[]
  warnings: string[]
  approval: { role: GuardianRole; name: string; at: string } | null
  approved: boolean
  notice: string
}
