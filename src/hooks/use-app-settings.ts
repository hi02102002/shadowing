import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { settingsQuery } from '#/lib/queries'
import type { PublicSettings } from '#/server/fns/settings'
import { saveSettings } from '#/server/fns/settings'

/** dữ liệu phụ thuộc giọng chuẩn → tải lại khi đổi giọng */
export const ACCENT_DEPENDENT_KEYS = [['ipa']] as const

type SettingKey = 'accent' | 'aiAnalysis'

/** Đọc/ghi một cài đặt chung ngay tại chỗ dùng (không cần mở trang Cài đặt) */
function useSetting<TKey extends SettingKey>(
  key: TKey,
  fallback: PublicSettings[TKey],
  onSaved?: () => void,
) {
  const queryClient = useQueryClient()
  const { data } = useQuery(settingsQuery())
  const save = useMutation({
    mutationFn: (value: PublicSettings[TKey]) =>
      saveSettings({ data: { [key]: value } }),
    onMutate: (value) => {
      // đổi ngay trên giao diện, không chờ server
      queryClient.setQueryData(settingsQuery().queryKey, (old) =>
        old ? { ...old, [key]: value } : old,
      )
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(settingsQuery().queryKey, fresh)
      onSaved?.()
    },
  })
  return [data?.[key] ?? fallback, save.mutate] as const
}

/** Giọng chuẩn (Mỹ/Anh) dùng chung cả app: IPA, giọng đọc mẫu, chấm và nhận xét của AI */
export function useAccent() {
  const queryClient = useQueryClient()
  return useSetting('accent', 'us', () => {
    for (const queryKey of ACCENT_DEPENDENT_KEYS)
      void queryClient.invalidateQueries({ queryKey })
  })
}

/** Tự gọi AI phân tích lỗi sau mỗi lần chấm (tắt thì chỉ phân tích khi bấm) */
export function useAiAnalysis() {
  const [value, set] = useSetting('aiAnalysis', 'on')
  return [value === 'on', (on: boolean) => set(on ? 'on' : 'off')] as const
}
