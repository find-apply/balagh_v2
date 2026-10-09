// Copied from web/src/audiences.ts by scripts/sync-shared.mjs: edit it there, then run npm run sync.
import type { AudienceKnowledge } from './types'

// Each audience group implies how much it already knows about Islam.
export const GROUPS: { label: string; knowledge: AudienceKnowledge }[] = [
  { label: 'شباب مسلمون (18-30)', knowledge: 'familiar' },
  { label: 'مراهقون مسلمون (13-17)', knowledge: 'familiar' },
  { label: 'آباء وأمهات مسلمون', knowledge: 'familiar' },
  { label: 'مسلمون جدد', knowledge: 'basic' },
  { label: 'غير مسلمين يتعرفون على الإسلام', knowledge: 'new' },
  { label: 'طلاب جامعات غير مسلمين', knowledge: 'new' },
  { label: 'عامة الناس', knowledge: 'basic' },
]
