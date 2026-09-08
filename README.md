# Abbytro

A poker-hand roguelike deckbuilder. You play poker hands, each scores **Chips × Mult**, and a row of Jokers rewrites the maths. Eight antes, three blinds each, a shop in between. Numbers get absurd.

Canvas 2D, no dependencies, no build step. Everything is drawn procedurally and every sound is synthesised at runtime, so the whole game is the source you see here.

## Play

```bash
npm start
```

Then open <http://localhost:8137>. Any static file server works; the game needs one only because ES modules do not load over `file://`.

## Controls

| Input | Action |
|---|---|
| Click a card | Select or deselect it (up to 5) |
| Drag | Reorder cards in hand, or Jokers (order changes the maths) |
| `Enter` / `Space` | Play the selected hand, or skip a scoring animation |
| `Backspace` / `X` | Discard the selected cards |
| `1`–`9` | Select the nth card, `A` clears the selection |
| `R` / `S` | Sort by rank / by suit |
| `D` | Inspect your deck |
| `Esc` | Pause, settings, abandon run |

Runs autosave. Enter a seed on the title screen to replay one exactly.

## How the scoring works

The order below is the whole game. The animation walks through it one step at a
time, so what you watch is literally the calculation.

1. The hand type is detected and sets the base chips and mult (a level 3 Flush starts higher than a level 1 one).
2. **Each scoring card, left to right** adds its chips, then its enhancement, edition and seal, then every Joker reacts to it.
3. **Each card still in your hand** triggers its held effects.
4. **Each Joker, left to right** applies its own effect.
5. Chips × Mult, and the result is added to the blind.

Within any single trigger, chips are added first, then mult, then xMult multiplies. This is why dragging a ×3 Joker to the right of a +20 Mult Joker is worth doing.

## Content

| | |
|---|---|
| Jokers | 72 — 34 common, 22 uncommon, 12 rare, 4 legendary |
| Boss blinds | 20, including 4 ante-8 finishers |
| Consumables | 22 Arcana, 12 Stars, 12 Phantoms |
| Vouchers | 16, in 8 upgrade pairs |
| Skip tags | 15 |
| Enhancements / editions / seals | 8 / 4 / 4 |

## Layout

```
src/
  core/          the game, with no idea a screen exists
    rng.js         seeded, per-purpose random streams
    cards.js       the card model
    hands.js       poker hand evaluation
    rules.js       every tunable number
    scoring.js     the scoring pipeline; returns an ordered log
    jokers.js      interprets the joker DSL
    run.js         run state and every legal mutation of it
  data/          content as data
    jokers.json    72 joker definitions
    bosses.js  tags.js  vouchers.js  consumables.js
  ui/            drawing and interaction
    theme.js       palette and typography
    draw.js        procedural cards, panels, buttons
    layout.js      every rectangle, shared by drawing and hit-testing
    entities.js    spring-backed card views
    scoring_anim.js  replays a scoring log as animation
    game.js  screens.js  interact.js
    spring.js  tween.js  particles.js  popups.js  fx.js  fmt.js
  audio/sfx.js   WebAudio synthesis, one function per event
design/          RULES.md, FEEL.md, JOKERS.md — the specs this was built from
tools/           serve.js (dev server), sim.js (headless simulator)
test/            node:test suites
```

`src/core` never imports from `src/ui`. That is what lets the simulator play thousands of hands without a canvas.

## Development

```bash
npm test    # 73 tests: hand evaluation, scoring, every joker, every boss, save/load
npm run sim # play runs headlessly and print the score/requirement curve
```

`npm run sim -- --seed=ABC` traces a single run blind by blind.

The simulator's bot plays the highest-scoring hand available and buys the first thing it can afford. It does not build synergies, so how far it gets is a floor rather than a balance verdict. Its real job is to catch crashes: it exercises every joker, boss and consumable across hundreds of runs.

## Adding a joker

Most jokers need no code. Append an entry to `src/data/jokers.json`:

```json
{
  "id": "candlelighter",
  "name": "Candlelighter",
  "rarity": "common",
  "cost": 4,
  "flavor": "She lights one for every heart that ever burned.",
  "description": "+{mult} Mult per scored Heart.",
  "art": { "glyph": "🕯️", "bg": "#6b2d3e", "fg": "#ffd9e0", "shape": "circle" },
  "effects": [
    { "trigger": "card_scored", "when": { "suit": "hearts" }, "do": { "mult": 3 } }
  ]
}
```

`trigger` says when it fires, `when` is an AND of conditions, and `do` is what happens. `scale` makes a joker grow over a run, and `passive` grants standing bonuses such as hand size. The vocabulary lives in `src/core/jokers.js`, and the five jokers that genuinely need code are in `src/core/custom_jokers.js`. `{tokens}` in the description are filled with live values, so a scaling joker's card always shows its current number.

## Balance

Numbers live in `src/core/rules.js` and nowhere else. Blind requirements run 250 at ante 1 to 50,000 at ante 8, with finisher bosses at 3×. Ante 1 falls to basic hands and one joker; ante 4 wants a real build; ante 8 needs multiplicative scaling, because additive effects simply cannot reach 150,000.

Endless mode continues past ante 8 with requirements growing by `1.5 + 0.25(n-8)` each ante. Scores are doubles and are displayed in scientific notation past 1e11, so nothing overflows into nonsense.
