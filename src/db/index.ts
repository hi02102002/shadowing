import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from './schema.ts'

const url = process.env.DATABASE_URL ?? 'data/app.db'
fs.mkdirSync(path.dirname(path.resolve(url)), { recursive: true })

const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: path.resolve('drizzle') })
