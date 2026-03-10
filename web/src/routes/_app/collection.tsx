import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq, inArray, sql } from 'drizzle-orm'
import { createDb } from '@paleo-waifu/shared/db/client'
import { ALL_ABILITY_TEMPLATES } from '@paleo-waifu/shared/battle/constants'
import {
  creature,
  creatureAbility,
  creatureBattleStats,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import type { BattleStatsData } from '@/components/shared/BattleStatsPanel'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import { CollectionGrid } from '@/components/collection/CollectionGrid'

const TEMPLATE_MAP = new Map(ALL_ABILITY_TEMPLATES.map((t) => [t.id, t]))

const getCollection = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)

    const owned = await db
      .select({
        id: userCreature.id,
        creatureId: userCreature.creatureId,
        pulledAt: userCreature.pulledAt,
        isFavorite: userCreature.isFavorite,
        name: creature.name,
        scientificName: creature.scientificName,
        rarity: creature.rarity,
        era: creature.era,
        diet: creature.diet,
        imageUrl: creature.imageUrl,
        imageAspectRatio: creature.imageAspectRatio,
        description: creature.description,
        isBattleReady:
          sql<boolean>`${creatureBattleStats.creatureId} IS NOT NULL`.as(
            'is_battle_ready',
          ),
        role: creatureBattleStats.role,
        hp: creatureBattleStats.hp,
        atk: creatureBattleStats.atk,
        def: creatureBattleStats.def,
        spd: creatureBattleStats.spd,
      })
      .from(userCreature)
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .leftJoin(
        creatureBattleStats,
        eq(creatureBattleStats.creatureId, creature.id),
      )
      .where(eq(userCreature.userId, userId))
      .all()

    // Load abilities for battle-ready creatures
    const battleCreatureIds = [
      ...new Set(owned.filter((r) => r.role).map((r) => r.creatureId)),
    ]
    const abilities =
      battleCreatureIds.length > 0
        ? await db
            .select({
              creatureId: creatureAbility.creatureId,
              templateId: creatureAbility.templateId,
              slot: creatureAbility.slot,
              displayName: creatureAbility.displayName,
            })
            .from(creatureAbility)
            .where(inArray(creatureAbility.creatureId, battleCreatureIds))
            .all()
        : []

    // Build ability lookup: creatureId → { active, passive }
    const abilityMap = new Map<
      string,
      {
        active?: { displayName: string; description: string; cooldown: number }
        passive?: { displayName: string; description: string }
      }
    >()
    for (const a of abilities) {
      const template = TEMPLATE_MAP.get(a.templateId)
      if (!template) continue
      const entry = abilityMap.get(a.creatureId) ?? {}
      if (a.slot === 'active') {
        entry.active = {
          displayName: a.displayName,
          description: template.description,
          cooldown:
            template.trigger.type === 'onUse' ? template.trigger.cooldown : 1,
        }
      } else {
        entry.passive = {
          displayName: a.displayName,
          description: template.description,
        }
      }
      abilityMap.set(a.creatureId, entry)
    }

    return owned.map((r) => {
      let battleStats: BattleStatsData | null = null
      if (r.role && r.hp != null) {
        const abs = abilityMap.get(r.creatureId)
        battleStats = {
          role: r.role,
          hp: r.hp,
          atk: r.atk!,
          def: r.def!,
          spd: r.spd!,
          active: abs?.active ?? null,
          passive: abs?.passive ?? null,
        }
      }
      return {
        id: r.id,
        creatureId: r.creatureId,
        pulledAt: r.pulledAt,
        isFavorite: r.isFavorite,
        name: r.name,
        scientificName: r.scientificName,
        rarity: r.rarity,
        era: r.era,
        diet: r.diet,
        imageUrl: toCdnUrl(r.imageUrl),
        imageAspectRatio: r.imageAspectRatio,
        description: r.description,
        isBattleReady: r.isBattleReady,
        battleStats,
      }
    })
  })

export const Route = createFileRoute('/_app/collection')({
  loader: ({ context }) => getCollection({ data: context.session.user.id }),
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">My Collection</h1>
        <p className="mt-2 text-muted-foreground">
          {collection.length} creature{collection.length !== 1 ? 's' : ''}{' '}
          discovered
        </p>
      </div>
      <CollectionGrid collection={collection} />
    </div>
  )
}
