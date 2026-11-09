import type { AppConfig } from './config.ts'

/** Key hiển thị dạng đã che không được ghi đè key thực đang lưu. */
export function settingsPatch(data: Partial<AppConfig>): Partial<AppConfig> {
  const patch = { ...data }
  for (const key of ['llmApiKey', 'sttApiKey', 'talkVilaoApiKey'] as const) {
    if (patch[key]?.includes('…')) delete patch[key]
  }
  for (const key of Object.keys(patch) as Array<keyof AppConfig>) {
    if (patch[key] === undefined) delete patch[key]
  }
  return patch
}
