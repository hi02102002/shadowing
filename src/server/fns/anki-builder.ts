import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  enrichNotes,
  enrichVocabulary,
  generateLessonChunks,
} from '../anki-builder-ai.ts'
import { analyzeLessonUrl } from '../anki-builder-lesson.ts'

export const analyzeLesson = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      url: z.string().max(2000).optional(),
      bookSlug: z.string().max(200).optional(),
      unitNumber: z.number().int().min(1).max(200).optional(),
    }),
  )
  .handler(({ data }) => analyzeLessonUrl(data))

export const generateVocabulary = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(300)).min(1).max(12),
      topic: z.string().max(300).optional(),
      phrases: z.array(z.string().min(1).max(300)).max(300).optional(),
    }),
  )
  .handler(({ data }) => enrichVocabulary(data.words, data.topic, data.phrases))

export const generateNotes = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      notes: z
        .array(
          z.object({
            title: z.string().max(300),
            content: z.array(z.string().max(2000)).max(40),
          }),
        )
        .min(1)
        .max(6),
    }),
  )
  .handler(({ data }) => enrichNotes(data.notes))

export const generateChunks = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      words: z.array(z.string().min(1).max(300)).min(1).max(200),
      storyText: z.string().max(5000).optional(),
      topic: z.string().max(300).optional(),
    }),
  )
  .handler(({ data }) =>
    generateLessonChunks(data.words, data.storyText, data.topic),
  )
