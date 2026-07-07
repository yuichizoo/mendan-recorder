import { useEffect } from 'react'

// タイマー作動中に画面スリープを防ぐ(ディクテーション中断対策)。
// 非対応ブラウザ・低電力モードでは静かに何もしない。
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          lock = null
        }
      } catch {
        // 拒否されても致命的ではない
      }
    }

    void request()

    // タブ復帰時にロックが自動解除されるため取り直す
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
      lock = null
    }
  }, [active])
}
