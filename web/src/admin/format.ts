export const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const num = (n: number) => n.toLocaleString('ar')

export const ROLES: Record<string, string> = { creator: 'صاحب المحتوى', scholar: 'مراجع شرعي', language: 'مراجع لغوي' }

export const KINDS: Record<string, string> = {
  IdeasDraft: 'اقتراح الأفكار',
  ScriptDraft: 'كتابة السيناريو',
  LocalizedDraft: 'التوطين',
  FindingsDraft: 'مراجعة آلية',
  ClaimsDraft: 'فحص المعنى',
}

export const STAGES: Record<string, string> = {
  ideas: 'اقتراح الأفكار',
  script: 'كتابة السيناريو',
  localize: 'التوطين',
  review: 'المراجعة الآلية',
  revise: 'التصحيح',
  approve: 'الاعتماد البشري',
}
