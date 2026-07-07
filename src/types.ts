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

export interface SangyoiDraft {
  interviewType: InterviewType
  caseId: string
  segments: Segment[]
  elapsedSec: number
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
