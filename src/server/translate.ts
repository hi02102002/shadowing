/**
 * Dịch bằng endpoint miễn phí của Google Translate (client=gtx, không cần API key).
 * Không chính thức: có thể bị giới hạn tần suất nếu gọi dồn dập → người gọi nên cache kết quả.
 */
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single'

export async function googleTranslate(
  text: string,
  target = 'vi',
  source = 'en',
): Promise<string> {
  const url = `${ENDPOINT}?${new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: text })}`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new Error('Không kết nối được Google Dịch')
  }
  if (res.status === 429)
    throw new Error(
      'Google Dịch đang giới hạn số lần dịch, thử lại sau ít phút',
    )
  if (!res.ok) throw new Error(`Google Dịch lỗi (HTTP ${res.status})`)
  // [[["bản dịch", "câu gốc", …], …], …]: mỗi phần tử là một câu
  const data = (await res.json()) as [
    Array<[string, ...unknown[]]> | null,
    ...unknown[],
  ]
  const translated = (data[0] ?? [])
    .map((part) => part[0])
    .join('')
    .trim()
  if (!translated) throw new Error('Google Dịch không trả về bản dịch')
  return translated
}
