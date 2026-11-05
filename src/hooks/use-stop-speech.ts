import { useEffect } from 'react'

import { stopSpeech } from '#/lib/speech'

/** rời trang thì dừng giọng đọc mẫu đang chạy (player dùng chung nên đổi trang không tự dừng) */
export function useStopSpeechOnLeave() {
  useEffect(() => stopSpeech, [])
}
