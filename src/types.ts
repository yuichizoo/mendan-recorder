export type Mode = 'sangyoi' | 'homon'

export type InterviewType = 'choki' | 'kostress' | 'fukushoku' | 'other'

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  choki: '長時間労働',
  kostress: '高ストレス',
  fukushoku: '復職',
  other: 'その他',
}

export interface Segment {
  id: string
  ts: number
  text: string
}

export type WorkClass = 'normal' | 'restricted' | 'rest'

export const WORK_CLASS_LABELS: Record<WorkClass, string> = {
  normal: '通常勤務可',
  restricted: '就業制限(条件付き)',
  rest: '要休業',
}

export const MEASURES = [
  { key: 'overtime', label: '時間外労働の制限' },
  { key: 'night', label: '深夜業の制限' },
  { key: 'trip', label: '出張の制限' },
  { key: 'tenkan', label: '作業転換' },
  { key: 'basho', label: '就業場所の変更' },
  { key: 'jushin', label: '医療機関への受診勧奨' },
  { key: 'other', label: 'その他' },
] as const

export type MeasureKey = (typeof MEASURES)[number]['key']

export const PERIOD_PRESETS = ['1か月', '3か月', '次回面談まで'] as const

export interface Judgment {
  workClass: WorkClass | null
  measures: MeasureKey[]
  overtimeLimitH: string
  measureOther: string
  period: string | null
  periodCustom: string
}

export const EMPTY_JUDGMENT: Judgment = {
  workClass: null,
  measures: [],
  overtimeLimitH: '',
  measureOther: '',
  period: null,
  periodCustom: '',
}

export interface SangyoiDraft {
  interviewType: InterviewType
  caseId: string
  segments: Segment[]
  elapsedSec: number
  judgment: Judgment
}

export interface GenerateResult {
  mode: Mode
  interviewType: InterviewType
  caseId: string
  docText: string
  checkText: string
  generatedAt: number
  durationSec: number
}
