import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { listCatalog } from '#/server/fns/catalog.ts'
import type { CatalogSource } from '#/server/fns/catalog.ts'
import { dictationHistory } from '#/server/fns/dictation.ts'
import {
  pronunciationEngines,
  pronunciationHistory,
} from '#/server/fns/pronunciation.ts'
import { getEssentialBook, listEssentialBooks } from '#/server/fns/essential.ts'
import { listCards, listDecks, studyQueue } from '#/server/fns/flashcards.ts'
import { listMistakes, practiceStats } from '#/server/fns/review.ts'
import { activityStats } from '#/server/fns/stats.ts'
import { getConversation, listConversations } from '#/server/fns/conversation.ts'
import { getSpeakingAttempt, listSpeakingAttempts } from '#/server/fns/speaking.ts'
import { getGrammarUnit, listGrammarUnits } from '#/server/fns/grammar.ts'
import { getSettings } from '#/server/fns/settings.ts'
import { getVideo, listVideos } from '#/server/fns/videos.ts'
import { videoPhrases, videoVocab, vocabMeanings } from '#/server/fns/vocab.ts'
import type { Level } from './levels.ts'

export const videosQuery = () =>
  queryOptions({
    queryKey: ['videos'],
    queryFn: () => listVideos(),
  })

export const videoQuery = (youtubeId: string) =>
  queryOptions({
    queryKey: ['video', youtubeId],
    queryFn: () => getVideo({ data: { youtubeId } }),
    staleTime: 60_000,
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: ['settings'],
    queryFn: () => getSettings(),
  })

export const statsQuery = () =>
  queryOptions({
    queryKey: ['stats'],
    queryFn: () => practiceStats(),
  })

export const mistakesQueryKey = ['mistakes'] as const
export const fetchMistakes = () => listMistakes()

export const dictationHistoryQuery = (segmentId: number) =>
  queryOptions({
    queryKey: ['dictation-history', segmentId],
    queryFn: () => dictationHistory({ data: { segmentId } }),
  })

export const pronunciationHistoryQuery = (segmentId: number) =>
  queryOptions({
    queryKey: ['pronunciation-history', segmentId],
    queryFn: () => pronunciationHistory({ data: { segmentId } }),
  })

export const catalogQuery = (
  source: CatalogSource,
  level: Level,
  page: number,
  q?: string,
) =>
  queryOptions({
    queryKey: ['catalog', source, level, page, q ?? ''],
    queryFn: () => listCatalog({ data: { source, level, page, q } }),
    staleTime: 60 * 60_000,
    // lật trang: giữ trang cũ trên màn hình tới khi trang mới về
    placeholderData: keepPreviousData,
  })

export const pronunciationEnginesQuery = () =>
  queryOptions({
    queryKey: ['pronunciation-engines'],
    queryFn: () => pronunciationEngines(),
  })

export const decksQuery = () =>
  queryOptions({
    queryKey: ['decks'],
    queryFn: () => listDecks(),
  })

export const cardsQuery = (deckId: number) =>
  queryOptions({
    queryKey: ['cards', deckId],
    queryFn: () => listCards({ data: { deckId } }),
  })

export const studyQueueQuery = (deckId?: number, book?: string) =>
  queryOptions({
    queryKey: ['study-queue', deckId ?? book ?? 'all'],
    queryFn: () => studyQueue({ data: { deckId, book } }),
    // hàng đợi chỉ lấy một lần mỗi phiên học, không tự refetch làm nhảy thẻ
    staleTime: Infinity,
    gcTime: 0,
  })

export const essentialBooksQuery = () =>
  queryOptions({
    queryKey: ['essential-books'],
    queryFn: () => listEssentialBooks(),
  })

export const essentialBookQuery = (slug: string) =>
  queryOptions({
    queryKey: ['essential-book', slug],
    queryFn: () => getEssentialBook({ data: { slug } }),
  })

export const grammarUnitsQuery = () =>
  queryOptions({
    queryKey: ['grammar-units'],
    queryFn: () => listGrammarUnits(),
  })

export const grammarUnitQuery = (unitId: string) =>
  queryOptions({
    queryKey: ['grammar-unit', unitId],
    queryFn: () => getGrammarUnit({ data: { unitId } }),
  })

export const videoVocabQuery = (youtubeId: string) =>
  queryOptions({
    queryKey: ['video-vocab', youtubeId],
    queryFn: () => videoVocab({ data: { youtubeId } }),
    staleTime: 60_000,
  })

/** cụm từ do AI chọn đã cache ở server (không tự gọi AI; bấm nút mới tìm) */
export const videoPhrasesQuery = (youtubeId: string) =>
  queryOptions({
    queryKey: ['video-phrases', youtubeId],
    queryFn: () => videoPhrases({ data: { youtubeId, generate: false } }),
    staleTime: Infinity,
    retry: false,
  })

/** nghĩa tiếng Việt ngắn cho các từ của video (từ điển đã cache hoặc Google Dịch cả lô) */
export const vocabMeaningsQuery = (youtubeId: string, words: string[]) =>
  queryOptions({
    queryKey: ['vocab-meanings', youtubeId, words.length],
    queryFn: () => vocabMeanings({ data: { words } }),
    enabled: words.length > 0,
    staleTime: Infinity,
    retry: false,
  })

/** trang Thống kê: chuỗi ngày, lịch hoạt động, xu hướng điểm */
export const activityStatsQuery = () =>
  queryOptions({
    queryKey: ['activity-stats'],
    queryFn: () => activityStats(),
  })

export const conversationsQuery = () =>
  queryOptions({ queryKey: ['conversations'], queryFn: () => listConversations() })

export const conversationQuery = (id: number) =>
  queryOptions({ queryKey: ['conversation', id], queryFn: () => getConversation({ data: { id } }) })

export const speakingAttemptsQuery = () =>
  queryOptions({ queryKey: ['speaking-attempts'], queryFn: () => listSpeakingAttempts() })

export const speakingAttemptQuery = (id: number) =>
  queryOptions({ queryKey: ['speaking-attempt', id], queryFn: () => getSpeakingAttempt({ data: { id } }) })
