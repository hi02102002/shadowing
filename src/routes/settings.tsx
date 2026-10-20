import { createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import {
  CheckCircle2,
  Download,
  Loader2,
  PlugZap,
  Save,
  XCircle,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import { settingsQuery } from '#/lib/queries'
import { downloadWhisperModel, whisperStatus } from '#/server/fns/captions'
import { saveSettings, testLlm } from '#/server/fns/settings'
import type { PublicSettings } from '#/server/fns/settings'

export const Route = createFileRoute('/settings')({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  head: () => ({ meta: [{ title: 'Cài đặt · Shadowing' }] }),
  component: SettingsPage,
})

type Provider = PublicSettings['llmProvider']

const LLM_PRESETS: Record<
  Provider,
  { label: string; model: string; baseUrl: string; keyHint: string }
> = {
  openai: {
    label: 'OpenAI',
    model: 'gpt-5-mini',
    baseUrl: '',
    keyHint: 'sk-…',
  },
  anthropic: {
    label: 'Anthropic Claude',
    model: 'claude-sonnet-5-5',
    baseUrl: '',
    keyHint: 'sk-ant-…',
  },
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-2.5-flash',
    baseUrl: '',
    keyHint: 'AIza…',
  },
  ollama: {
    label: 'Ollama (local)',
    model: 'qwen3:8b',
    baseUrl: 'http://localhost:11434',
    keyHint: 'không cần',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible (OpenRouter, Groq, LM Studio…)',
    model: 'openai/gpt-5-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'API key của provider',
  },
}

const ENGINES = [
  {
    value: 'llm-audio',
    label: 'Model AI nghe trực tiếp (khuyên dùng)',
    desc: 'Gửi bản ghi cho chính model LLM ở trên (Gemini, gpt-audio…). Nghe được lỗi âm cuối, trọng âm. Chỉ cần 1 key.',
  },
  {
    value: 'stt',
    label: 'Whisper (STT) + LLM đọc chữ',
    desc: 'Đo chính xác tốc độ và khoảng ngắt nhờ timestamp từng từ, nhưng Whisper hay "tự sửa" lỗi nhỏ. Cần cấu hình STT bên dưới.',
  },
] as const satisfies ReadonlyArray<{
  value: PublicSettings['pronunciationEngine']
  label: string
  desc: string
}>

const CAPTION_ENGINES = [
  {
    value: 'local',
    label: 'Whisper trên máy (khuyên dùng)',
    desc: 'whisper.cpp chạy ngay trên máy: miễn phí, audio không rời khỏi máy. Lần đầu cần tải model.',
  },
  {
    value: 'api',
    label: 'Speech-to-Text API',
    desc: 'Dùng cấu hình STT bên dưới. Nhanh trên máy yếu nhưng tính phí theo phút audio.',
  },
] as const satisfies ReadonlyArray<{
  value: PublicSettings['captionEngine']
  label: string
  desc: string
}>

const STT_PRESETS = [
  { label: 'OpenAI Whisper', baseUrl: '', model: 'whisper-1' },
  {
    label: 'Groq (nhanh, rẻ)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'whisper-large-v3-turbo',
  },
  {
    label: 'Local (speaches / faster-whisper-server)',
    baseUrl: 'http://localhost:8000/v1',
    model: 'Systran/faster-whisper-small.en',
  },
]

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery())
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: (values: PublicSettings) => saveSettings({ data: values }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(settingsQuery().queryKey, fresh)
      form.reset(fresh)
    },
  })
  const test = useMutation({ mutationFn: () => testLlm() })

  const form = useForm({
    defaultValues: data,
    onSubmit: ({ value }) => save.mutateAsync(value),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Cài đặt AI</h1>
        <p className="text-sm text-muted-foreground">
          Dùng bất kỳ provider nào. Giá trị ở đây ghi đè biến môi trường trong{' '}
          <code>.env</code>. API key chỉ lưu trên máy chủ của bạn (SQLite).
        </p>
      </header>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <fieldset className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">
            Mô hình ngôn ngữ: phân tích lỗi
          </legend>

          <form.Field
            name="llmProvider"
            listeners={{
              onChange: ({ value }) => {
                const p = LLM_PRESETS[value]
                form.setFieldValue('llmModel', p.model)
                form.setFieldValue('llmBaseUrl', p.baseUrl)
              },
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Provider</Label>
                <select
                  id={field.name}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value as Provider)
                  }
                >
                  {(Object.keys(LLM_PRESETS) as Provider[]).map((p) => (
                    <option key={p} value={p}>
                      {LLM_PRESETS[p].label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field
              name="llmModel"
              validators={{
                onChange: ({ value }) =>
                  !value.trim() ? 'Bắt buộc' : undefined,
              }}
            >
              {(field) => (
                <TextField
                  field={field}
                  label="Model"
                  placeholder="vd. gpt-5-mini"
                />
              )}
            </form.Field>
            <form.Subscribe selector={(s) => s.values.llmProvider}>
              {(provider) => (
                <form.Field name="llmApiKey">
                  {(field) => (
                    <TextField
                      field={field}
                      label="API key"
                      type="password"
                      placeholder={LLM_PRESETS[provider].keyHint}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          </div>

          <form.Subscribe selector={(s) => s.values.llmProvider}>
            {(provider) => (
              <form.Field
                name="llmBaseUrl"
                validators={{
                  onChange: ({ value }) =>
                    provider === 'openai-compatible' && !value.trim()
                      ? 'Bắt buộc với OpenAI-compatible'
                      : value && !/^https?:\/\//.test(value)
                        ? 'Phải bắt đầu bằng http(s)://'
                        : undefined,
                }}
              >
                {(field) => (
                  <TextField
                    field={field}
                    label="Base URL (tuỳ chọn)"
                    placeholder={
                      LLM_PRESETS[provider].baseUrl || 'Mặc định của provider'
                    }
                  />
                )}
              </form.Field>
            )}
          </form.Subscribe>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PlugZap />
              )}
              Kiểm tra kết nối
            </Button>
            {test.data && (
              <span
                className={`flex items-center gap-1.5 text-sm ${test.data.ok ? 'text-ok' : 'text-destructive'}`}
              >
                {test.data.ok ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {test.data.message}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Kiểm tra dùng cấu hình đã lưu, nên hãy bấm Lưu trước.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">
            Chấm phát âm bằng
          </legend>
          <form.Field name="pronunciationEngine">
            {(field) => (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {ENGINES.map((e) => (
                  <label
                    key={e.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                      field.state.value === e.value
                        ? 'border-primary bg-accent/50'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type="radio"
                        name={field.name}
                        value={e.value}
                        checked={field.state.value === e.value}
                        onChange={() => field.handleChange(e.value)}
                      />
                      {e.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.desc}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </form.Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">
            Tạo phụ đề cho video không có phụ đề
          </legend>
          <form.Field name="captionEngine">
            {(field) => (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {CAPTION_ENGINES.map((e) => (
                  <label
                    key={e.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                      field.state.value === e.value
                        ? 'border-primary bg-accent/50'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type="radio"
                        name={field.name}
                        value={e.value}
                        checked={field.state.value === e.value}
                        onChange={() => field.handleChange(e.value)}
                      />
                      {e.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.desc}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </form.Field>
          <WhisperModelStatus />
        </fieldset>

        <form.Subscribe
          selector={(s) =>
            s.values.pronunciationEngine === 'stt' ||
            s.values.captionEngine === 'api'
          }
        >
          {(used) => (
            <fieldset
              className={`flex flex-col gap-4 rounded-xl border bg-card p-5 ${used ? '' : 'opacity-60'}`}
            >
              <legend className="px-1 text-sm font-semibold">
                Speech-to-Text{' '}
                {used
                  ? ''
                  : '(chỉ dùng khi chấm phát âm bằng Whisper hoặc tạo phụ đề qua API)'}
              </legend>
              <div className="flex flex-wrap gap-2">
                {STT_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      form.setFieldValue('sttBaseUrl', p.baseUrl)
                      form.setFieldValue('sttModel', p.model)
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field
                  name="sttModel"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? 'Bắt buộc' : undefined,
                  }}
                >
                  {(field) => (
                    <TextField
                      field={field}
                      label="Model"
                      placeholder="whisper-1"
                    />
                  )}
                </form.Field>
                <form.Field name="sttApiKey">
                  {(field) => (
                    <TextField
                      field={field}
                      label="API key"
                      type="password"
                      placeholder="Để trống nếu chạy local"
                    />
                  )}
                </form.Field>
              </div>
              <form.Field name="sttBaseUrl">
                {(field) => (
                  <TextField
                    field={field}
                    label="Base URL"
                    placeholder="Mặc định: https://api.openai.com/v1"
                  />
                )}
              </form.Field>
              <p className="text-xs text-muted-foreground">
                Endpoint cần tương thích <code>/audio/transcriptions</code> của
                OpenAI và hỗ trợ <code>verbose_json</code> với timestamp từng
                từ.
              </p>
            </fieldset>
          )}
        </form.Subscribe>

        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
        >
          {([canSubmit, isSubmitting, isDirty]) => (
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || !isDirty}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
                Lưu cài đặt
              </Button>
              {save.isSuccess && !isDirty && (
                <span className="text-sm text-ok">Đã lưu ✓</span>
              )}
              {save.error && (
                <span className="text-sm text-destructive">
                  {save.error.message}
                </span>
              )}
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

/** Trạng thái whisper.cpp + model: tải model trước để lần tạo phụ đề đầu tiên không phải chờ */
function WhisperModelStatus() {
  const queryClient = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['whisper-status'],
    queryFn: () => whisperStatus(),
    refetchInterval: (q) => (q.state.data?.model === 'downloading' ? 1000 : false),
  })
  const download = useMutation({
    mutationFn: () => downloadWhisperModel(),
    onSuccess: (fresh) => queryClient.setQueryData(['whisper-status'], fresh),
  })
  if (!status) return null

  const mb = Math.round(status.modelBytes / 1024 ** 2)
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
      {!status.binary && (
        <p className="flex items-center gap-1.5 text-destructive">
          <XCircle className="size-4 shrink-0" />
          Không tìm thấy whisper-cli trên máy chủ. Cài whisper.cpp và đặt WHISPER_CPP_PATH, hoặc dùng STT API.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Model <b>{status.modelName}</b> ({mb} MB):{' '}
          {status.model === 'ready'
            ? 'đã có trên máy'
            : status.model === 'downloading'
              ? `đang tải ${Math.round(status.progress * 100)}%`
              : 'chưa tải'}
        </span>
        {status.model === 'ready' && <CheckCircle2 className="size-4 text-ok" />}
        {status.model === 'missing' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            <Download />
            Tải model
          </Button>
        )}
      </div>
      {status.model === 'downloading' && (
        <Progress value={status.progress * 100} className="h-1.5" />
      )}
      {status.error && status.model !== 'downloading' && (
        <span className="text-xs text-destructive">{status.error}</span>
      )}
    </div>
  )
}

interface FieldLike {
  name: string
  state: { value: string; meta: { errors: unknown[] } }
  handleChange: (v: string) => void
  handleBlur: () => void
}

function TextField({
  field,
  label,
  placeholder,
  type = 'text',
}: {
  field: FieldLike
  label: string
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        type={type}
        value={field.state.value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.errors.length > 0 && (
        <span className="text-xs text-destructive">
          {field.state.meta.errors.join(', ')}
        </span>
      )}
    </div>
  )
}
