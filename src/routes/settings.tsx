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
  RefreshCw,
  RotateCw,
  Save,
  XCircle,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import { Switch } from '#/components/ui/switch'
import { desktopBridge, useDesktopUpdate } from '#/lib/desktop'
import { settingsQuery } from '#/lib/queries'
import { downloadWhisperModel, whisperStatus } from '#/server/fns/captions'
import { saveSettings, testLlm } from '#/server/fns/settings'
import type { PublicSettings } from '#/server/fns/settings'
import { ACCENT_DEPENDENT_KEYS } from '#/hooks/use-app-settings'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { QUICK_LOOKUP_OFF_KEY } from '#/components/quick-lookup'

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

const ACCENT_OPTIONS = [
  {
    value: 'us',
    label: 'Giọng Mỹ (US)',
    desc: 'General American: /ˈwɑːtɚ/, phát âm rõ âm r cuối.',
  },
  {
    value: 'uk',
    label: 'Giọng Anh (UK)',
    desc: 'British RP: /ˈwɔːtə/, không phát âm r cuối âm tiết.',
  },
] as const satisfies ReadonlyArray<{
  value: PublicSettings['accent']
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

const WHISPER_MODELS = [
  {
    value: 'large-v3-turbo',
    label: 'large-v3-turbo (574 MB)',
    desc: 'Chính xác gần bằng Whisper lớn nhất, nghe tốt giọng nhanh và nhiều tiếng ồn. Chậm hơn small khoảng 2 lần.',
  },
  {
    value: 'small.en',
    label: 'small.en (265 MB)',
    desc: 'Nhanh, nhẹ, hợp máy yếu, nhưng hay nghe nhầm từ hơn.',
  },
] as const satisfies ReadonlyArray<{
  value: PublicSettings['whisperModel']
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
      for (const queryKey of ACCENT_DEPENDENT_KEYS) void queryClient.invalidateQueries({ queryKey })
      // đổi model Whisper → trạng thái tải model khác
      void queryClient.invalidateQueries({ queryKey: ['whisper-status'] })
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
          <legend className="px-1 text-sm font-semibold">AI phân tích lỗi</legend>
          <form.Field name="aiAnalysis">
            {(field) => (
              <div className="flex items-start gap-3">
                <Switch
                  id={field.name}
                  checked={field.state.value === 'on'}
                  onCheckedChange={(on) => field.handleChange(on ? 'on' : 'off')}
                />
                <Label htmlFor={field.name} className="flex flex-col items-start gap-1 font-normal">
                  <span className="font-medium">Tự động phân tích sau mỗi lần chấm</span>
                  <span className="text-xs text-muted-foreground">
                    Bật: AI giải thích lỗi và ghi vào Sổ lỗi ngay sau khi chấm phát âm / chép chính tả. Tắt: vẫn có
                    điểm và so từng từ, chỉ gọi AI khi bạn bấm &quot;Nhờ AI phân tích lỗi&quot; (tiết kiệm lượt gọi API).
                  </span>
                </Label>
              </div>
            )}
          </form.Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">Giọng chuẩn</legend>
          <p className="text-xs text-muted-foreground">
            Áp dụng cho cả app: phiên âm IPA dưới câu, giọng đọc mẫu khi tra từ, cách AI chấm và nhận xét phát âm.
          </p>
          <form.Field name="accent">
            {(field) => (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {ACCENT_OPTIONS.map((e) => (
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
          <form.Field name="whisperModel">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Model Whisper tạo phụ đề (chấm phát âm trên máy luôn dùng small.en cho nhanh)</span>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                  {WHISPER_MODELS.map((m) => (
                    <label
                      key={m.value}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        field.state.value === m.value ? 'border-primary bg-accent/50' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name={field.name}
                          value={m.value}
                          checked={field.state.value === m.value}
                          onChange={() => field.handleChange(m.value)}
                        />
                        {m.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.desc}</span>
                    </label>
                  ))}
                </div>
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

      <QuickLookupSetting />

      <AppVersion />
    </div>
  )
}

/** bật/tắt tra từ nhanh toàn app (lưu trong trình duyệt, không cần bấm Lưu cài đặt) */
function QuickLookupSetting() {
  const [off, setOff] = useStoredToggle(QUICK_LOOKUP_OFF_KEY)
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border bg-card p-5">
      <legend className="px-1 text-sm font-semibold">Tra từ nhanh</legend>
      <label className="flex items-start gap-3 text-sm">
        <Switch checked={!off} onCheckedChange={(on) => setOff(!on)} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Nhấp đúp hoặc bôi đen từ tiếng Anh ở bất kỳ trang nào để tra nghĩa</span>
          <span className="text-xs text-muted-foreground">
            Nhấp đúp: mở thẻ tra từ ngay. Bôi đen một cụm: hiện nút “Tra” cạnh chỗ chọn. Thẻ dùng từ điển, nghĩa AI theo
            câu chỉ tra khi bạn bấm.
          </span>
        </span>
      </label>
    </fieldset>
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

/** Phiên bản app desktop + cập nhật khi người dùng bấm (không tự tải / tự cài) */
function AppVersion() {
  const update = useDesktopUpdate()
  const bridge = desktopBridge()

  return (
    <section id="update" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">Phiên bản</h2>
      {!update || !bridge ? (
        <p className="text-sm text-muted-foreground">
          Đang chạy bản web. Cập nhật bằng cách kéo code mới (git pull) hoặc build lại image Docker.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Đang dùng <b>Shadowing {update.currentVersion}</b>
            </span>
            {update.status === 'up-to-date' && (
              <span className="flex items-center gap-1 text-ok">
                <CheckCircle2 className="size-4" /> Đã là bản mới nhất
              </span>
            )}
            {(update.status === 'available' || update.status === 'downloading' || update.status === 'downloaded') &&
              update.latestVersion && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  Có bản mới {update.latestVersion}
                </span>
              )}
          </div>

          {update.status === 'downloading' && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Progress value={update.progress * 100} className="h-1.5" />
              <span className="shrink-0 font-mono text-xs">{Math.round(update.progress * 100)}%</span>
            </div>
          )}
          {update.status === 'error' && update.error && (
            <p className="text-xs text-destructive">Không cập nhật được: {update.error}</p>
          )}
          {update.status === 'dev' && (
            <p className="text-xs text-muted-foreground">Bản đang chạy từ mã nguồn, chỉ bản đã cài mới cập nhật.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {update.status === 'available' && update.canInstall && (
              <Button type="button" size="sm" onClick={() => void bridge.updater.download()}>
                <Download />
                Cập nhật lên {update.latestVersion}
              </Button>
            )}
            {update.status === 'available' && !update.canInstall && (
              <Button type="button" size="sm" onClick={() => void bridge.updater.openRelease()}>
                <Download />
                Tải bản {update.latestVersion}
              </Button>
            )}
            {update.status === 'downloaded' && (
              <Button type="button" size="sm" onClick={() => void bridge.updater.install()}>
                <RotateCw />
                Khởi động lại để cài {update.latestVersion}
              </Button>
            )}
            {update.status !== 'dev' && update.status !== 'downloading' && update.status !== 'downloaded' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={update.status === 'checking'}
                onClick={() => void bridge.updater.check()}
              >
                {update.status === 'checking' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {update.status === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra cập nhật'}
              </Button>
            )}
            {update.latestVersion && (
              <Button type="button" size="sm" variant="ghost" onClick={() => void bridge.updater.openRelease()}>
                Có gì mới?
              </Button>
            )}
          </div>
          {update.status === 'downloaded' && navigator.userAgent.includes('Linux') && (
            <p className="text-xs text-muted-foreground">Bản cài .deb sẽ hỏi mật khẩu máy khi cài.</p>
          )}
        </>
      )}
    </section>
  )
}
