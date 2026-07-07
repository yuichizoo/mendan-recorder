// 個人情報らしき文字列の検出。完璧ではない前提で、送信前プレビューでの
// 目視確認を補助する。過剰検出は許容(タップしなければ置換されない)。

export interface CompanyEntry {
  id: string
  name: string
  variants: string
}

export type DetectionKind = 'name' | 'phone' | 'postal' | 'address' | 'company'

export interface Detection {
  start: number
  end: number
  text: string
  kind: DetectionKind
  replacement: string
}

export const KIND_LABELS: Record<DetectionKind, string> = {
  name: '氏名?',
  phone: '電話番号?',
  postal: '郵便番号?',
  address: '住所?',
  company: '企業名',
}

// 敬称の前が一般名詞のときは氏名扱いしない
const NAME_BASE_BLOCK =
  /(皆|客|奥|神|王|模|同|仕|様|patient|患者|利用者|入居者|家族|息子|娘|母|父|兄|姉|弟|妹|祖母|祖父|夫|妻|嫁|婿|業者|師|士|医|長|員|方|皆|みな)$/

function pushMatches(
  out: Omit<Detection, 'replacement'>[],
  text: string,
  re: RegExp,
  kind: DetectionKind,
  filter?: (m: RegExpExecArray) => boolean,
) {
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (filter && !filter(m)) continue
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], kind })
    if (m.index === re.lastIndex) re.lastIndex++
  }
}

export function detectSensitive(text: string, companies: CompanyEntry[]): Detection[] {
  const raw: Omit<Detection, 'replacement'>[] = []

  // 企業名辞書(登録名+読みバリエーション)
  companies.forEach((entry) => {
    const patterns = [entry.name, ...entry.variants.split(/[、,，]/)]
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    patterns.forEach((p) => {
      let idx = 0
      while ((idx = text.indexOf(p, idx)) !== -1) {
        raw.push({ start: idx, end: idx + p.length, text: p, kind: 'company' })
        idx += p.length
      }
    })
  })

  // 郵便番号(電話より先に検出して優先)
  pushMatches(raw, text, /〒?\d{3}[-ー‐]\d{4}/g, 'postal')

  // 電話番号(0始まり10〜11桁、ハイフン有無)
  pushMatches(raw, text, /0\d{1,4}[-ー‐]\d{1,4}[-ー‐]\d{3,4}|0\d{9,10}/g, 'phone')

  // 住所らしきパターン
  pushMatches(
    raw,
    text,
    /[一-龥]{1,4}[都道府県][一-龥ぁ-んァ-ヶー0-9０-９]{1,12}[市区郡町村]/g,
    'address',
  )
  pushMatches(raw, text, /[0-9０-９]{1,3}丁目[0-9０-９番地号ー-]{0,10}/g, 'address')

  // 氏名らしきパターン①: 姓+名(全半角スペース区切りの漢字)
  pushMatches(raw, text, /[一-龥]{1,3}[ 　][一-龥]{1,3}(?:さん|さま|様|氏|殿|くん|ちゃん)?/g, 'name', (m) => {
    // 「# 面談情報」等の見出し直後などノイズを減らす: 前後が漢字なら除外
    const before = text[m.index - 1] ?? ''
    return !/[一-龥]/.test(before)
  })

  // 氏名らしきパターン②: 漢字/カタカナ+敬称
  pushMatches(
    raw,
    text,
    /[一-龥ァ-ヶー]{2,5}(?:さん|さま|様|氏|殿|くん|ちゃん)/g,
    'name',
    (m) => {
      const base = m[0].replace(/(さん|さま|様|氏|殿|くん|ちゃん)$/, '')
      return !NAME_BASE_BLOCK.test(base)
    },
  )

  // 重なりの解決: 開始位置順に並べ、先勝ち(同じ開始なら長い方)
  raw.sort((a, b) => a.start - b.start || b.end - a.end)
  const picked: Omit<Detection, 'replacement'>[] = []
  let lastEnd = -1
  for (const d of raw) {
    if (d.start >= lastEnd) {
      picked.push(d)
      lastEnd = d.end
    }
  }

  // 置換候補の割り当て(同じ文字列には同じ置換)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const nameMap = new Map<string, string>()
  const companyMap = new Map<string, string>()
  const fixed: Record<Exclude<DetectionKind, 'name' | 'company'>, string> = {
    phone: '(電話番号)',
    postal: '(郵便番号)',
    address: '(住所)',
  }

  return picked.map((d) => {
    let replacement: string
    if (d.kind === 'name') {
      if (!nameMap.has(d.text)) {
        nameMap.set(d.text, `${letters[nameMap.size % letters.length]}氏`)
      }
      replacement = nameMap.get(d.text)!
    } else if (d.kind === 'company') {
      if (!companyMap.has(d.text)) {
        companyMap.set(d.text, `${letters[companyMap.size % letters.length]}社`)
      }
      replacement = companyMap.get(d.text)!
    } else {
      replacement = fixed[d.kind]
    }
    return { ...d, replacement }
  })
}

export function replaceAllOccurrences(text: string, target: string, replacement: string): string {
  return text.split(target).join(replacement)
}
