import type { Script } from './types'
import type { Tab } from './components/ScriptView'

/** What moves this version forward: the workspace shows it in the bar at the bottom of the screen. */
export interface FlowStep {
  tone: '' | 'bad' | 'ok'
  title: string
  hint: string
  /** The main button: run the automatic review, or open a part. */
  action: { label: string; kind: 'review' | 'findings' | Tab }
}

export function nextStep(script: Script): FlowStep {
  const blocking = script.review?.blocking ?? 0
  if (!script.review)
    return { tone: '', title: 'الخطوة التالية: المراجعة الآلية', hint: 'ثلاثة مراجعين يفحصون السيناريو: علمي، وجمهور، ومعنى.', action: { label: 'راجع آليا', kind: 'review' } }
  if (blocking > 0)
    return { tone: 'bad', title: `${blocking} ملاحظة مانعة`, hint: 'صحّحها في نسخة جديدة قبل الاعتماد.', action: { label: 'اعرض الملاحظات', kind: 'findings' } }
  if (!script.approved && !script.template)
    return { tone: '', title: 'الخطوة التالية: قالب الفيديو', hint: 'اختر قالبا، ثم أنشئ فيديو معاينة بعلامة مائية يشاهده المراجع قبل أن يوقّع.', action: { label: 'اختر قالبا', kind: 'template' } }
  if (!script.approved && script.story && script.approvals.length === 0 && !script.change_requests.length)
    return { tone: '', title: 'الخطوة التالية: اقرأ القصة، ثم فيديو المعاينة', hint: 'قالب الأطفال كتب قصة حوار من سيناريوك: نص جديد يُعتمد مع السيناريو. الفيديو يعرض القصة لا السيناريو.', action: { label: 'فيديو المعاينة', kind: 'video' } }
  if (!script.approved)
    return { tone: '', title: 'الخطوة التالية: فيديو المعاينة ثم الاعتماد', hint: 'أنشئ معاينة بعلامة مائية، ثم يوقّع كل من تتطلبه هذه النسخة بعد مشاهدتها.', action: { label: 'فيديو المعاينة', kind: 'video' } }
  if (!script.template)
    return { tone: 'ok', title: 'النسخة معتمدة. الخطوة التالية: قالب الفيديو', hint: 'اختر القالب الذي يُحوَّل به السيناريو إلى فيديو، أو صدّر النص.', action: { label: 'اختر قالبا', kind: 'template' } }
  return { tone: 'ok', title: 'النسخة معتمدة: الفيديو النهائي بلا علامة مائية', hint: 'أنشئ الفيديو النهائي بالقالب المختار، أو صدّر النص، أو وطّنه لجمهور آخر.', action: { label: 'الفيديو النهائي', kind: 'video' } }
}
