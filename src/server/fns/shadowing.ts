import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  SHADOWING_LEVELS,
  normalizeShadowingSet,
} from '#/lib/shadowing-basics.ts'
import {
  ShadowingSetSchema,
  shadowingSetPrompt,
  shadowingSetSystem,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'

/** AI soạn bộ câu cho 4 trụ cột shadowing theo chủ đề (vd chủ đề nhiệm vụ trong lộ trình) */
export const generateShadowingSet = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topic: z.string().trim().min(1).max(200),
      level: z.enum(SHADOWING_LEVELS),
    }),
  )
  .handler(async ({ data }) =>
    normalizeShadowingSet(
      await structured({
        feature: 'shadowing',
        system: shadowingSetSystem,
        prompt: shadowingSetPrompt(data),
        schema: ShadowingSetSchema,
      }),
    ),
  )
