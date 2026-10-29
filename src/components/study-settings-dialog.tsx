import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

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
import { settingsQuery } from '#/lib/queries'
import { saveSettings } from '#/server/fns/settings'

const FIELDS = [
  {
    key: 'newPerDay',
    label: 'Từ mới mỗi ngày',
    hint: 'Số thẻ mới tối đa được học trong một ngày (tính riêng cho từng bộ hoặc khi học tất cả).',
    min: 0,
    max: 1000,
  },
  {
    key: 'reviewsPerDay',
    label: 'Lượt ôn mỗi ngày',
    hint: 'Số thẻ đến hạn ôn tối đa mỗi ngày. Thẻ đang học dở (vừa chọn Quên/Khó) không tính vào đây.',
    min: 0,
    max: 9999,
  },
  {
    key: 'wordsPerGroup',
    label: 'Số từ mỗi nhóm',
    hint: 'Khi thêm sách từ vựng, unit dài được chia thành các bộ tối đa chừng này từ (vd. 100 từ, 25 → 4 bộ).',
    min: 5,
    max: 200,
  },
] as const

type Key = (typeof FIELDS)[number]['key']

export function StudySettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data } = useQuery(settingsQuery())
  const [values, setValues] = useState<Record<Key, string>>({ newPerDay: '', reviewsPerDay: '', wordsPerGroup: '' })

  useEffect(() => {
    if (open && data)
      setValues({
        newPerDay: String(data.newPerDay),
        reviewsPerDay: String(data.reviewsPerDay),
        wordsPerGroup: String(data.wordsPerGroup),
      })
  }, [open, data])

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          newPerDay: Number(values.newPerDay),
          reviewsPerDay: Number(values.reviewsPerDay),
          wordsPerGroup: Number(values.wordsPerGroup),
        },
      }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(settingsQuery().queryKey, fresh)
      void queryClient.invalidateQueries({ queryKey: ['study-queue'] })
      onOpenChange(false)
    },
  })

  const valid = FIELDS.every((f) => {
    const n = Number(values[f.key])
    return values[f.key] !== '' && Number.isInteger(n) && n >= f.min && n <= f.max
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt học</DialogTitle>
          <DialogDescription>Giới hạn mỗi ngày cho thẻ từ và cách chia nhóm khi thêm sách.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) save.mutate()
          }}
        >
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`study-${f.key}`}>{f.label}</Label>
              <Input
                id={`study-${f.key}`}
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
          {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
