import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Stepper } from '@/components/kit'
import type { Step, StepState } from '@/components/kit'
import type { ChangeRequest, ReviewRole, Script } from '@/shared/types'
import { C, F } from '@/theme'
import { BigButton, Note } from './parts'

export type Part = 'script' | 'review' | 'video' | 'approve'

export interface Plan {
  steps: { part: Part; label: string; state: StepState }[]
  next: Part
  nextLabel: string
  line: string
  /** For a specialist: the automatic review raised blocking notes that warn without stopping them. */
  warning: string | null
}

/** Where a version stands, step by step, and what to do next. A specialist approves their own versions, so a
 * blocking note only warns them; a creator corrects it in a new version first. */
export function planFor(sc: Script, hasVideo: boolean, reviewing: boolean): Plan {
  const specialist = sc.author === 'specialist'
  const blocking = sc.review?.blocking ?? 0
  const asked = !sc.approved && sc.change_requests.length > 0
  const videoDone = hasVideo || !!sc.template
  const approveLabel = specialist ? 'اعتمادك' : 'الاعتماد'

  const review: StepState = !sc.review ? 'todo' : blocking > 0 ? (specialist ? 'warn' : 'current') : 'done'
  const steps: Plan['steps'] = [
    { part: 'script', label: 'السيناريو', state: 'done' },
    { part: 'review', label: 'المراجعة', state: review },
    { part: 'video', label: 'الفيديو', state: videoDone ? 'done' : 'todo' },
    { part: 'approve', label: approveLabel, state: sc.approved ? 'done' : asked ? 'edit' : 'todo' },
  ]

  let next: Part
  let line: string
  if (reviewing) {
    next = 'review'
    line = 'المراجعة الآلية جارية: ثلاثة مراجعين يفحصون السيناريو.'
  } else if (asked) {
    next = 'review'
    line = 'صحّح ما طلبه المراجع في نسخة جديدة، ثم يراجعها قبل التوقيع.'
  } else if (!sc.review) {
    next = 'review'
    line = specialist ? 'شغّل المراجعة الآلية لتنبّهك قبل اعتمادك، أو تابع إلى الفيديو.' : 'شغّل المراجعة الآلية: ثلاثة مراجعين يفحصون السيناريو.'
  } else if (blocking > 0 && !specialist) {
    next = 'review'
    line = `في المراجعة ${blocking === 1 ? 'ملاحظة مانعة' : `${blocking} ملاحظات مانعة`}: صحّحها في نسخة جديدة.`
  } else if (!videoDone) {
    next = 'video'
    line = 'اختر قالب الفيديو وشاهد المشاهد قبل إنشائه.'
  } else if (!sc.approved) {
    next = 'approve'
    line = specialist ? 'راجع النسخة واعتمدها بتوقيعك.' : 'اجمع التوقيعات المطلوبة لاعتماد النسخة.'
  } else {
    next = 'video'
    line = hasVideo ? 'النسخة معتمدة. شاهد الفيديو أو انشره لجمهور آخر.' : 'النسخة معتمدة. أنشئ الفيديو من القالب المختار.'
  }
  // The step the next action opens is the current one, unless it already says more (a warning, a request).
  for (const st of steps) if (st.part === next && st.state === 'todo') st.state = 'current'
  if (sc.approved) for (const st of steps) if (st.part === 'video' && st.state === 'todo') st.state = 'current'

  const warning = specialist && blocking > 0 && !sc.approved
    ? `في المراجعة الآلية ${blocking === 1 ? 'ملاحظة واحدة' : `${blocking} ملاحظات`} للتنبيه. اطّلع عليها، والقرار لك.`
    : null
  const nextLabel = steps.find((st) => st.part === next)?.label ?? ''
  return { steps, next, nextLabel, line, warning }
}

/** The latest version: its steps, the next one, and the button that opens it. */
export function ContinueCard({ script, number, plan, onOpen }: { script: Script; number: number; plan: Plan; onOpen: (part: Part) => void }) {
  const steps: Step[] = plan.steps.map((st) => ({ label: st.label, state: st.state, onPress: () => onOpen(st.part) }))
  return (
    <View style={st.card}>
      <View style={{ gap: 4 }}>
        <Text style={st.eyebrow}>تابع العمل · النسخة {number}{script.localized_from ? ' · موطّنة' : ''}{script.approved ? ' · ✓ معتمدة' : ''}</Text>
        <Text style={st.title} accessibilityRole="header">{script.title}</Text>
        {!!script.hook && <Text style={st.hook}>{script.hook}</Text>}
      </View>
      <Stepper steps={steps} compact />
      {plan.warning ? (
        <Note tone="gold" icon="alert-circle-outline">{plan.warning}</Note>
      ) : (
        <View style={st.next}>
          <Text style={st.nextText}>الخطوة التالية: {plan.line}</Text>
        </View>
      )}
      <BigButton title={`تابع: ${plan.nextLabel}`} onPress={() => onOpen(plan.next)} />
    </View>
  )
}

const REVIEWER: Record<ReviewRole, string> = { scholar: 'المراجع الشرعي', language: 'المراجع اللغوي والثقافي', creator: 'صانع المحتوى' }

/** A reviewer asked for a correction: their note, and the way to correct it in a new version. */
export function ChangeRequestCard({ request, onFix }: { request: ChangeRequest; onFix: () => void }) {
  const when = new Date(request.at)
  const date = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString('ar')
  return (
    <View style={st.request} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{(request.name || REVIEWER[request.role]).trim().charAt(0) || 'م'}</Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={st.requestTitle}>طلب {REVIEWER[request.role]} تعديلا</Text>
          <Text style={st.requestSub}>{[request.name, date].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      {!!request.note && (
        <View style={st.quote}>
          <Text style={st.quoteText}>{request.note}</Text>
        </View>
      )}
      <Text style={st.hook}>النسخة غير معتمدة حتى تُصحَّح. في النسخة الجديدة يراجع المراجع نفسه التصحيح قبل التوقيع.</Text>
      <BigButton title="صحّح في نسخة جديدة" onPress={onFix} />
    </View>
  )
}

/** For a specialist: another reviewer's opinion is optional. */
export function SecondOpinion({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="رأي مراجع آخر، اختياري: اطلب" onPress={onPress} style={({ pressed }) => [st.opinion, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.opinionTitle}>رأي مراجع آخر</Text>
        <Text style={st.requestSub}>اختياري: أرسل رابط القراءة لمن تثق به.</Text>
      </View>
      <Text style={st.opinionAction}>اطلب</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 18, gap: 16, shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  eyebrow: { fontSize: 12, fontFamily: F.bold, color: C.brand },
  title: { fontSize: 19, lineHeight: 29, fontFamily: F.bold, color: C.ink },
  hook: { fontSize: 14, lineHeight: 24, fontFamily: F.regular, color: '#3d4a45' },
  next: { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  nextText: { fontSize: 13, lineHeight: 22, fontFamily: F.regular, color: '#3d4a45' },
  request: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.info, borderRadius: 18, padding: 18, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.infoBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: F.bold, color: C.info },
  requestTitle: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  requestSub: { fontSize: 12, fontFamily: F.regular, color: C.muted },
  quote: { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  quoteText: { fontSize: 15, lineHeight: 27, fontFamily: F.regular, color: C.ink },
  opinion: { minHeight: 64, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  opinionTitle: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  opinionAction: { fontSize: 13, fontFamily: F.semibold, color: C.brand, paddingVertical: 10 },
})
