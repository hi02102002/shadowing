import { describe, expect, it } from 'vitest'

import { parseEllloUrl, parseVideoSource, vimeoIdFromKey, vimeoKey } from './video-source.ts'

const ELLLO = 'https://elllo.org/video/A1BEG/A1-050-JULIE-WHO-IS-YOUR-FRIEND.html'

describe('parseVideoSource', () => {
  it('nhận link YouTube', () => {
    expect(parseVideoSource('https://youtu.be/arj7oStGLkU')).toEqual({ kind: 'youtube', id: 'arj7oStGLkU' })
  })

  it.each([ELLLO, `${ELLLO}#view2`, 'http://www.elllo.org/video/A1BEG/A1-050-JULIE-WHO-IS-YOUR-FRIEND.html?x=1', 'elllo.org/video/A1BEG/A1-050-JULIE-WHO-IS-YOUR-FRIEND.html'])(
    'nhận bài elllo %s',
    (input) => {
      expect(parseVideoSource(input)).toEqual({ kind: 'elllo', url: ELLLO })
    },
  )

  it.each(['https://elllo.org/', 'https://example.org/a.html', 'not a url'])('từ chối %s', (input) => {
    expect(parseVideoSource(input)).toBeNull()
    expect(parseEllloUrl(input)).toBeNull()
  })
})

describe('vimeo key', () => {
  it('tách được id', () => {
    expect(vimeoIdFromKey(vimeoKey('1056637481'))).toBe('1056637481')
    expect(vimeoIdFromKey('arj7oStGLkU')).toBeNull()
  })
})
