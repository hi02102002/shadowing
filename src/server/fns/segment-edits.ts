import { createServerFn } from '@tanstack/react-start'

import { applySegmentEdit, EditInput } from '../segment-edits.ts'

export const editSegments = createServerFn({ method: 'POST' })
  .validator(EditInput)
  .handler(async ({ data }) => applySegmentEdit(data))
