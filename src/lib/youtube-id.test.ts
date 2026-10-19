import { describe, expect, it } from 'vitest'

import { parseYouTubeId } from './youtube-id.ts'

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=arj7oStGLkU', 'arj7oStGLkU'],
    ['https://youtube.com/watch?feature=share&v=arj7oStGLkU&t=42', 'arj7oStGLkU'],
    ['https://youtu.be/arj7oStGLkU?t=10', 'arj7oStGLkU'],
    ['https://www.youtube.com/shorts/arj7oStGLkU', 'arj7oStGLkU'],
    ['https://m.youtube.com/watch?v=arj7oStGLkU', 'arj7oStGLkU'],
    ['https://www.youtube.com/embed/arj7oStGLkU', 'arj7oStGLkU'],
    ['https://www.youtube.com/live/arj7oStGLkU?si=x', 'arj7oStGLkU'],
    ['youtube.com/watch?v=arj7oStGLkU', 'arj7oStGLkU'],
    ['arj7oStGLkU', 'arj7oStGLkU'],
  ])('%s', (input, id) => {
    expect(parseYouTubeId(input)).toBe(id)
  })

  it.each(['https://vimeo.com/123', 'not a url', 'https://youtube.com/watch?v=short'])('từ chối %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull()
  })
})
