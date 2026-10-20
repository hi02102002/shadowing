import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { settingsQuery } from '#/lib/queries'
import type { Accent } from '#/lib/speech'
import { saveSettings } from '#/server/fns/settings'

/** dữ liệu phụ thuộc giọng chuẩn → tải lại khi đổi giọng */
export const ACCENT_DEPENDENT_KEYS = [['ipa']] as const

/** Giọng chuẩn (Mỹ/Anh) dùng chung cả app: IPA, giọng đọc mẫu, chấm và nhận xét của AI */
export function useAccent() {
  const queryClient = useQueryClient()
  const { data } = useQuery(settingsQuery())
  const save = useMutation({
    mutationFn: (accent: Accent) => saveSettings({ data: { accent } }),
    onMutate: (accent) => {
      // đổi ngay trên giao diện, không chờ server
      queryClient.setQueryData(settingsQuery().queryKey, (old) =>
        old ? { ...old, accent } : old,
      )
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(settingsQuery().queryKey, fresh)
      for (const queryKey of ACCENT_DEPENDENT_KEYS)
        void queryClient.invalidateQueries({ queryKey })
    },
  })
  return [data?.accent ?? 'us', save.mutate] as const
}
