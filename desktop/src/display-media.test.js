import assert from 'node:assert/strict'
import test from 'node:test'

import { selectDisplayMediaStreams } from './display-media.js'

test('records audio playing in the Shadowing window on Linux', () => {
  const source = { id: 'window:1:0', name: 'Shadowing' }
  const frame = { id: 1 }

  assert.deepEqual(
    selectDisplayMediaStreams(source, { audioRequested: true, frame }, 'linux'),
    { video: source, audio: frame, enableLocalEcho: true },
  )
})

test('keeps Windows system loopback audio', () => {
  const source = { id: 'window:1:0', name: 'Shadowing' }

  assert.deepEqual(
    selectDisplayMediaStreams(
      source,
      { audioRequested: true, frame: null },
      'win32',
    ),
    { video: source, audio: 'loopback' },
  )
})

test('omits audio when it was not requested', () => {
  const source = { id: 'window:1:0', name: 'Shadowing' }
  const frame = { id: 1 }

  assert.deepEqual(
    selectDisplayMediaStreams(
      source,
      { audioRequested: false, frame },
      'linux',
    ),
    { video: source },
  )
})

test('lets the renderer use its monitor fallback if the frame is unavailable', () => {
  const source = { id: 'window:1:0', name: 'Shadowing' }

  assert.deepEqual(
    selectDisplayMediaStreams(
      source,
      { audioRequested: true, frame: null },
      'linux',
    ),
    { video: source },
  )
})
