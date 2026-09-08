# Abbytro Jokers

72 jokers: 34 common, 22 uncommon, 12 rare, 4 legendary. This doc covers intent, engine conventions, and the five custom effects. Card text uses the `RULES.md` names (Crystal, Iron, Slab, Charm; Gleam, Prism, Aurora, Void; Echo, Mint, Augur, Twin); JSON `when` clauses use the internal ids (`glass`, `steel`, `stone`, `lucky`).

## Rarity philosophy

- **Common ($3-5)** is the vocabulary. One legible effect each: a conditional +3-5 Mult, +30-60 Chips, or a gated x1.5. Cheap to buy, cheap to sell. Cool muted art so the row reads as background.
- **Uncommon ($6-8)** gives a build its spine: an x2 with a real condition (Monochrome, Refrain, Vow of Silence), a rules-bending passive (Stained Glass, Rope Bridge, Twin Dye), or a counter that climbs all run (Reliquary, Kiln, Pyre). Bright saturated art.
- **Rare ($8-10)** decides what the run is about. Six are keystones (Hourglass, Mirror Chapel, Seamless Robe, Doppel, Anchorite, Vigil); the rest are conditional x3-x4 payoffs. Gold, amber and crimson art.
- **Legendary ($20, never in the shop, only from a special consumable)** rewrites one rule for the rest of the run. Dark ground, one neon glyph.

Power lives in conditions, not raw numbers: the strongest jokers demand a deck built around them; the cheapest fit anywhere. Novice is the `Grinner` reference joker from RULES §11.

## Engine conventions

- **Hand ids**: `high_card, pair, two_pair, three, straight, flush, full_house, four, straight_flush, five, flush_house, flush_five`. `handType` is exact; `handContains` tests `containedHands` (RULES §3.1). Ranks are strings `"2"`-`"10"`, `"J"`, `"Q"`, `"K"`, `"A"`.
- **`scale`**: the effect carrying `scale` bumps the joker's single `counter` by `step` each time it fires (after its `do`). The counter is applied in the joker's `independent` step as `scale.stat` (xmult counters start at 1); `decay.by` multiplies it; `{counter}` renders it.
- **`chipsPer` / `multPer`** add `stat * x`; **`xmultPer`** multiplies by `1 + stat * x` (Golden Calf at $50 = x2). `handsRemaining` / `discardsRemaining` are measured after the current hand or discard is spent.
- **`retrigger`** follows RULES §4: counts from all sources are summed once per card, then the per-card block repeats; a retrigger never retriggers a retrigger source. `card_held` retriggers repeat Iron and every joker's `card_held` effect.
- **`on_discard`** fires once per discarded card and `when` tests that card. **`destroyCard`** removes the card after scoring (it still scores) and fires `card_destroyed` on every joker; Crystal shatter fires it too.
- **`createConsumable`** needs a free slot or does nothing. **`deckCountLte`** tests the full owned deck. A lone joker is both `leftmost` and `rightmost`. Passive numbers may be negative.
- Boss **Bleach** blanks enhancements, so Glazier, Anvil, Cornerstone, Mosaic and Quarry's retrigger are dead that blind; Quarry's per-deck chips still count.

## Full table

| Joker | Rarity | Cost | Effect |
|---|---|---|---|
| Candlelighter | Common | $4 | +3 Mult per scored Heart; held Hearts +1 |
| Tithe Box | Common | $4 | +25 Chips per Diamond; each 1 in 8 for $1 |
| Oak Cudgel | Common | $4 | +4 Mult per scored Club |
| Sexton's Spade | Common | $4 | +10 Chips, +2 Mult per Spade |
| Portrait Gallery | Common | $4 | +30 Chips per scored face |
| Courtiers | Common | $4 | Held faces +2 Mult each |
| Pennywhistle | Common | $3 | Scored 2/3/4 +5 Mult each |
| Abacus | Common | $4 | +15 Chips per scored 2-10 |
| Dyer's Vat | Common | $4 | Flush: +60 Chips |
| Pilgrim's Road | Common | $4 | Straight: +6 Mult |
| Mason's Ladder | Common | $4 | Straight: +10 Chips per scored card |
| Twin Bells | Common | $4 | Pair: scored cards retrigger |
| Solitary Lamp | Common | $3 | High Card: +60 Chips, +5 Mult |
| Moss Stone | Common | $4 | +4 Chips per hand played, forever |
| Ivy Creep | Common | $4 | +1 Mult per discarded card; halves each blind |
| Alms Bowl | Common | $3 | $2 per round; +$3 after a boss |
| Beggar's Cup | Common | $4 | Discarded cards 1 in 5 for $1 |
| Pawnbroker | Common | $3 | Jokers sell +$2; interest cap +$5 |
| Wide Sleeves | Common | $4 | +2 hand size, -1 Discard |
| Chaff Sack | Common | $4 | +1 Discard; +10 Chips per Discard left |
| Bellows | Common | $4 | +1 Hand, -1 Discard |
| Last Rites | Common | $5 | At 0 Discards, scored cards retrigger |
| Glazier | Common | $5 | Scored Crystal: extra x1.5 |
| Anvil | Common | $4 | Held Iron +4 Mult each |
| Cornerstone | Common | $4 | Scored Slab +40 Chips |
| Mosaic | Common | $4 | +3 Mult per enhanced card |
| Moths | Common | $4 | Scored cards 1 in 6 destroyed; $2 each |
| Coin Toss | Common | $4 | 1 in 3 for x2 |
| Empty Pew | Common | $3 | +25 Chips per empty slot |
| Open Door | Common | $4 | +4 Mult per empty slot |
| Doorkeeper | Common | $3 | Leftmost +40 Chips; rightmost +4 Mult |
| Overflowing Cup | Common | $4 | +15 Chips per Hand left |
| Novice | Common | $3 | +4 Mult |
| Kindred | Common | $4 | Three of a Kind: +50 Chips |
| Royal Court | Uncommon | $7 | K +5 Mult, Q +40 Chips, J retrigger |
| Masquerade | Uncommon | $7 | Boss: all cards are faces; +3 Mult per face |
| Kindling | Uncommon | $6 | Scored 2-5 +5 Mult; each 1 in 4 destroyed |
| Stained Glass | Uncommon | $7 | 4-card Flushes; Flush +4 Mult |
| Monochrome | Uncommon | $8 | Flush: x2 |
| Twin Dye | Uncommon | $7 | Suits merge by colour; Flush +30 Chips |
| Rope Bridge | Uncommon | $7 | Straights may skip a rank; Straight +40 Chips |
| Vow of Silence | Uncommon | $7 | 2 or fewer cards: x2 |
| Refrain | Uncommon | $7 | Pair or Two Pair: x2 |
| Reliquary | Uncommon | $7 | +x0.1 per consumable used |
| Kiln | Uncommon | $8 | +x0.1 per card destroyed |
| Bazaar | Uncommon | $6 | +1 shop slot; rerolls -$1 |
| Winnowing Fan | Uncommon | $6 | Play 3 or fewer: +1 Discard |
| Choir Loft | Uncommon | $7 | Sealed cards retrigger |
| Antiphon | Uncommon | $8 | Play 3 or fewer: all retrigger |
| Quarry | Uncommon | $6 | +20 Chips per Slab in deck; Slabs retrigger |
| Shard Collector | Uncommon | $6 | Crystal shatters: create Arcana |
| Pyre | Uncommon | $7 | Held 2-5 burn 1 in 3; +2 Mult each, permanent |
| Fortune's Wheel | Uncommon | $7 | Per hand: 1 in 3 for $2; 1 in 12 level up |
| Shell Game | Uncommon | $7 | 1 in 4 for x3 |
| Hermit | Uncommon | $8 | 2 or fewer Jokers: x2.5 |
| Steady Stride | Uncommon | $7 | +4 Mult per Hand left |
| Least of These | Rare | $9 | Each scored 2-5: x1.4 |
| Seamless Robe | Rare | $10 | Every card is every suit; -1 hand size (keystone) |
| Ascension | Rare | $9 | Ace in a Straight: x3 |
| Anchorite | Rare | $9 | Play High Card or Pair: level it (keystone) |
| Hourglass | Rare | $10 | +x0.1 per hand played, forever (keystone) |
| Golden Calf | Rare | $9 | +x0.02 per $1 held |
| Mirror Chapel | Rare | $9 | Retrigger held cards; +1 hand size (keystone) |
| Hollow Reed | Rare | $8 | Deck 30 or less: x1.5; 20 or less: x3 |
| Patron of Fools | Rare | $9 | All chances doubled (custom) |
| Solitary Cell | Rare | $8 | Only Joker: x4 |
| Vigil | Rare | $10 | +1 Hand; +x0.25 per Hand left (keystone) |
| Doppel | Rare | $10 | Copies the Joker to its left (custom, keystone) |
| The Bellfounder | Legendary | $20 | Every played hand levels its type |
| The Illuminator | Legendary | $20 | Scored cards 1 in 4 gain an edition (custom) |
| The Abbot | Legendary | $20 | Scored cards add Chips as Mult (custom) |
| The Gravekeeper | Legendary | $20 | Buries a card each blind; +x0.5 per destroyed (custom) |

## Synergy map

- **Suits**: Candlelighter, Tithe Box, Oak Cudgel, Sexton's Spade are the on-ramps; Twin Dye merges two of them; Seamless Robe makes all four fire on every card and hands Monochrome a guaranteed Flush.
- **Face cards**: Portrait Gallery, Courtiers, Royal Court, Masquerade. Mirror Chapel doubles Courtiers; Royal Court's Jacks feed every `card_scored` joker; Masquerade makes boss blinds the best blinds.
- **Low cards**: Pennywhistle, Abacus, Kindling, Least of These. Kindling and Pyre eat the cards you rely on, so add Kiln or The Gravekeeper and race the deck down to Hollow Reed's 20.
- **Flush**: Dyer's Vat, Stained Glass, Monochrome, Twin Dye, Seamless Robe. Twin Dye plus Stained Glass makes a four-card Flush near-automatic, freeing the fifth card for a Slab.
- **Straight**: Pilgrim's Road, Mason's Ladder, Rope Bridge, Ascension. Rope Bridge makes Ace-high straights findable; Ascension makes each one x3.
- **Small hands**: Solitary Lamp, Twin Bells, Vow of Silence, Refrain, Antiphon, Winnowing Fan, Anchorite. Anchorite levels Pair every play, Twin Bells and Antiphon triple-score both cards, Refrain and Vow of Silence stack to x4.
- **Scaling**: Moss Stone, Ivy Creep, Reliquary, Kiln, Pyre, Hourglass, The Gravekeeper. Reliquary loves Shard Collector and Augur seals; Hourglass loves Vigil and Bellows (more hands, more steps).
- **Economy**: Alms Bowl, Beggar's Cup, Pawnbroker, Tithe Box, Moths, Bazaar, Fortune's Wheel, Golden Calf. Golden Calf is the payoff; Pawnbroker and Bazaar are the enablers.
- **Hands and discards**: Wide Sleeves, Chaff Sack, Bellows, Winnowing Fan, Overflowing Cup, Steady Stride, Vigil. Chaff Sack and Last Rites pull opposite ways (hoard vs. spend); that tension is intentional.
- **Retrigger**: Twin Bells, Last Rites, Royal Court, Choir Loft, Antiphon, Quarry, Mirror Chapel. Every retrigger multiplies every `card_scored` joker, so Glazier, Sexton's Spade and Least of These are the targets.
- **Enhancements**: Glazier, Anvil, Cornerstone, Mosaic, Quarry, Shard Collector. Anvil plus Mirror Chapel is the Iron build; Glazier, Shard Collector and Kiln make shattering a feature.
- **Gamble**: Coin Toss, Shell Game, Beggar's Cup, Moths, Tithe Box, Kindling, Fortune's Wheel, Pyre, Patron of Fools. Patron turns Shell Game into a coin flip for x3 and Moths into a thinning engine.
- **Few jokers**: Empty Pew, Open Door, Hermit, Solitary Cell. Solitary Cell plus a Void-edition joker is the dream.
- **Many hands**: Bellows, Overflowing Cup, Steady Stride, Vigil. All reward playing the first hand hard and early.

## Custom-coded jokers

1. **Patron of Fools (`double_chances`)**. Every `chance: {num, den}` check, plus Charm rolls, Crystal shatter rolls and consumables that list a probability, resolves with `num = min(num * 2, den)`. Two Patrons quadruple. Shop odds, pack contents, tags and boss selection are not chances and are unaffected. Probability text updates live ("1 in 2" instead of "1 in 4").
2. **Doppel (`copy_left`)**. At every trigger, run each effect of the joker immediately to its left as its own, except `passive` effects (never copied) and `copy_left` itself. If the left neighbour is another Doppel, follow the chain left to the first non-Doppel; a leftmost Doppel does nothing. Copied `scale` effects read the source's counter and never increment it. `destroySelf` in a copied effect destroys the source, not the Doppel. Copies never carry the source's edition (RULES §11.3). Re-resolve the source whenever jokers are moved, sold or gained.
3. **The Illuminator (`gild_scored_cards`)**. After step e, each scored, non-debuffed card with no edition that survived this hand rolls 1 in 4 (Patron-affected). Success assigns Gleam 50%, Prism 35%, Aurora 15%; never Void. Retriggers add no extra rolls.
4. **The Abbot (`chips_as_mult`)**. In `card_scored`, at The Abbot's row position, add flat Mult equal to the Chips that card contributed this trigger: rank chips, Gilt, Gleam and Slab's 50. Other jokers' chips are excluded. Retriggers apply again in full. Debuffed cards give 0.
5. **The Gravekeeper (`bury_random_card`)**. On `blind_start`, before the shuffle, destroy one uniformly random card from the full deck (stream `joker:gravekeeper:{ante}:{blind}`), firing `card_destroyed` for every joker including its own scale. Skip if `deckCount <= handSize` so a hand can always be drawn. Slab and Coin cards are valid targets; removal is permanent.

## Most fun to find

- **Doppel**: its value is entirely about where you stand it, so every shop becomes a row-order puzzle.
- **Anchorite**: turns the worst hand in poker into one that levels every play; Pair outscoring Full House by ante 5 is when a build clicks.
- **Moths**: a common that thins the deck and pays you for it, so every hand carries a little "please eat the 3 of Clubs" tension.
- **Patron of Fools**: retroactively upgrades every gamble you already own, a delight to find late.
- **The Gravekeeper**: the deck visibly shrinks each blind, the multiplier visibly grows, and you decide when the shrinking stops being funny.

---

**Where the data lives:** the canonical joker definitions are `src/data/jokers.json`.
Edit that file to change the set; this document describes it but is not read by the game.
