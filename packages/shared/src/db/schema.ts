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

// ─── Battle tables ──────────────────────────────────────────────────

export const creatureBattleStats = sqliteTable('creature_battle_stats', {
  creatureId: text('creature_id')
    .primaryKey()
    .references(() => creature.id),
  role: text('role').notNull(), // striker | tank | support | bruiser
  hp: integer('hp').notNull(),
  atk: integer('atk').notNull(),
  def: integer('def').notNull(),
  spd: integer('spd').notNull(),
})

// Ability templates are defined in code (battle/constants.ts), not in DB.
// creatureAbility.templateId references template IDs from constants.

export const creatureAbility = sqliteTable(
  'creature_ability',
  {
    id: text('id').primaryKey(),
    creatureId: text('creature_id')
      .notNull()
      .references(() => creature.id),
    templateId: text('template_id').notNull(), // references ACTIVE/PASSIVE_ABILITY_TEMPLATES in constants.ts
    slot: text('slot').notNull(), // active | passive
    displayName: text('display_name').notNull(),
  },
  (table) => [
    uniqueIndex('ca_creature_slot_idx').on(table.creatureId, table.slot),
    index('ca_creature_id_idx').on(table.creatureId),
  ],
)

export const battleChallenge = sqliteTable(
  'battle_challenge',
  {
    id: text('id').primaryKey(),
    challengerId: text('challenger_id')
      .notNull()
      .references(() => user.id),
    defenderId: text('defender_id')
      .notNull()
      .references(() => user.id),
    status: text('status').notNull(), // pending | resolved | declined | expired | cancelled
    challengerTeam: text('challenger_team').notNull(), // JSON: [{userCreatureId, row}]
    defenderTeam: text('defender_team'), // JSON, null until accepted
    result: text('result'), // JSON battle log, null until resolved
    winnerId: text('winner_id').references(() => user.id),
    discordMessageId: text('discord_message_id'),
    discordChannelId: text('discord_channel_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('bc_challenger_id_idx').on(table.challengerId),
    index('bc_defender_id_idx').on(table.defenderId),
    index('bc_status_idx').on(table.status),
  ],
)

export const battleRating = sqliteTable('battle_rating', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  rating: integer('rating').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export const battleTeamPreset = sqliteTable(
  'battle_team_preset',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    members: text('members').notNull(), // JSON: [{userCreatureId, creatureId, row}]
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [index('btp_user_id_idx').on(table.userId)],
)
