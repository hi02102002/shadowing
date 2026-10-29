import { useEffect, useState } from 'react'

/** báo cho các hook khác cùng key (trên cùng trang) đổi theo */
const EVENT = 'stored-toggle'

/** công tắc bật/tắt nhớ trong trình duyệt (IPA, bản dịch…); mọi nơi dùng cùng key đổi theo nhau */
export function useStoredToggle(key: string) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      setOn(localStorage.getItem(key) === '1')
    } catch {
      /* private mode */
    }
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; on: boolean }>).detail
      if (detail.key === key) setOn(detail.on)
    }
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [key])
  const change = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, on: next } }))
  }
  return [on, change] as const
}
