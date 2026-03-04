# Game Design: Ascension & Arena Battles

Two complementary features: **Ascension** gives duplicate creatures a purpose, **Arena Battles** give your collection a competitive outlet. Ascension is cosmetic-only at launch — battle stat boosts can be layered on later once both systems are proven.

---

## Feature 1: Ascension

### Core Concept

Feed duplicate copies of a creature to "ascend" it through 5 cosmetic tiers. Each tier gives a progressively flashier card border and visual treatment. Duplicates are consumed permanently — they're gone. The ascended creature is the one that remains.

### Tiers

| Tier | Dupes Sacrificed (cumulative) | Visual |
|------|-------------------------------|--------|
| **Base** | 0 | Standard card |
| **Bronze** | 2 | Bronze metallic border |
| **Silver** | 5 | Silver metallic border + subtle shimmer |
| **Gold** | 10 | Gold border + particle effect |
| **Prismatic** | 18 | Animated holographic rainbow border |
| **Apex** | 25 | Animated border + creature-specific color + glow effect |

"Dupes sacrificed" is the **total** number of copies consumed across all tiers — not per-tier. Going from Bronze → Silver costs 3 more dupes (5 minus the 2 already consumed). The creature you're ascending is never consumed — it's the one being upgraded.

### Per-Tier Breakdown

| Upgrade | Additional Dupes Needed | Total Copies You Must Have Owned |
|---------|------------------------|----------------------------------|
| Base → Bronze | 2 | 3 (keep 1, feed 2) |
| Bronze → Silver | 3 | 6 |
| Silver → Gold | 5 | 11 |
| Gold → Prismatic | 8 | 19 |
| Prismatic → Apex | 7 | 26 |

### Rarity Considerations

The dupe requirements above apply universally regardless of rarity. This means:

- **Commons**: Achievable through normal play. A dedicated player can Apex a common within a few weeks of pulling.
- **Uncommons**: Slower but realistic. Bronze/Silver within a couple weeks, Gold over a month or two.
- **Rares**: Bronze is a milestone. Silver+ is a flex. Gold requires real commitment.
- **Epics**: Even Bronze is an achievement worth celebrating. Silver+ is extremely rare.
- **Legendaries**: Bronze requires 3 total copies of the same legendary. This is a whale/long-term dedication flex. Anything above Bronze is a server-wide event.

Reaching Apex on an epic or legendary should be essentially unprecedented in normal play — it's aspirational, not expected.

### Choosing Which Copy to Ascend

When a player initiates ascension, they pick the "primary" copy (the one that gets the border upgrade) and select which dupes to feed. All copies of that species are eligible as fodder, regardless of which banner they came from.

**Restrictions:**
- Cannot sacrifice a locked creature (in an active trade)
- Cannot sacrifice a favorited creature (safety net against accidental consumption)
- The primary creature being ascended cannot itself be locked or favorited-locked? Actually — favorited creatures CAN be ascended (upgraded), they just can't be *consumed as fodder*

### Ascension is Per-Instance

The ascension tier lives on a specific `user_creature` row, not on the species globally. If you trade away an ascended creature, the new owner gets it at that tier. If you pull more copies later, they start at Base.

### Server Announcements

Reaching **Gold** tier or above on any creature triggers a server-wide announcement in the Discord pull channel:

- **Gold**: "⭐ [Player] ascended their [Creature] to Gold!"
- **Prismatic**: "✨ [Player] ascended their [Creature] to Prismatic!"
- **Apex**: "🌟 [Player] achieved APEX [CREATURE]! The first/Nth in this server!"

### UX Flow (Web)

1. Player opens their collection and selects a creature they own multiple copies of
2. An "Ascend" button appears on the creature detail modal (grayed out if insufficient dupes)
3. Tapping "Ascend" opens a confirmation screen showing:
   - The primary creature with its current tier
   - The dupes that will be consumed (auto-selected, but player can swap which copies are fodder)
   - A preview of the next tier's visual treatment
   - Clear "these creatures will be permanently destroyed" warning
4. Player confirms → animation plays → card upgrades to new tier

### UX Flow (Discord)

Ascension is web-only at launch. Discord can display ascension tiers on creature embeds (borders represented as emoji/text indicators: 🥉🥈🥇✨🌟) but the actual ascension action happens on the web app. This avoids complex multi-step Discord interactions for a destructive action.

### Display

Ascension tier is visible everywhere a creature card appears:
- Collection grid (border color/effect)
- Trade marketplace (ascended creatures show their tier)
- Encyclopedia detail modal (if you own an ascended copy, it shows your best tier)
- Battle team selection and results
- Discord bot embeds (text indicator)

### Future Hooks (Not at Launch)

These are deliberately excluded from v1 but the system should be designed to support them:
- **Battle stat boosts**: Each tier could grant +X% combat power
- **Expedition bonuses**: Ascended creatures could find better loot
- **Passive Fossil income**: High-tier creatures generate Fossils over time
- **Unique titles/badges**: Apex creatures unlock a profile title

---

## Feature 2: Arena Battles

### Core Concept

Async 1v1 creature battles. Each player picks 3 creatures from their collection. Battles auto-resolve using a combat engine driven by real creature data (size, weight, diet). Best-of-3 rounds. Winner takes a Fossil pot.

No real-time interaction during the battle itself — the strategy is in team selection and ordering.

### Battle Flow

```
1. CHALLENGE
   Player A challenges Player B (web or Discord)
   Player A selects 3 creatures and locks in their order
   Player A antes Fossils into the pot

2. ACCEPT
   Player B sees the challenge (no visibility into A's picks)
   Player B selects 3 creatures and locks in their order
   Player B antes Fossils into the pot

3. RESOLVE
   Battle resolves instantly on acceptance
   Round 1: A's creature #1 vs B's creature #1
   Round 2: A's creature #2 vs B's creature #2
   Round 3: A's creature #3 vs B's creature #3
   Winner = best of 3

4. RESULT
   Both players see the full battle replay
   Winner receives the Fossil pot
   Battle recorded in history
```

### Fossil Stakes

| Type | Ante (per player) | Winner Takes |
|------|-------------------|--------------|
| Friendly | 0 | Nothing — just for fun / bragging rights |
| Standard | 5 | 10 Fossils |
| High Stakes | 15 | 30 Fossils |

The challenger picks the stake tier. The challenged player sees the stakes before accepting. Fossils are deducted on challenge creation (challenger) and acceptance (challenged). If the challenge expires or is declined, the challenger's ante is refunded.

### Combat Resolution

Each round is a 1v1 between the corresponding creatures. Combat power determines the winner, with a controlled amount of randomness to keep things interesting.

#### Base Power Calculation

Every creature has a **Base Power** derived from its existing data:

```
basePower = (sizeMeters * 10) + (weightKg * 0.1) + rarityBonus
```

| Rarity | Bonus |
|--------|-------|
| Common | 0 |
| Uncommon | 5 |
| Rare | 12 |
| Epic | 25 |
| Legendary | 50 |

This gives a rough range of:
- Small common (0.5m, 5kg): ~5.5 power
- Mid-size rare (5m, 500kg): ~112 power
- Large legendary (15m, 8000kg): ~1000 power

#### Diet Matchup Modifier

Diet creates a rock-paper-scissors-style advantage triangle:

| Attacker Diet | vs Defender Diet | Modifier |
|---------------|-----------------|----------|
| Carnivore | Herbivore | x1.25 |
| Carnivore | Omnivore | x1.10 |
| Herbivore | Carnivore | x0.85 |
| Omnivore | Carnivore | x1.00 |
| Omnivore | Herbivore | x1.05 |

All other matchups (same diet, piscivore vs filter-feeder, etc.) use x1.0.

Carnivores have a predator advantage but herbivores aren't helpless — a 10-ton Triceratops still crushes a 20kg Velociraptor on raw power.

#### Agile Predator Bonus

Small carnivores (under 100kg) fighting creatures more than 10x their weight get a **x1.5 "agile predator" bonus**. This represents pack-hunting tactics and speed advantage. It lets Velociraptors and Deinonychus punch above their weight class without completely overriding the size gap.

#### Era Modifier

A slight modifier based on geological recency (more evolved = marginally better adapted):

| Era | Modifier |
|-----|----------|
| Cenozoic | x1.10 |
| Mesozoic | x1.05 |
| Paleozoic | x1.00 |
| Precambrian | x0.95 |

This is subtle by design — era shouldn't dominate, just nudge.

#### Randomness

After all modifiers, the final power for each creature in a round is:

```
finalPower = basePower * dietModifier * agileBonus * eraModifier * random(0.85, 1.15)
```

The ±15% random swing means upsets are possible but uncommon. A significantly stronger creature wins ~90% of the time. Closely matched creatures are a true coin flip. This keeps battles exciting without feeling unfair.

#### Null Stats

Some creatures may have null `sizeMeters` or `weightKg`. For these:
- If `sizeMeters` is null, use the median size for that creature's rarity tier
- If `weightKg` is null, estimate from `sizeMeters` using a simple scaling formula
- This ensures every creature is battleable even with incomplete data

### Pack Bonus (Duplicate Synergy)

If a player fields multiple copies of the same creature in their 3 slots, those copies fight as a **pack** with multiplied power:

| Pack Size | Power Multiplier |
|-----------|-----------------|
| 2 (pair) | x1.5 |
| 3 (full pack) | x2.0 |

This is where duplicates gain battle value independent of ascension. A player with 3 common Velociraptors can field a full pack and match a solo rare's power. Creates a genuine strategic decision:

> "Do I ascend my dupes for cosmetic borders, or keep them for pack power in battles?"

**Pack rules:**
- Pack copies must be distinct `user_creature` instances of the same `creatureId`
- Each creature in the pack uses the pack multiplier, not just one of them
- Pack bonus stacks with all other modifiers

### Creature Locking During Battles

When a player commits creatures to a challenge (as challenger) or accepts one (as challenged), those creatures are **locked** using the existing `isLocked` mechanism. Locked creatures cannot be:
- Traded or proposed in trades
- Used in another active battle
- Ascended (consumed as fodder)

Creatures are unlocked when the battle resolves, expires, or is declined.

### Challenge Lifecycle

```
(create) → pending → (opponent accepts)  → resolved
           pending → (opponent declines) → declined
           pending → (24h passes)        → expired
           pending → (challenger cancels) → cancelled
```

- Challenges expire after **24 hours** if not accepted
- A player can have at most **3 active outgoing challenges** at a time
- A player can have at most **5 pending incoming challenges** (prevents spam)
- You cannot challenge yourself
- You cannot challenge someone you already have a pending challenge with

### Battle Replay

Every battle generates a round-by-round replay that both players (and spectators on Discord) can view:

```
⚔️ Arena Battle: @PlayerA vs @PlayerB (Standard — 10 Fossil pot)

Round 1: Tyrannosaurus Rex (A) vs Triceratops (B)
  T. Rex: 982 power (Carnivore vs Herbivore x1.25, Mesozoic x1.05)
  Triceratops: 871 power (Herbivore vs Carnivore x0.85, Mesozoic x1.05)
  → T. Rex strikes with crushing force! Round 1: Player A ✓

Round 2: Velociraptor ×3 Pack (A) vs Spinosaurus (B)
  Velociraptor Pack: 634 power (Pack x2.0, Agile Predator x1.5)
  Spinosaurus: 756 power (Carnivore vs Carnivore x1.0)
  → Spinosaurus overpowers the pack! Round 2: Player B ✓

Round 3: Ankylosaurus (A) vs Parasaurolophus (B)
  Ankylosaurus: 445 power (Herbivore vs Herbivore x1.0)
  Parasaurolophus: 312 power (Herbivore vs Herbivore x1.0)
  → Ankylosaurus's armored bulk proves decisive! Round 3: Player A ✓

🏆 Winner: Player A — takes 10 Fossils!
```

Narration lines are template-generated based on the matchup characteristics (diet, size ratio, pack status, whether it was a close fight or a blowout).

### Rating System

Players earn a **Battle Rating** (ELO-style) that tracks their competitive standing:

- Starting rating: **1000**
- Win against higher-rated: gain more points
- Lose against lower-rated: lose more points
- Standard K-factor: **32**
- Only Standard and High Stakes battles affect rating (Friendly does not)

Rating is displayed on the profile page and in a new **Battle Leaderboard** tab on the leaderboard page.

### UX Flow (Web)

**Challenging:**
1. Player visits a new `/battle` route (or challenges from another player's profile)
2. Selects an opponent (search by name, or click "Challenge" on a profile/leaderboard)
3. Picks 3 creatures from their collection (drag to order slots 1-2-3)
4. Selects stake tier (Friendly / Standard / High Stakes)
5. Confirms — fossils are deducted, challenge is sent

**Responding:**
1. Player sees a notification badge on the Battle nav item
2. Opens `/battle` and sees incoming challenges
3. Can view the challenger's profile/stats (but NOT their creature picks)
4. Picks their 3 creatures, orders them
5. Confirms — fossils are deducted, battle resolves instantly
6. Both players see the replay

**Battle History:**
- `/battle` page has tabs: "Challenges" (incoming/outgoing) and "History" (past battles with replays)
- Each history entry shows opponent, result, rating change, and expandable replay

### UX Flow (Discord)

**Challenging:**
```
/battle @opponent stake:standard
```
Bot responds with an ephemeral creature picker (select menu with the player's collection, 3 picks). After picks are locked, a public challenge embed appears in the channel:

```
⚔️ @PlayerA has challenged @PlayerB to a Standard battle!
Stake: 10 Fossils
@PlayerB — use /accept to pick your team, or /decline.
Expires in 24 hours.
```

**Accepting:**
```
/accept
```
Bot sends an ephemeral creature picker to Player B. After picks are locked, the battle resolves and the replay embed posts publicly in the channel.

**Other commands:**
- `/decline` — decline an incoming challenge
- `/battles` — view your active challenges and recent history (ephemeral)
- `/rating` — view your battle rating and rank (ephemeral, supports optional @user)

### Battle Announcements

All resolved Standard/High Stakes battles post a result embed in the channel where the challenge was issued. High Stakes battles additionally trigger a server-wide announcement if configured.

---

## Feature Interaction: Ascension × Battles

At launch, ascension is purely cosmetic and battles use raw creature stats. But the systems are designed to connect later:

**Planned future interaction:**
- Each ascension tier grants a battle power multiplier (e.g., Bronze +10%, Silver +20%, Gold +35%, Prismatic +60%, Apex +100%)
- This creates the core tension: **sacrifice dupes for permanent power on one creature (ascension) vs. keep dupes for pack power in battles**
- A Gold Triceratops with +35% power vs. 3 base Triceratops with x2.0 pack bonus — which is better? That's the interesting strategic question.

**Not at launch, but worth noting:**
- Ascended creatures could get unique battle narration lines
- Apex creatures could have a special visual effect in battle replays
- Battle wins could reward small amounts of XP
- Seasonal ranked battle seasons with exclusive cosmetic rewards

---

## Build Order

These features should ship in this order:

### Phase 1: Ascension
Ship ascension first because:
- It's self-contained (no dependency on battles)
- Gives immediate value to the existing duplicate problem
- Simpler scope — cosmetic-only means no balance tuning needed
- The schema changes (`ascensionTier` column) and UI work are foundation for battles to build on

### Phase 2: Arena Battles
Ship battles second because:
- Can reference ascension visuals in battle cards from day one
- The combat engine can be designed with future ascension stat hooks in mind
- More complex scope — combat math, challenge lifecycle, both platforms, replays, rating system

### Phase 3: Ascension × Battles Integration
Once both systems are live and iterated on:
- Add battle stat multipliers per ascension tier
- Tune the multipliers based on real battle data
- Announce the integration as a game update ("Ascension now powers up your creatures in battle!")
