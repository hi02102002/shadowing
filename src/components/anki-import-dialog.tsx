import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileUp, Loader2 } from 'lucide-react'

import { uploadFile } from '#/components/local-import-dialog'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { importAnkiPackage, inspectAnkiPackage } from '#/server/fns/flashcards'
import type { AnkiInspect, AnkiMapping } from '#/server/fns/flashcards'

type Notetype = AnkiInspect['notetypes'][number]
type Role = keyof AnkiMapping

const ROLES: { role: Role; label: string; required?: boolean }[] = [
  { role: 'front', label: 'Mặt trước', required: true },
  { role: 'back', label: 'Mặt sau', required: true },
  { role: 'ipa', label: 'IPA' },
  { role: 'example', label: 'Ví dụ' },
  { role: 'extra', label: 'Ghi chú' },
  { role: 'audio', label: 'Audio' },
]

const GUESS: Partial<Record<Role, RegExp>> = {
  front: /front|word|term|expression|vocab|từ|english/i,
  back: /back|meaning|definition|nghĩa|translation|vietnamese/i,
  ipa: /ipa|pronunciation|phonetic|phiên âm/i,
  example: /example|sentence|ví dụ|câu/i,
  extra: /note|extra|ghi chú/i,
  audio: /audio|sound|âm thanh/i,
}

/** đoán sẵn trường theo tên; còn thiếu mặt trước/sau thì lấy trường 0/1 */
function guessMapping(t: Notetype): AnkiMapping {
  const used = new Set<number>()
  const find = (role: Role) => {
    const i = t.fields.findIndex((name, idx) => !used.has(idx) && GUESS[role]!.test(name))
    if (i < 0) return null
    used.add(i)
    return i
  }
  const front = find('front')
  const back = find('back')
  const mapping: AnkiMapping = {
    front: front ?? 0,
    back: back ?? (t.fields.length > 1 ? (front === 1 ? 0 : 1) : 0),
    ipa: find('ipa'),
    example: find('example'),
    extra: find('extra'),
    audio: find('audio'),
  }
  // trường có [sound:] trong note mẫu → audio (bỏ qua mặt trước: thường là từ kèm âm)
  mapping.audio ??= t.soundFields.find((i) => i !== mapping.front) ?? t.soundFields.at(0) ?? null
  return mapping
}

const NONE = 'none'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (deckId: number) => void
}

export function AnkiImportDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [pkg, setPkg] = useState<(AnkiInspect & { uploadId: string }) | null>(null)
  const [deckName, setDeckName] = useState('')
  const [mappings, setMappings] = useState<Record<string, AnkiMapping | null>>({})
  const abortRef = useRef<AbortController | null>(null)

  const reset = () => {
    setFile(null)
    setProgress(0)
    setPkg(null)
    setDeckName('')
    setMappings({})
  }

  const inspect = useMutation({
    mutationFn: async (f: File) => {
      abortRef.current = new AbortController()
      setProgress(0)
      const uploadId = await uploadFile(f, setProgress, abortRef.current.signal, '/api/anki-uploads')
      return { uploadId, ...(await inspectAnkiPackage({ data: { uploadId } })) }
    },
    onSuccess: (res) => {
      setPkg(res)
      setDeckName(res.deckName)
      setMappings(Object.fromEntries(res.notetypes.map((t) => [t.id, guessMapping(t)])))
    },
  })

  const submit = useMutation({
    mutationFn: () =>
      importAnkiPackage({ data: { uploadId: pkg!.uploadId, deckName: deckName.trim(), mappings } }),
  })

  const close = (next: boolean) => {
    if (next) return onOpenChange(true)
    abortRef.current?.abort()
    if (submit.data) onImported(submit.data.deckId)
    inspect.reset()
    submit.reset()
    reset()
    onOpenChange(false)
  }

  const uploading = inspect.isPending && progress < 1
  const anyMapped = Object.values(mappings).some(Boolean)

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import deck Anki</DialogTitle>
          <DialogDescription>
            Chọn file .apkg (Anki → File → Export → Anki Deck Package). Sau đó chọn trường nào của note thành mặt
            trước, mặt sau… của thẻ. Lịch học cũ không được giữ: mọi thẻ bắt đầu là thẻ mới.
          </DialogDescription>
        </DialogHeader>

        {submit.data ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-base font-medium">Đã thêm {submit.data.added} thẻ.</p>
            {submit.data.skipped > 0 && (
              <p className="text-muted-foreground">
                Bỏ qua {submit.data.skipped} note (đã có trong bộ thẻ hoặc mặt trước trống).
              </p>
            )}
          </div>
        ) : !pkg ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (file) inspect.mutate(file)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anki-file" className="flex items-center gap-1.5">
                <FileUp className="size-4" /> File .apkg
              </Label>
              <Input
                id="anki-file"
                type="file"
                accept=".apkg"
                disabled={inspect.isPending}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {inspect.isPending && (
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <span>
                  {uploading ? `Đang tải file lên… ${Math.round(progress * 100)}%` : 'Đang đọc deck…'}
                </span>
                <Progress
                  value={uploading ? progress * 100 : 100}
                  className={uploading ? undefined : 'animate-pulse'}
                />
              </div>
            )}
            {inspect.error && inspect.error.name !== 'AbortError' && (
              <p className="text-sm text-destructive">{inspect.error.message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={!file || inspect.isPending}>
                {inspect.isPending && <Loader2 className="animate-spin" />}
                Tiếp tục
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anki-deck">Tên bộ thẻ</Label>
              <Input
                id="anki-deck"
                value={deckName}
                maxLength={120}
                onChange={(e) => setDeckName(e.target.value)}
              />
            </div>

            {pkg.notetypes.map((t) => (
              <NotetypeMapping
                key={t.id}
                notetype={t}
                mapping={mappings[t.id] ?? null}
                onChange={(m) => setMappings((prev) => ({ ...prev, [t.id]: m }))}
              />
            ))}

            {submit.error && <p className="text-sm text-destructive">{submit.error.message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Huỷ
              </Button>
              <Button
                disabled={!anyMapped || !deckName.trim() || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending && <Loader2 className="animate-spin" />}
                Import
              </Button>
            </DialogFooter>
          </div>
        )}

        {submit.data && (
          <DialogFooter>
            <Button onClick={() => close(false)}>Xong</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NotetypeMapping({
  notetype,
  mapping,
  onChange,
}: {
  notetype: Notetype
  mapping: AnkiMapping | null
  onChange: (m: AnkiMapping | null) => void
}) {
  const sample = notetype.samples[0] ?? []
  const value = (role: Role) => (mapping?.[role] == null ? '' : sample[mapping[role]] ?? '')

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <header className="flex items-center gap-2">
        <span className="font-medium">{notetype.name}</span>
        <span className="text-xs text-muted-foreground">{notetype.noteCount} note</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch
            checked={!!mapping}
            onCheckedChange={(on) => onChange(on ? guessMapping(notetype) : null)}
          />
          Import
        </label>
      </header>

      {mapping && (
        <>
          <div className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
            {ROLES.map(({ role, label, required }) => (
              <RoleSelect
                key={role}
                label={label}
                required={required}
                fields={notetype.fields}
                value={mapping[role]}
                onChange={(i) => onChange({ ...mapping, [role]: i })}
              />
            ))}
          </div>

          {/* xem trước thẻ của note mẫu đầu tiên */}
          <div className="grid gap-2 rounded-md bg-muted/60 p-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Mặt trước</div>
              <div className="font-semibold whitespace-pre-line">{value('front') || '—'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">Mặt sau</div>
              {value('ipa') && <div className="ipa text-muted-foreground">{value('ipa')}</div>}
              <div className="whitespace-pre-line">{value('back') || '—'}</div>
              {value('example') && <div className="text-muted-foreground italic">{value('example')}</div>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function RoleSelect({
  label,
  required,
  fields,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  fields: string[]
  value: number | null
  onChange: (i: number | null) => void
}) {
  return (
    <>
      <span className="text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      <Select
        value={value == null ? NONE : String(value)}
        onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
      >
        <SelectTrigger className="h-8 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>— Không dùng —</SelectItem>}
          {fields.map((name, i) => (
            <SelectItem key={i} value={String(i)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
