import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'

import { deleteMistake } from '#/server/fns/review.ts'
import type { MistakeRow } from '#/server/fns/review.ts'
import { fetchMistakes, mistakesQueryKey } from './queries.ts'

function createMistakesCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'mistakes',
      queryKey: [...mistakesQueryKey],
      queryFn: async () => fetchMistakes(),
      select: (rows: MistakeRow[]) => rows,
      queryClient,
      getKey: (m: MistakeRow) => m.id,
      // xoá lạc quan: UI cập nhật ngay, rollback nếu server lỗi
      onDelete: async ({ transaction }) => {
        await Promise.all(transaction.mutations.map((m) => deleteMistake({ data: { id: m.key } })))
      },
    }),
  )
}

let mistakes: ReturnType<typeof createMistakesCollection> | null = null

/** Collection chỉ dùng phía client (route /review tắt SSR) */
export function getMistakesCollection(queryClient: QueryClient) {
  mistakes ??= createMistakesCollection(queryClient)
  return mistakes
}
