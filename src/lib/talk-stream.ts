export type TalkStreamEvent =
  | { type: 'user' | 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export async function readTalkStream(
  form: FormData,
  onEvent: (event: TalkStreamEvent) => void,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher('/api/conversation-stream', {
    method: 'POST',
    body: form,
    signal,
  })
  if (!response.ok)
    throw new Error((await response.text()) || `HTTP ${response.status}`)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (!line.trim()) continue
        const event = JSON.parse(line) as TalkStreamEvent
        if (event.type === 'error') throw new Error(event.message)
        onEvent(event)
        if (event.type === 'done') done = true
      }
    }
    if (!done) throw new Error('Luồng trả lời bị ngắt. Bạn có thể thử lại.')
  } finally {
    reader.releaseLock()
  }
}
