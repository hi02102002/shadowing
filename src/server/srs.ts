/** Lịch ôn thẻ bằng FSRS (thuật toán mặc định của Anki hiện nay) */
import { Rating, fsrs } from 'ts-fsrs'
import type { Card as FsrsCard, Grade } from 'ts-fsrs'

import type { Card } from '#/db/schema.ts'
import { formatInterval } from '#/lib/format.ts'

export const scheduler = fsrs({ enable_fuzz: true })

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

type SrsFields = Pick<
  Card,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsedDays'
  | 'scheduledDays'
  | 'learningSteps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'lastReview'
>

export function toFsrsCard(row: SrsFields): FsrsCard {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  }
}

export function fromFsrsCard(card: FsrsCard): SrsFields {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  }
}

/** khoảng thời gian tới lần ôn sau cho từng mức Again/Hard/Good/Easy */
export function previewIntervals(row: SrsFields, now = new Date()): Record<Grade, string> {
  const preview = scheduler.repeat(toFsrsCard(row), now)
  return Object.fromEntries(
    GRADES.map((g) => [g, formatInterval(preview[g].card.due.getTime() - now.getTime())]),
  ) as Record<Grade, string>
}

export function review(row: SrsFields, grade: Grade, now = new Date()) {
  const { card, log } = scheduler.next(toFsrsCard(row), now, grade)
  return { fields: fromFsrsCard(card), log }
}
