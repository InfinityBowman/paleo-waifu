import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Better-Auth tables ──────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
  image: text('image'),
  role: text('role').default('user'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('banReason'),
  banExpires: integer('banExpires', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonatedBy'),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

// ─── Game tables ─────────────────────────────────────────────────────

export const creature = sqliteTable(
  'creature',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    scientificName: text('scientific_name').notNull(),
    era: text('era').notNull(),
    period: text('period'),
    diet: text('diet').notNull(),
    sizeMeters: real('size_meters'),
    weightKg: real('weight_kg'),
    rarity: text('rarity').notNull(), // common | uncommon | rare | epic | legendary
    description: text('description').notNull(),
    funFacts: text('fun_facts'), // JSON array of strings
    imageUrl: text('image_url'),
    imageAspectRatio: real('image_aspect_ratio'),
    source: text('source'),
    type: text('type'),
    foundIn: text('found_in'),
    nameMeaning: text('name_meaning'),
    pronunciation: text('pronunciation'),
    wikipediaImageUrl: text('wikipedia_image_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    index('creature_rarity_idx').on(table.rarity),
    index('creature_name_idx').on(table.name),
    index('creature_era_idx').on(table.era),
  ],
)

export const banner = sqliteTable('banner', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  rateUpId: text('rate_up_id').references(() => creature.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const bannerPool = sqliteTable(
  'banner_pool',
  {
    id: text('id').primaryKey(),
    bannerId: text('banner_id')
      .notNull()
      .references(() => banner.id, { onDelete: 'cascade' }),
    creatureId: text('creature_id')
      .notNull()
      .references(() => creature.id, { onDelete: 'cascade' }),
  },
  (table) => [index('bp_banner_id_idx').on(table.bannerId)],
)

export const userCreature = sqliteTable(
  'user_creature',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    creatureId: text('creature_id')
      .notNull()
      .references(() => creature.id),
    bannerId: text('banner_id').references(() => banner.id),
    pulledAt: integer('pulled_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  },
  (table) => [index('uc_user_id_idx').on(table.userId)],
)

export const currency = sqliteTable('currency', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  fossils: integer('fossils').default(0).notNull(),
  lastDailyClaim: integer('last_daily_claim', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const pityCounter = sqliteTable(
  'pity_counter',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bannerId: text('banner_id')
      .notNull()
      .references(() => banner.id),
    pullsSinceRare: integer('pulls_since_rare').default(0).notNull(),
    pullsSinceLegendary: integer('pulls_since_legendary').default(0).notNull(),
    totalPulls: integer('total_pulls').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('pity_user_banner_idx').on(table.userId, table.bannerId),
  ],
)

export const tradeOffer = sqliteTable(
  'trade_offer',
  {
    id: text('id').primaryKey(),
    offererId: text('offerer_id')
      .notNull()
      .references(() => user.id),
    receiverId: text('receiver_id').references(() => user.id),
    offeredCreatureId: text('offered_creature_id')
      .notNull()
      .references(() => userCreature.id),
    receiverCreatureId: text('receiver_creature_id').references(
      () => userCreature.id,
    ),
    wantedCreatureId: text('wanted_creature_id').references(() => creature.id),
    status: text('status').notNull().default('open'), // open | pending | accepted | cancelled | expired
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('trade_offer_status_idx').on(table.status),
    index('trade_offer_offerer_idx').on(table.offererId),
    index('trade_offer_receiver_idx').on(table.receiverId),
  ],
)

export const tradeHistory = sqliteTable(
  'trade_history',
  {
    id: text('id').primaryKey(),
    tradeOfferId: text('trade_offer_id')
      .notNull()
      .references(() => tradeOffer.id),
    giverId: text('giver_id')
      .notNull()
      .references(() => user.id),
    receiverId: text('receiver_id')
      .notNull()
      .references(() => user.id),
    givenCreatureId: text('given_creature_id')
      .notNull()
      .references(() => userCreature.id),
    receivedCreatureId: text('received_creature_id')
      .notNull()
      .references(() => userCreature.id),
    completedAt: integer('completed_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    index('th_giver_id_idx').on(table.giverId),
    index('th_receiver_id_idx').on(table.receiverId),
  ],
)

export const tradeProposal = sqliteTable(
  'trade_proposal',
  {
    id: text('id').primaryKey(),
    tradeId: text('trade_id')
      .notNull()
      .references(() => tradeOffer.id, { onDelete: 'cascade' }),
    proposerId: text('proposer_id')
      .notNull()
      .references(() => user.id),
    proposerCreatureId: text('proposer_creature_id')
      .notNull()
      .references(() => userCreature.id),
    status: text('status').notNull().default('pending'), // pending | accepted | withdrawn | cancelled
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    uniqueIndex('tp_trade_proposer_idx').on(table.tradeId, table.proposerId),
    index('tp_trade_id_idx').on(table.tradeId),
    index('tp_proposer_id_idx').on(table.proposerId),
  ],
)

export const userXp = sqliteTable('user_xp', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(0).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const wishlist = sqliteTable(
  'wishlist',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    creatureId: text('creature_id')
      .notNull()
      .references(() => creature.id),
  },
  (table) => [
    uniqueIndex('wishlist_user_creature_idx').on(
      table.userId,
      table.creatureId,
    ),
  ],
)
