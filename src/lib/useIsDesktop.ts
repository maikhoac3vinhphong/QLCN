import { useEffect, useState } from 'react'

export function useIsDesktop(min = 900): boolean {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(min-width:${min}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${min}px)`)
    const on = () => setD(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [min])
  return d
}
