import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

export type Database = DrizzleD1Database<typeof schema>

export async function createDb(d1: D1Database): Promise<Database> {
  await d1.exec('PRAGMA foreign_keys = ON')
  return drizzle(d1, { schema })
}
