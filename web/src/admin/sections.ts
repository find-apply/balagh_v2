import type { ComponentType } from 'react'
import type { IconName } from '../components/Icon'
import { Approvals } from './views/Approvals'
import { Flow } from './views/Flow'
import { Overview } from './views/Overview'
import { Projects } from './views/Projects'
import { Ratings } from './views/Ratings'
import { Runs } from './views/Runs'

export interface Section {
  key: string
  label: string
  icon: IconName
  sub: string
  /** Receives the rest of the hash path, e.g. a project id. */
  View: ComponentType<{ path: string[] }>
}

/** The single list that drives both the navigation and the routing: add a section here and it appears in both. */
export const SECTIONS: Section[] = [
  { key: 'overview', label: 'نظرة عامة', icon: 'dashboard', sub: 'حالة المنصة والمسار في لمحة.', View: Overview },
  { key: 'projects', label: 'المشاريع', icon: 'folder', sub: 'كل ما أُنشئ على المنصة، كما يراه المستخدم.', View: Projects },
  { key: 'approvals', label: 'الاعتمادات', icon: 'shield', sub: 'النسخ التي لم يكتمل توقيع أدوارها المطلوبة.', View: Approvals },
  { key: 'ratings', label: 'التقييمات', icon: 'users', sub: 'رأي من شاهد الفيديوهات، ومتوسط كل قالب.', View: Ratings },
  { key: 'runs', label: 'سجل النموذج', icon: 'activity', sub: 'كل استدعاء للنموذج مع زمنه ونتيجته.', View: Runs },
  { key: 'flow', label: 'مسار التوليد', icon: 'workflow', sub: 'النماذج والقواعد التحريرية وإيقاف التوليد.', View: Flow },
]
