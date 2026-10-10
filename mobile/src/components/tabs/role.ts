import type { Me } from '@/api'

/** The standing the admin gave an account after checking it; the person cannot change it. */
export function roleLabel(role: Me['role']): string {
  return role === 'specialist' ? 'مختص شرعي' : role === 'creator' ? 'صانع محتوى' : 'لم تُحدَّد بعد'
}

/** What the standing means for the person's versions. */
export function roleHint(role: Me['role']): string {
  if (role === 'specialist') return 'حددتها الإدارة بعد التحقق. تعتمد محتواك بنفسك.'
  if (role === 'creator') return 'حددتها الإدارة بعد التحقق. كل نسخة يراجعها مختص شرعي قبل النشر.'
  return 'تحددها الإدارة بعد التحقق من حسابك.'
}

/** The first letter of the person's name, for the round avatar. */
export function initial(me: Me): string {
  const name = (me.full_name || me.name || me.email || '').trim()
  return name ? Array.from(name)[0].toUpperCase() : '؟'
}

/** Keeps a phone number's or an address's left-to-right order inside Arabic text. */
export const ltr = (t: string | null | undefined) => (t ? `⁦${t}⁩` : t)
