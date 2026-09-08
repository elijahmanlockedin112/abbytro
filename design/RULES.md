# Abbytro — Rules Specification v1.0

Roguelike deckbuilder. Poker hands score `chips × mult`; jokers modify scoring; 8 antes of 3 blinds; shop between blinds. JavaScript, canvas 2D, single player, seeded RNG, doubles for score (no cap; display scientific notation ≥ 1e11).

---

## 1. Design pillars

- **Readable math.** Every number on screen is one term of `chips × mult`. The engine runs scoring as an ordered list of steps (§4) and the UI animates that exact list, so the player can always reconstruct the total by hand.
- **Escalating numbers.** Additive effects carry antes 1–3, multiplicative effects carry 4–6, stacked xMult carries 7–8 and endless. Requirements (§2) are tuned so each tier of scaling is *required*, not optional.
- **"One more hand" tension.** 4 hands and 3 discards per blind, a visible remaining-score bar, and bosses that break one habit at a time. Losing is always a math failure the player can see coming.
- **Build expression.** 5 joker slots, 8 enhancements, 4 seals, 3 editions on cards, 12 levelable hands. Two runs with the same seed should still diverge on player choice.
- **Determinism.** Same seed + same decisions = same run. All randomness goes through named RNG streams (§2.6).

---

## 2. Run structure

### 2.1 Flow

```
Ante N:  [Blind select] → Small (skippable) → Shop → Big (skippable) → Shop → Boss (mandatory) → Shop → Ante N+1
```

- Skipping a blind grants its tag (§7) and goes **directly** to the next blind; **no shop** after a skipped blind.
- Beating the Ante 8 Boss = victory screen with a **Continue (Endless)** button; endless play proceeds to Ante 9 with the same rules.
- Losing (hands = 0 and score < requirement) ends the run.
- The blind-select screen shows all three blinds of the ante with requirement, money reward, the two skip tags, and the Boss name/effect (revealed at ante start).

### 2.2 Blind requirements

Big = `floor(Small × 1.5)`. Boss = `Small × bossMultiplier` (2× for most, see §6).

| Ante | Small | Big | Boss (2×) | Finisher (3×) |
|---|---|---|---|---|
| 1 | 250 | 375 | 500 | — |
| 2 | 700 | 1,050 | 1,400 | — |
| 3 | 1,800 | 2,700 | 3,600 | — |
| 4 | 4,200 | 6,300 | 8,400 | — |
| 5 | 9,000 | 13,500 | 18,000 | — |
| 6 | 17,000 | 25,500 | 34,000 | — |
| 7 | 30,000 | 45,000 | 60,000 | — |
| 8 | 50,000 | 75,000 | — | 150,000 |

**Endless (ante n ≥ 9):** `Small(n) = floor(Small(n−1) × (1.5 + 0.25 × (n − 8)))`. Big and Boss derive as above. Values: Small(9) = 87,500; Small(10) = 175,000; Small(11) = 393,750; Small(12) = 984,375; Small(13) = 2,707,031; Small(14) = 8,121,093; Small(16) = 92,377,432. If any requirement evaluates to `Infinity` or `NaN`, the run ends as a win ("Singularity").

### 2.3 Money

| Event | Amount |
|---|---|
| Beat Small blind | $3 |
| Beat Big blind | $4 |
| Beat Boss blind | $5 (Finisher bosses: $8) |
| Unused hands at blind end | +$1 per hand |
| Interest (§8.6) | $1 per $5 held, cap $5 |

Cash-out order after a won blind: (1) Coin cards in hand pay out; (2) interest is computed on the money held *now*; (3) base blind reward (doubled by Double Down tag); (4) unused-hand bonus. Money is an integer and never goes below $0 unless a rule says "set to $0". Purchases require `money ≥ price`.

### 2.4 Run start state

| Property | Value |
|---|---|
| Money | $4 |
| Deck | standard 52 cards, no modifiers |
| Hand size | 8 |
| Hands per blind | 4 |
| Discards per blind | 3 |
| Joker slots | 5 |
| Consumable slots | 2 |
| Hand levels | all 1 |

### 2.5 Round rules

1. **Blind start:** hands/discards reset to their per-blind values; the *entire* current deck (minus destroyed cards) is shuffled with stream `shuffle:{ante}:{blind}`; draw `handSize` cards.
2. **Turn:** select 1–5 cards, then **Play** or **Discard**. Play consumes 1 hand: cards move to the play area, §4 runs, then they go to the discard pile. Discard consumes 1 discard: cards go to the discard pile with no scoring. Either way, draw back up to `handSize`. When the deck is empty, draw nothing; the discard pile is **never** reshuffled mid-blind.
3. **Win check** runs after step 4e of every play. `score ≥ requirement` wins the blind immediately (the hand that crossed the line scores fully). Hands remaining at that moment pay $1 each.
4. **Lose check:** after a play, if `hands == 0` and `score < requirement`, the run ends.
5. Hand display order is either rank-descending (default) or suit-grouped (toggle). Cards in the play area keep the hand's order; "left to right" everywhere in this document means that order.
6. Jokers may be reordered by drag at any time (except under Shroud, §6). Jokers and consumables may be sold at any time outside of an animation.

### 2.6 Seeded RNG

Seed = user string (or 8 random uppercase alphanumerics). `hash = FNV-1a-32(seed + ":" + streamName)` seeds a `mulberry32` generator per stream. Streams: `shuffle:{ante}:{blind}`, `shop:{ante}:{blind}:{rerollIndex}`, `pack:{ante}:{blind}:{slot}`, `packOpen:{counter}`, `boss:{ante}`, `tag:{ante}`, `voucher:{ante}`, `chance` (Crystal shatter, Charm, The Gambler, Gremlin, Basilisk, Cinder). Uniform picks use `floor(rng() × n)`; weighted picks walk cumulative weights.

---

## 3. Poker hands

Level `L` values: `chips = base + (L−1) × chipInc`, `mult = base + (L−1) × multInc`. Levels start at 1, no maximum, never drop below 1.

| Precedence | Hand | Chips | Mult | +Chips/lvl | +Mult/lvl | Scoring cards |
|---|---|---|---|---|---|---|
| 1 (highest) | Flush Five | 160 | 16 | 50 | 3 | all played |
| 2 | Flush House | 140 | 14 | 40 | 4 | all played |
| 3 | Five of a Kind | 120 | 12 | 35 | 3 | all played |
| 4 | Straight Flush | 100 | 8 | 40 | 4 | all played |
| 5 | Four of a Kind | 60 | 7 | 30 | 3 | the 4 matching |
| 6 | Full House | 40 | 4 | 25 | 2 | all played |
| 7 | Flush | 35 | 4 | 15 | 2 | all played |
| 8 | Straight | 30 | 4 | 30 | 3 | all played |
| 9 | Three of a Kind | 30 | 3 | 20 | 2 | the 3 matching |
| 10 | Two Pair | 20 | 2 | 20 | 1 | the 4 paired |
| 11 | Pair | 10 | 2 | 15 | 1 | the 2 paired |
| 12 (lowest) | High Card | 5 | 1 | 10 | 1 | highest card only (leftmost on tie) |

### 3.1 Detection

Run every detector on the played cards; the hand type is the **highest-precedence** detector that returns true; `containedHands` is the set of *all* true detectors (used by joker text such as "if the hand contains a Pair"). High Card is always contained. Detectors (ranks 2..10, J=11, Q=12, K=13, A=14; Ace may also be 1 for straights; no wrap-around K-A-2):

- **Pair:** some rank has count ≥ 2. **Three/Four/Five of a Kind:** some rank has count ≥ 3 / ≥ 4 / ≥ 5.
- **Two Pair:** two *different* ranks each have count ≥ 2.
- **Full House:** one rank has count ≥ 3 and a different rank has count ≥ 2.
- **Straight:** exactly `S` non-Slab cards (S = 5, or 4 with Nimble voucher) whose distinct ranks sorted ascending satisfy `r[i+1] − r[i] == 1` (Skipstone voucher: `∈ {1, 2}`).
- **Flush:** at least `S` non-Slab cards, all sharing one suit. Chameleon cards count as every suit.
- **Straight Flush / Flush House / Flush Five:** the corresponding rank detector AND Flush are both true.
- **Slab** cards have no rank and no suit: they are ignored by every detector (so 4 Hearts + Slab is *not* a flush) but are **always scoring cards**. If all played cards are Slabs, the hand is High Card with no ranked scoring card.

Scoring-card order is the play-area order (left to right). Bosses that change requirements never change precedence.

---

## 4. Scoring algorithm

Accumulators `chips` and `mult` are doubles. Every step below emits an animation event. Each "trigger" is applied in the fixed internal order **+chips → +mult → ×mult**; separate triggers are applied strictly in sequence.

```
a. handType = detect(played); chips = hand.chips(L); mult = hand.mult(L)
b. for card in scoringCards (left→right):
     triggers = 1 + card.retriggers        // Echo seal +1, jokers +N
     repeat triggers times:
       if card.debuffed: continue           // nothing below fires
       chips += rankChips(card)             // 2–10 face value, J/Q/K = 10, A = 11, Slab = 0
       apply enhancement (§5.1)             // +chips, +mult, ×mult order
       apply edition (§5.2)
       apply seal (§5.3)
       for joker in jokers (left→right): if !joker.disabled: joker.onScored(card)
c. for card in heldCards (left→right):      // cards still in hand, before redraw
     triggers = 1 + card.retriggers
     repeat triggers times:
       if card.debuffed: continue
       apply held enhancement (Iron ×1.5)
       for joker in jokers (left→right): if !joker.disabled: joker.onHeld(card)
d. for joker in jokers (left→right):
     if joker.disabled: continue
     edition Gleam: chips += 50;  edition Prism: mult += 10
     joker.independent()                    // +chips, +mult, ×mult order
     edition Aurora: mult ×= 1.5
   (boss Undertow: chips /= 2 here)
e. chips = max(0, chips); mult = max(0, mult); final = chips × mult
   blind.score += final
   post-scoring: Crystal shatter rolls (§5.1), Cinder destruction (§6), win/lose checks
```

**Rules:**

- **Retriggers** repeat the whole per-card block once more per extra trigger (rank chips, enhancement, edition, seal, and every joker's on-scored/on-held effect). Sources add: Echo seal = +1; each retrigger joker adds its stated count. A retrigger never retriggers a retrigger source.
- **Debuffed cards** (boss effects) still count for detection and still occupy a scoring-card slot, but contribute nothing in steps b and c. Rendered with a red tint.
- **Disabled jokers** skip everything in b, c, d including their edition.
- Joker text conventions: *first hand* = `handsPlayedThisBlind == 0`; *final hand* = `handsRemaining == 0` after this play; "contains X" = `X ∈ containedHands`.
- No rounding anywhere. Scores < 1e11 display as integers with thousands separators (`floor`); ≥ 1e11 display as 3-significant-digit scientific (`2.07e12`). `Infinity` displays as `∞` and beats any finite requirement.

---

## 5. Card modifiers

Each playing card holds at most one enhancement, one edition, and one seal. Applying a new one replaces the old one of that category.

### 5.1 Enhancements

| Name | Effect | Fires |
|---|---|---|
| **Gilt** | +30 chips | on scored |
| **Ember** | +4 mult | on scored |
| **Chameleon** | Counts as every suit for detection and suit-based effects | passive |
| **Crystal** | ×2 mult. After step e, roll `chance`: 1 in 4 the card shatters (destroyed permanently). One roll per hand per card regardless of retriggers | on scored |
| **Iron** | ×1.5 mult | held in hand (step c) |
| **Slab** | +50 chips. No rank, no suit, always scores, ignored by detection | on scored |
| **Coin** | +$3 | end of round, if in hand |
| **Charm** | Roll `chance`: 1 in 5 → +20 mult; independent roll 1 in 15 → +$20 | on scored |

### 5.2 Editions

| Name | On a playing card | On a joker | Shop surcharge | Shop roll (per joker) |
|---|---|---|---|---|
| **Gleam** | +50 chips (on scored) | +50 chips before its independent effect | +$2 | 2.0% |
| **Prism** | +10 mult (on scored) | +10 mult before its independent effect | +$3 | 1.4% |
| **Aurora** | ×1.5 mult (on scored, after enhancement) | ×1.5 mult after its independent effect | +$5 | 0.6% |
| **Void** | not allowed | +1 joker slot while owned (removed when the joker leaves) | +$5 | 0.3% |

Roll one uniform `r`: `r < 0.003` Void, `< 0.009` Aurora, `< 0.023` Prism, `< 0.043` Gleam, else none. If a Void joker leaves and you exceed your slots, nothing is forced; you simply cannot acquire jokers until under the limit.

### 5.3 Seals

| Name | Color | Effect |
|---|---|---|
| **Echo** | red | This card triggers 1 extra time (scored or held) |
| **Mint** | gold | +$3 each time this card triggers when scored |
| **Augur** | blue | When this card triggers when scored, create the Star for the played hand type (requires a free consumable slot; otherwise nothing) |
| **Twin** | violet | When discarded, a copy of this card (same rank, suit, enhancement, edition; **no seal**) is added to the deck permanently and dealt into your hand before the refill draw |

---

## 6. Boss blinds

Requirement = `Small × Req`. Regular bosses pay $5, Finishers $8. "Debuffed" is defined in §4.

| # | Name | Min ante | Req | Effect (this blind only) |
|---|---|---|---|---|
| 1 | Verdigris | 1 | 2× | All Club cards are debuffed. |
| 2 | Ashfall | 1 | 2× | All Heart cards are debuffed. |
| 3 | Hush | 1 | 2× | Discards set to 0. |
| 4 | Tithe | 1 | 2× | Hand size −2 (min 1). |
| 5 | Toll | 1 | 2× | The first hand played is discarded instead of scored: it consumes a hand, cards go to the discard pile, no §4 steps run. |
| 6 | Quorum | 2 | 2× | Every played hand must contain exactly 5 cards; Play is disabled otherwise. |
| 7 | Blindfold | 2 | 2× | Cards are dealt face down (card back only, still selectable, hand-type preview hidden). A card is revealed when it enters the play area or is discarded. |
| 8 | Undertow | 2 | 2× | After step d, `chips /= 2`. |
| 9 | Rampart | 2 | 4× | No effect other than the 4× requirement. |
| 10 | Monocle | 2 | 2× | No repeat hand types: a hand whose type was already played this blind scores 0 (hand still consumed, no effects fire). |
| 11 | Gravity | 3 | 2× | All face cards (J, Q, K) are debuffed. |
| 12 | Litany | 3 | 2× | Only one hand type: the first played hand fixes the type; later hands of any other type score 0 (hand consumed, no effects fire). |
| 13 | Gremlin | 3 | 2× | When Play is pressed, one uniformly random joker (`chance`) is disabled for that hand. |
| 14 | Wane | 3 | 2× | Hands per blind −1 (min 1). |
| 15 | Salt | 4 | 2× | Every card that was played during this ante's Small or Big blind is debuffed (track card IDs; skipped blinds add nothing). |
| 16 | Bleach | 4 | 2× | Enhancements, editions, and seals on playing cards do nothing (Chameleon loses wild; Slab still has no rank/suit and scores 0 chips). |
| 17 | **Eclipse** (Finisher) | 8 | 3× | All cards are debuffed until a joker is sold during this blind; afterwards all cards are normal for the rest of the blind. |
| 18 | **Shroud** (Finisher) | 8 | 3× | At blind start jokers are shuffled into a random order (`boss:{ante}`) and turned face down. They cannot be reordered; they may be sold but are revealed only after the sale. Effects fire in the hidden order. |
| 19 | **Basilisk** (Finisher) | 8 | 3× | One random card in hand is always selected: it is part of every Play and Discard and cannot be deselected. When it leaves the hand a new random card in hand is chosen. |
| 20 | **Cinder** (Finisher) | 8 | 3× | After each hand is scored (after Crystal shatter rolls), one uniformly random surviving scoring card from that hand is destroyed permanently. |

**Selection rule.** At ante start (stream `boss:{ante}`): antes 1–7 and 9+ pick uniformly among regular bosses (#1–16) with `minAnte ≤ ante` that have **not appeared this run**; ante 8 picks uniformly among Finishers not yet appeared. If the eligible pool is empty (endless), clear the "appeared" set for that pool first. The Boss is displayed on the blind-select screen from ante start.

---

## 7. Skip tags

At ante start (stream `tag:{ante}`) roll one tag for the Small and one for the Big blind, each uniform among tags with `minAnte ≤ ante`; both are visible on the blind-select screen. Tags queue up and each is consumed by its trigger; multiple "next shop" tags all apply to the same next shop (joker-slot tags fill card slot 1, then slot 2).

| Tag | Min ante | Effect | Consumed when |
|---|---|---|---|
| Bounty | 1 | +$25 after the next Boss blind is beaten | next Boss won |
| Double Down | 1 | Base reward of the next blind beaten is doubled ($6/$8/$10/$16); interest and unused-hand bonus unchanged | next blind won |
| Patron | 1 | Next shop's card slot 1 is a free **Rare** joker | next shop |
| Guild | 1 | Next shop's card slot 1 is a free **Uncommon** joker | next shop |
| Gleam Tag | 1 | Next shop's card slot 1 is a free joker with **Gleam** edition (rarity rolled normally) | next shop |
| Prism Tag | 1 | As above, **Prism** | next shop |
| Aurora Tag | 2 | As above, **Aurora** | next shop |
| Void Tag | 2 | As above, **Void** | next shop |
| Ledger | 1 | In the next shop all jokers and consumables in card slots cost $0, including after rerolls (packs and vouchers unaffected) | next shop |
| Barker | 1 | Next shop's reroll price starts at $0 (still +$1 per reroll) | next shop |
| Trove | 1 | Immediately open a free Jumbo Arcana pack | on pickup |
| Zenith | 1 | Immediately open a free Jumbo Star pack | on pickup |
| Shade | 2 | Immediately open a free Phantom pack | on pickup |
| Bulk | 1 | The next booster pack you buy is free and one size larger (Standard → Jumbo; Jumbo stays Jumbo) | next pack purchase |
| Twin Tag | 1 | The next tag you receive is doubled (you get 2 copies of it) | next tag received |

---

## 8. Shop

### 8.1 Layout

| Area | Count | Contents | Rerollable |
|---|---|---|---|
| Card slots | 2 | Joker 70% / Arcana 20% / Star 10% (per slot) | yes |
| Pack slots | 2 | Booster packs (§8.4) | no |
| Voucher slot | 1 | One voucher per ante (§10) | no |

Reroll: $5, +$1 per reroll, price resets on every shop visit; rerolls regenerate only the 2 card slots (stream `shop:{ante}:{blind}:{rerollIndex}`). Bought slots stay empty until reroll.

### 8.2 Jokers

Rarity roll: **Common 70% / Uncommon 25% / Rare 5% / Legendary 0%** (Legendary only via *Apparition*, §9.3). A joker you currently own, or one already in the other card slot, is excluded from generation (re-draw). Price is a uniform integer in the range, plus edition surcharge.

| Rarity | Price | Sell value if obtained free |
|---|---|---|
| Common | $3–5 | as if $4 |
| Uncommon | $6–8 | as if $7 |
| Rare | $8–10 | as if $9 |
| Legendary | $20 | as if $20 |

**Sell price** (jokers and consumables) = `max(1, floor(cost / 2))`, where `cost` is the price paid (including edition surcharge, before Haggle/Fleece discounts), or the "as if" price for free items. Vouchers cannot be sold.

### 8.3 Consumables in card slots

Arcana $3, Star $3. Phantom cards never appear in card slots (packs only). Consumable generation is uniform within the family, except Stars for Five of a Kind / Flush House / Flush Five, which are generated only after that hand has been played at least once this run.

### 8.4 Booster packs

Six pack types, each in two sizes. Per pack slot: roll type by weight, then size (Standard 75% / Jumbo 25%).

| Type | Weight | Standard: price, shows → pick | Jumbo: price, shows → pick | Contents |
|---|---|---|---|---|
| Arcana Pack | 25 | $4, 3 → 1 | $6, 5 → 2 | Arcana cards |
| Star Pack | 20 | $4, 3 → 1 | $6, 5 → 2 | Star cards |
| Deck Pack | 25 | $4, 3 → 1 | $6, 5 → 2 | Playing cards (§8.5) |
| Joker Pack | 15 | $6, 2 → 1 | $8, 4 → 2 | Jokers (normal rarity/edition rolls) |
| Phantom Pack | 8 | $6, 2 → 1 | $8, 4 → 2 | Phantom cards |
| Grab Bag | 7 | $5, 4 → 1 | $7, 6 → 2 | Each card: Arcana 45% / Star 40% / Phantom 15% |

Opening a pack shows the cards plus your hand (8 cards drawn from the full shuffled deck, stream `packOpen`). You may pick fewer than allowed (Skip). Picked Arcana/Star/Phantom cards may be **Use now** (targets chosen from that hand) or **Keep** (needs a free consumable slot). Deck-pack cards go straight into the deck. Joker picks need a free joker slot.

### 8.5 Deck-pack card generation

Rank and suit uniform. Independent rolls: enhancement 40% (uniform over the 8), edition 8% (Gleam 5% / Prism 2% / Aurora 1%), seal 20% (uniform over the 4).

### 8.6 Interest

At cash-out step 2 (§2.3): `interest = min(cap, floor(money / 5))`, cap $5 (Nest Egg $10, Trust Fund $20).

---

## 9. Consumables

Targeted cards are usable only during a blind or while a pack is open, and only when the selection count is within range. Untargeted cards are usable anywhere. "Create" effects require a free consumable slot and do nothing if none is free (the card is still consumed only if at least one thing was created; otherwise Use is disabled).

### 9.1 Arcana (22)

| # | Name | Effect | Select |
|---|---|---|---|
| I | The Seer | Create up to 2 random Star cards (limited by free slots) | 0 |
| II | The Forge | Enhance selected cards → **Gilt** | 1–2 |
| III | The Pyre | Enhance → **Ember** | 1–2 |
| IV | The Mask | Enhance → **Chameleon** | 1–2 |
| V | The Lens | Enhance → **Crystal** | 1 |
| VI | The Anvil | Enhance → **Iron** | 1 |
| VII | The Monolith | Enhance → **Slab** | 1–2 |
| VIII | The Mint | Enhance → **Coin** | 1–2 |
| IX | The Dice | Enhance → **Charm** | 1–2 |
| X | The Tide | Convert selected cards to **Spades** | 1–3 |
| XI | The Bloom | Convert to **Hearts** | 1–3 |
| XII | The Thicket | Convert to **Clubs** | 1–3 |
| XIII | The Kiln | Convert to **Diamonds** | 1–3 |
| XIV | The Scythe | Destroy selected cards permanently | 1–2 |
| XV | The Ladder | Raise rank of selected cards by 1 (10→J→Q→K→A→2) | 1–2 |
| XVI | The Twin | The left selected card becomes a copy of the right one (rank, suit, enhancement, edition, seal) | 2 |
| XVII | The Alms | Gain money equal to current money, max +$20 | 0 |
| XVIII | The Purse | Gain the total sell value of all owned jokers, max $50 | 0 |
| XIX | The Mirror | Create a copy of the last Arcana or Star card used this run (never The Mirror, never Phantom); disabled if none | 0 |
| XX | The Jester | Create a random Common joker (needs a free joker slot) | 0 |
| XXI | The Gambler | Roll `chance`: 1 in 4 → a random edition-less joker gains an edition (Gleam 50% / Prism 35% / Aurora 15%); else nothing. Needs ≥ 1 edition-less joker | 0 |
| XXII | The Herald | Create up to 2 random Arcana cards (limited by free slots) | 0 |

### 9.2 Stars (12)

Each levels its hand type by 1 (increments from §3). Generation uniform, with the §8.3 restriction.

| Star | Hand | Star | Hand |
|---|---|---|---|
| Sirius | High Card | Polaris | Full House |
| Vega | Pair | Betelgeuse | Four of a Kind |
| Altair | Two Pair | Arcturus | Straight Flush |
| Deneb | Three of a Kind | Canopus | Five of a Kind |
| Rigel | Straight | Aldebaran | Flush House |
| Antares | Flush | Capella | Flush Five |

### 9.3 Phantom (12)

Generation weights: all 1.0 except Apparition 0.4.

| Name | Effect | Select |
|---|---|---|
| Apparition | Create a random Legendary joker (needs a free joker slot). Then destroy one random other joker, if any | 0 |
| Hollow | Destroy a random joker; gain $20. Needs ≥ 1 joker | 0 |
| Sigil | Add an **Echo** seal to the selected card, then destroy 1 random other card in hand | 1 |
| Ingot | Add a **Mint** seal to each selected card; destroy every unselected card in hand | 1–2 |
| Umbra | A random edition-less joker gains **Void**; money set to $0. Needs ≥ 1 edition-less joker | 0 |
| Iris | A random joker gains **Aurora** (replacing any edition); every other joker is destroyed | 0 |
| Doppel | Create a copy of a random joker (copy has **no edition**, so Void never duplicates); every other joker is destroyed | 0 |
| Monotone | Every card in hand becomes the rank of the selected card; hand size −1 permanently (min 1) | 1 |
| Legion | Every card in hand becomes the suit of the selected card; the selected card is destroyed | 1 |
| Bonfire | Destroy 5 random cards in hand (all if fewer); gain $20 | 0 (blind/pack only) |
| Retinue | Destroy 1 random card in hand; add 3 random face cards (J/Q/K, random suit, each with a random enhancement) to the deck and deal them into hand | 0 (blind/pack only) |
| Nova | Level up all 12 hand types by 1; discards per blind −1 permanently (min 0) | 0 |

---

## 10. Vouchers

All $10. The upgrade is eligible only once its base is owned. At ante start (stream `voucher:{ante}`) roll one eligible voucher uniformly; it occupies the voucher slot in every shop of that ante; once bought, the slot stays empty until the next ante.

| Pair | Base | Effect | Upgrade | Effect |
|---|---|---|---|---|
| 1 | Stockpile | +1 consumable slot | Hoard | +1 consumable slot (total +2) |
| 2 | Nest Egg | Interest cap $10 | Trust Fund | Interest cap $20 |
| 3 | Haggle | Jokers, consumables, and packs cost `max(1, floor(price × 0.75))` | Fleece | `max(1, floor(price × 0.5))` |
| 4 | Grip | +1 hand size | Vise | +1 hand size |
| 5 | Tempo | +1 hand per blind | Cadence | +1 hand per blind |
| 6 | Spare | +1 discard per blind | Surplus | +1 discard per blind |
| 7 | Nimble | Flushes and Straights need only 4 cards | Skipstone | Straights may have a gap of 1 rank between consecutive cards (e.g. 2-4-5-7-8) |
| 8 | Rehearsal | Once per ante, pay $10 on the blind-select screen to reroll the Boss (new pick from the eligible pool; the rerolled boss returns to the pool) | Encore | Unlimited Boss rerolls, $10 each |

---

## 11. Balance appendix

### 11.1 Reference jokers used below

| Joker | Rarity | Trigger | Effect |
|---|---|---|---|
| Grinner | Common | independent | +4 mult |
| Pairbond | Common | independent | +8 mult if the hand contains a Pair |
| Clubfoot | Common | on scored | +3 mult per scored Club |
| Triad | Uncommon | independent | ×3 mult if the hand contains a Three of a Kind |
| Cannon | Rare | independent | ×3 mult |

### 11.2 Worked examples (exact engine order)

**Ante 1 — Boss 500.** Two Pair Lv1 (20 × 2), played K♠ K♥ 9♣ 9♦ 4♠, joker Grinner.
b: 20+10+10+9+9 = **58** chips. d: Grinner → mult 2+4 = **6**. Final **348**. Two hands: 696 ≥ 500. Without any joker: 58 × 2 = 116 → Small 250 falls in 3 hands, Big 375 in 4; the Boss needs one joker or a Three of a Kind, which is the intended ante-1 lesson.

**Ante 2 — Boss 1,400.** Three of a Kind Lv2 (50 × 5), played 8 8 8, jokers Grinner, Pairbond.
b: 50+8+8+8 = **74**. d: Grinner 5+4 = 9; Pairbond (contains Pair) 9+8 = **17**. Final **1,258**. Two hands: 2,516.

**Ante 4 — Boss 8,400.** Flush Lv2 (50 × 6), played K♣(Gilt) Q♣ 9♣ 5♣ 3♣, jokers Clubfoot, Grinner(Prism).
b: K: +10 → 60, Gilt +30 → 90, Clubfoot mult 6+3 = 9; Q: 100, mult 12; 9: 109, 15; 5: 114, 18; 3: **117**, **21**. d: Grinner: Prism +10 → 31, +4 → **35**. Final **4,095**. Three hands: 12,285 ≥ 8,400 (a build with one enhancement and one edition is required; four unmodified hands would fail).

**Ante 6 — Boss 34,000.** Four of a Kind Lv3 (120 × 13), played 10 10 10(Gilt) 10, jokers Grinner, Pairbond, Triad(Aurora).
b: 120+10+10+10+30+10 = **190**. d: Grinner 17; Pairbond 25; Triad ×3 = 75, Aurora ×1.5 = **112.5**. Final **21,375**. Two hands: 42,750.

**Ante 8 — Finisher 150,000.** Four of a Kind Lv5 (180 × 19), played K K(Gilt) K(Gilt) K, two Iron cards held, jokers Grinner, Pairbond, Triad, Cannon(Aurora).
b: 180+10+10+30+10+30+10 = **280**. c: Iron ×1.5 ×1.5 → mult 19 → 42.75. d: Grinner 46.75; Pairbond 54.75; Triad ×3 = 164.25; Cannon ×3 = 492.75, Aurora ×1.5 = **739.125**. Final **206,955** — one hand clears the Finisher. Swapping Cannon for a second +mult joker yields ~72,000 per hand, i.e. 3 hands; that is the "no multiplicative synergy" failure mode at ante 8.

### 11.3 Known degenerate combos

| Combo | Behavior | Verdict |
|---|---|---|
| Flush Five of Crystal cards + Echo seals + retrigger jokers | ×2 per trigger, ×2^10+ per hand | **Intended.** The 1-in-4 shatter roll per card per hand is the cap; expected card lifetime ≈ 4 plays. |
| Twin seal on a Crystal/Aurora card, discard every turn | Deck gains one copy per discard | **Intended.** Copies carry no seal, so growth is linear in discards spent, never exponential. |
| Doppel on a Void joker | Would grant infinite joker slots | **Capped by rule:** Doppel copies never carry an edition. |
| The Mirror recreating Nova | Would level all hands every shop for $3 | **Capped by rule:** The Mirror copies Arcana/Star only. |
| Endless overflow: stacked xMult reaches `Infinity` | `Infinity × 0 = NaN` risks, requirement overflow | **Capped by rule:** non-finite `chips` or `mult` → `final = Infinity`, which wins the blind; a non-finite requirement ends the run as a win ("Singularity"). Never compare `NaN`. |
