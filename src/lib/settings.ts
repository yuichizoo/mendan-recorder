const KEY_API = 'mr_api_key'

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

export function clearAllData() {
  localStorage.clear()
}
