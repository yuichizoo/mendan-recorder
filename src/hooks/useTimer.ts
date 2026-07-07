import { useEffect, useRef, useState } from 'react'

export interface Timer {
  elapsedSec: number
  running: boolean
  start: () => void
  pause: () => void
  reset: () => void
}

export function useTimer(initialSec: number): Timer {
  const [elapsedSec, setElapsedSec] = useState(initialSec)
  const [running, setRunning] = useState(false)
  const baseRef = useRef(initialSec)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (!running) return
    startedAtRef.current = Date.now()
    const tick = () => {
      setElapsedSec(baseRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000))
    }
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
      baseRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000)
    }
  }, [running])

  return {
    elapsedSec,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false)
      baseRef.current = 0
      setElapsedSec(0)
    },
  }
}

export function formatTimer(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
