import type { CompanyEntry } from './anonymize'

const KEY_API = 'mr_api_key'
const KEY_COMPANIES = 'mr_companies'

export function getApiKey(): string {
  return localStorage.getItem(KEY_API) ?? ''
}

export function setApiKey(key: string) {
  if (key) {
    localStorage.setItem(KEY_API, key)
  } else {
    localStorage.removeItem(KEY_API)
  }
}

export function getCompanies(): CompanyEntry[] {
  try {
    const raw = localStorage.getItem(KEY_COMPANIES)
    if (raw) return JSON.parse(raw) as CompanyEntry[]
  } catch {
    // 壊れたデータは空扱い
  }
  return []
}

export function saveCompanies(entries: CompanyEntry[]) {
  localStorage.setItem(KEY_COMPANIES, JSON.stringify(entries))
}

export function clearAllData() {
  localStorage.clear()
}
