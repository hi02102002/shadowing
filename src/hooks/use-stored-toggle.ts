import { useEffect, useState } from 'react'

/** công tắc bật/tắt nhớ trong trình duyệt (IPA, bản dịch…) */
export function useStoredToggle(key: string) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      setOn(localStorage.getItem(key) === '1')
    } catch {
      /* private mode */
    }
  }, [key])
  const change = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* private mode */
    }
  }
  return [on, change] as const
}
