import { getApiKey } from './settings'

// AI呼び出し層。フェーズ2(Cloudflare Workersプロキシ)への移行時は
// ENDPOINT と buildHeaders() の差し替えだけで済むようにここに集約する。
const ENDPOINT = 'https://api.anthropic.com/v1/messages'
// 文書生成は品質重視、聞き漏らしチェックは速度重視でモデルを使い分ける
export const MODEL_GENERATE = 'claude-sonnet-4-6'
export const MODEL_CHECK = 'claude-haiku-4-5'

export class ApiError extends Error {
  retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

function buildHeaders(): Record<string, string> {
  const key = getApiKey()
  if (!key) {
    throw new ApiError('APIキーが未設定です。設定画面で登録してください。', false)
  }
  return {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

export interface GenerateOptions {
  system: string
  user: string
  maxTokens?: number
  model?: string
}

// 生成結果を「文書本文」と「要確認リスト」に分割する
export function splitDocAndCheck(raw: string): { docText: string; checkText: string } {
  const marker = '---要確認---'
  const idx = raw.indexOf(marker)
  return {
    docText: (idx >= 0 ? raw.slice(0, idx) : raw).trim(),
    checkText: idx >= 0 ? raw.slice(idx + marker.length).trim() : '',
  }
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  const headers = buildHeaders()
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model ?? MODEL_GENERATE,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
    })
  } catch {
    throw new ApiError('通信エラーが発生しました。電波状況を確認して再試行してください。', true)
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiError('APIキーが無効です。設定画面で確認してください。', false)
    }
    if (res.status === 429 || res.status >= 500) {
      throw new ApiError(`サーバーが混雑しています(${res.status})。少し待って再試行してください。`, true)
    }
    const body = await res.json().catch(() => null)
    const detail = body?.error?.message
    throw new ApiError(detail ? `エラー: ${detail}` : `エラーが発生しました(${res.status})`, false)
  }

  const data = await res.json()
  const blocks: Array<{ type: string; text?: string }> = data.content ?? []
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  if (!text) {
    throw new ApiError('応答が空でした。再試行してください。', true)
  }
  return text
}
