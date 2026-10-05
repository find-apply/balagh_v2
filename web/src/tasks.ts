export interface Task {
  title: string
  /** Typical duration in seconds; drives the progress estimate, not a promise. */
  expected: number
  /** The stages the server goes through, in order. Empty for quick actions. */
  stages: string[]
}

export const TASKS = {
  ideas: {
    title: 'يقترح بلاغ الأفكار ويوثّق نصوصها',
    expected: 45,
    stages: [
      'قراءة الموجز وتصنيف مستوى المحتوى',
      'اقتراح ثلاث زوايا تناسب الجمهور',
      'البحث عن الآيات والأحاديث في القرآن والصحيحين',
      'مطابقة النصوص وتعليم ما لم يوثّق',
    ],
  },
  script: {
    title: 'يكتب بلاغ السيناريو',
    expected: 60,
    stages: [
      'تخطيط المشاهد وتوقيتها',
      'كتابة التعليق الصوتي والنص على الشاشة',
      'إدراج النصوص الشرعية حرفيا من المصدر',
      'التحقق من الاقتباسات والمصطلحات',
      'إعداد منشورات المنصات',
    ],
  },
  review: {
    title: 'المراجعة الآلية',
    expected: 35,
    stages: [
      'تجهيز السيناريو والمصادر للمراجعين',
      'ثلاثة مراجعين بالتوازي: علمي، وجمهور، ومعنى',
      'جمع الملاحظات وتحديد الاعتمادات المطلوبة',
    ],
  },
  revise: {
    title: 'يصحح بلاغ السيناريو في نسخة جديدة',
    expected: 60,
    stages: ['قراءة ملاحظات المراجعة', 'إعادة كتابة المشاهد المعنية', 'التحقق من الاقتباسات في النسخة الجديدة'],
  },
  localize: {
    title: 'يوطّن بلاغ السيناريو للجمهور الجديد',
    expected: 60,
    stages: [
      'تحليل الجمهور الجديد ولغته',
      'تكييف الأمثلة وأسلوب الشرح',
      'إدراج الترجمات المعتمدة من المصدر',
      'فحص المصطلحات الملزمة',
    ],
  },
  approve: { title: 'تسجيل الاعتماد', expected: 2, stages: [] },
} satisfies Record<string, Task>

/** The job running now: which project it belongs to ("new" while ideas are generated) and what it is producing. */
export interface Busy {
  task: Task
  projectId: string
  kind: 'ideas' | 'script' | 'review' | 'approve'
  scriptId?: string
  /** Position in a chained flow, such as "الخطوة 1 من 2". */
  step?: string
}
