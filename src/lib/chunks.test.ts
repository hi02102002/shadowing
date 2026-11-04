import { describe, expect, it } from 'vitest'

import seed from '#/chunks-data/chunks.seed.json'
import { CHUNK_SOURCES } from '#/chunks-data/chunk-sources'
import { CHUNK_LEVELS, CHUNK_TOPICS } from './chunks'
import type { ChunkSeed } from './chunks'

const chunks = seed as ChunkSeed[]

describe('chunk seed', () => {
  it('contains an uncapped source-only corpus across A1-C1', () => {
    expect(chunks.length).toBeGreaterThan(0)
    for (const level of CHUNK_LEVELS)
      expect(chunks.some((chunk) => chunk.level === level)).toBe(true)
    expect(seed.every((chunk) => chunk.sourceVerified === true)).toBe(true)
  })

  it('has unique ids and text+sense pairs', () => {
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length)
    expect(
      new Set(
        chunks.map(
          (chunk) =>
            `${chunk.normalizedText}|${chunk.sense.toLocaleLowerCase('vi')}`,
        ),
      ).size,
    ).toBe(chunks.length)
  })

  it('covers every topic with complete Vietnamese learning content', () => {
    for (const topic of CHUNK_TOPICS)
      expect(chunks.some((chunk) => chunk.topic === topic)).toBe(true)
    expect(
      chunks.every(
        (chunk) =>
          // cụm từ WordNet có định nghĩa tiếng Anh, khung câu chỉ có câu ví dụ Anh–Việt
          (!!chunk.meaningVi?.trim() ||
            !!chunk.definitionEn?.trim() ||
            chunk.kind === 'sentence-frame') &&
          chunk.exampleEn.trim().length > 0 &&
          chunk.exampleVi.trim().length > 0,
      ),
    ).toBe(true)
  })

  it('phrase chunks keep every example sentence credited on Tatoeba', () => {
    const phrases = chunks.filter((chunk) => chunk.examples.length)
    expect(phrases.length).toBeGreaterThan(0)
    for (const chunk of phrases) {
      const ids = new Set(chunk.attributions.map((a) => a.sourceId))
      for (const example of chunk.examples) {
        expect(ids.has(example.enId)).toBe(true)
        expect(ids.has(example.viId)).toBe(true)
      }
      expect(chunk.exampleEn).toBe(chunk.examples[0].en)
    }
  })

  it('requires sourced English, Vietnamese and CEFR metadata', () => {
    const sourcePolicy = new Map(
      CHUNK_SOURCES.map((source) => [source.id, source]),
    )
    for (const chunk of chunks) {
      const roles = new Set(chunk.attributions.map(({ role }) => role))
      expect(roles.has('content')).toBe(true)
      expect(roles.has('translation')).toBe(true)
      expect(roles.has('level')).toBe(true)
      for (const attribution of chunk.attributions) {
        const source = sourcePolicy.get(attribution.source)
        expect(source, attribution.source).toBeDefined()
        expect(source?.usage).toBe('active')
        expect(attribution.source).not.toBe('authored')
        expect(attribution.sourceId).not.toBeNull()
        expect(attribution.author).not.toBeNull()
        expect(() => new URL(attribution.sourceUrl)).not.toThrow()
        expect(attribution.attribution.trim()).not.toBe('')
      }
    }
  })
})
