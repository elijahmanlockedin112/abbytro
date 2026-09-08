# ABBYTRO — FEEL.md (art direction + game-feel spec)

Canvas 2D, logical 1280×720, letterboxed. All numbers are logical pixels / milliseconds unless stated. Everything is procedural (`ctx` only); emoji allowed for joker glyphs. Names use the display names from `design/RULES.md` with the code keys from `src/core/cards.js` in parentheses on first mention.

**Easing** = `Ease.*` from `src/ui/tween.js` (`outCubic`, `inCubic`, `outQuart`, `outQuad`, `inQuad`, `outBack`, `inOutCubic`, `punch`). Time every sequence on `Timeline` so pause freezes it; the ×2/×4 game-speed setting divides every duration and beat in this doc (beat floor 40 → 20 at ×4).

**Draw order** (back to front): felt → grain tile → spotlight → vignette → sidebar/panels → deck pile → hand cards (hovered last) → staging cards → jokers/consumables → particles → popups → tooltips → modal overlays → full-screen flash. Screen shake = one `ctx.translate/rotate` applied to everything below the flash layer.

---

## 1. Identity & mood

Abbytro is a **midnight enamel-pin tabletop**: flat, chunky vector shapes with hard 3px offset shadows on a deep indigo felt instead of green, so every card reads like a sticker pressed onto the table. Numbers are fat, outlined and loud; the ground is cool and dark, the paper is warm cream, and the four suits are saturated, so the only bright things on screen are the things that matter. There is no texture beyond a 3% grain and a vignette; richness comes from motion, outlines and light-additive particles.

### Palette

| Role | Hex | Notes |
|---|---|---|
| Letterbox | `#0D0F14` | page background outside the 16:9 canvas |
| Felt base | `#241F3D` | fill whole canvas |
| Felt grain | ±3% luminance noise | 256×256 offscreen tile, per-pixel `rgba(255,255,255,a)`, a ∈ [0, 0.03]; `createPattern` once, cached |
| Table spotlight | radial (720,520) r 0 → 520 | `rgba(255,240,210,0.06)` → transparent |
| Felt vignette | radial (720,380) r 260 → 900 | transparent → `rgba(0,0,0,0.48)` |
| Sidebar panel | `#2C2747` fill, `#3A3560` 1px border, r 12 | inner wells `#171426`; 1px top highlight `rgba(255,255,255,0.06)` on every panel |
| Text primary / secondary / muted | `#F3EFE6` / `#B8B2CC` / `#7C7793` | |
| Ink (outlines, shadows) | `#171426` | |
| Card paper | `#F7F1E3` | border `#C9C0AC` |
| Hearts | `#E3405F` | |
| Diamonds | `#1FA8A0` | teal, distinct from chips-blue |
| Clubs | `#3E9E5A` | |
| Spades | `#26253B` | |
| Chips | `#4FA3FF` (dark `#2B6FC4`) | |
| Mult | `#FF5A3C` (dark `#B8302A`) | |
| xMult plate | gradient `#FF5A3C` → `#FF2E7A`, text `#FFFFFF` | |
| Money | `#F5C542` (dark `#B98A1C`, text-on-gold `#3B2A00`) | |
| Rarity common / uncommon / rare / legendary | `#7F8FA6` / `#3FBF7F` / `#E04B6A` / `#B36BFF` | legendary adds an animated gold sheen `#F5C542` |
| Positive feedback | `#4CE07E` | |
| Negative / error | `#FF3860` | |
| Disabled | fill `#4A4860`, text `#8B879F` | |
| Overlay dim | `rgba(12,10,24,0.72)` | |
| Blind discs | small `#4FA3FF`, big `#F5C542`, boss `#B36BFF` | |

### Card back recipe (92×128, r 8)
1. Fill `#33306B`, 1px border `#171426`.
2. Inner frame: rounded rect inset 5, r 5, stroke 2px `#E9D8A6`.
3. Inside the frame, clip and draw 45° stripes alternating `#33306B` / `#3B3877`, period 6px.
4. Center rhombus 34×48 filled `#E9D8A6`, stroke 1px `#171426`; letter "A" (Lilita One 26px, `#33306B`).
5. Four dots r 2 `#E9D8A6` at frame corners inset 9.
Joker back (Shroud boss): same recipe at 100×140 with rhombus 38×54 and letter "J".

---

## 2. Typography

- **Display**: `"Lilita One"`, fallback `"Arial Black", Impact, sans-serif`. Numbers, titles, buttons, ranks.
- **UI**: `"Nunito"` 600/800, fallback `system-ui, "Segoe UI", sans-serif`.
- `index.html` currently links Bangers; change the Google Fonts href to `https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800&display=swap`. Draw with fallbacks until `document.fonts.load` resolves, then re-layout once. Outlined text = `strokeText` (lineJoin `round`, `#171426`) then `fillText`.

| Element | Font | Size | Spacing | Outline |
|---|---|---|---|---|
| Round score | Lilita | 52 | 0 | 5px; auto-shrink so width ≤ 208 |
| Chips / Mult counters | Lilita | 34 | 0 | 4px; shrink to ≤ 82 |
| Blind requirement | Lilita | 26 | 0 | 3px |
| Hand-type banner | Lilita | 28 | 1px | 4px |
| Level tag "LVL 2" | Nunito 800 | 13 | 0.5px | none (on plate) |
| Card rank (corner) | Lilita | 20 | 0 | none |
| Face-card center letter | Lilita | 44 | 0 | 3px paper |
| Joker name | Nunito 800 | 13 | 0.3px | 2px ink |
| Joker description | Nunito 600 | 11 | 0 | none; line-height 14 |
| Button label | Lilita | 16 | 0.5px, uppercase | 2px ink |
| Tooltip body | Nunito 600 | 12 | 0 | none; line-height 16 |
| Money readout | Lilita | 26 | 0 | 3px |
| Popup (+chips / +mult) | Lilita | 22 | 0 | 4px ink |
| Popup (×mult) | Lilita | 26 | 0.5px | 4px ink + plate |
| Hands / Discards numbers | Lilita | 24 | 0 | 3px |
| Small labels ("HANDS", "ANTE") | Nunito 800 | 10 | 1.2px uppercase | none, `#7C7793` |

---

## 3. Layout at 1280×720

```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ BLIND    │ [J1][J2][J3][J4][J5]  JOKERS 3/5         CONSUM. [C1][C2]    │  y 18–170
│ SCORE    │                    TWO PAIR  LVL 2  (banner, transient)       │  y 196–240
│ CH × MU  │             [ s1 ][ s2 ][ s3 ][ s4 ][ s5 ]   staging          │  y 248–392
│ hand lvl │                                                               │
│ HANDS DIS│                                                               │
│ MONEY    │       [c1][c2][c3][c4][c5][c6][c7][c8]   hand         [DECK] │  y 440–568
│ ANTE RND │      [ PLAY HAND ] [RANK/SUIT] [ DISCARD ]            52/52  │  y 586–638
│ RUN INFO │                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
```

**Card sizes**: playing card **92×128, r 8**. Joker & consumable **100×140, r 10**. Booster pack 120×176, r 12. Every card's shadow: same rounded rect filled `rgba(23,20,38,0.45)` at offset (0,3), growing to (0,10) while dragged.

**Left sidebar** panel (16,16,232,688):
- Blind info (24,24,216,120): name Nunito 800 13 at y 44; disc r 22 at (56,86); requirement 26px at (96,80); reward "$3" Nunito 800 12 `#F5C542` at (96,106). Progress bar (32,124,200,10) r 5, well `#171426`, fill `#4FA3FF` (boss `#B36BFF`), 2px white leading edge.
- Round score (24,152,216,64): label "ROUND SCORE" at (32,166); number centered (132,196).
- Chips × Mult (24,224,216,72): chips box (32,236,90,48) fill `#2B6FC4` r 8, white text; "×" Lilita 26 centered (128,260); mult box (134,236,90,48) fill `#B8302A`.
- Hand type + level (24,304,216,36): 16px Lilita at x 32; level plate 44×18 at (196,313) fill `#F5C542`.
- Hands (24,348,104,60) and Discards (136,348,104,60), fill `#171426`; label y 360, number y 388 (`#4FA3FF` / `#FF5A3C`).
- Money (24,416,216,52): "$12" 26px `#F5C542` centered.
- Ante (24,476,104,52) "ANTE 1/8"; Round (136,476,104,52) "ROUND 3".
- Run info button (24,536,216,40); Options (24,584,216,40).

**Joker row** panel (264,18,572,152). `slots` = 5 + Void jokers. `spacing = min(112, 448 / max(slots−1,1))`; slot i origin `(270 + i*spacing, 24)` (6 slots overlap 10px; hovered joker drawn last). Empty slot = dashed 1.5px `#3A3560` rounded rect. Label "JOKERS 3/5" Nunito 10 at (270,176).

**Consumables** panel (852,18,412,152), slots right-aligned: `spacing = min(112, 294 / max(n−1,1))`, slot i origin `(1152 − (n−1−i)*spacing, 24)` (n = 2 by default, up to 4 with Stockpile/Hoard). Label "CONSUMABLES 0/2" at (858,176).

**Hand banner** (transient) centered (720,216), §6.

**Staging area** hit rect (404,248,632,144): up to 5 cards, spacing 104, centered on x 720, card center y 320; scoring cards rise to y 308.

**Hand area** rect (300,440,840,128): `spacing = min(100, 668 / max(n−1,1))`, centers `x_i = 720 + (i−(n−1)/2)*spacing`, base center y 504. Fan: `rot_i = (i−(n−1)/2) * 1.2°`, `y_i = 504 + 6*((i−(n−1)/2)/3.5)²`. Works for hand sizes 1–12.

**Buttons**: PLAY HAND (452,586,200,52); sort panel (668,586,104,52) with RANK pill (672,590,96,22) and SUIT pill (672,616,96,22); DISCARD (788,586,200,52).

**Deck pile** (1156,552,92,128): three backs at offsets (0,−2),(0,−1),(0,0), rotations 0°, −1.5°, 1°. Count "44/52" Lilita 16 centered (1202,700).

**Shop** (table area 264–1264; sidebar stays):
- Header bar (264,40,1000,56): "SHOP" Lilita 28 at x 288; "$12" right-aligned at x 1240.
- NEXT ROUND (296,140,180,64) green; REROLL (296,220,180,64) red, label "REROLL $5".
- Card slots panel (500,120,340,176): slot A (556,138,100,140), slot B (684,138,100,140). Playing cards sold here draw at 100×140.
- Voucher panel (872,120,360,176): voucher (1002,138,100,140).
- Booster packs panel (500,330,732,250): pack 1 (726,366,120,176), pack 2 (886,366,120,176).
- Footer tip (Nunito 12 muted) centered (764,660).

**Pack opening** (full table area, overlay dim behind): title "ARCANA PACK · choose 1" at (764,70); offered cards (100×140) centered on x 764 at y 150, spacing 116 (up to 6); your 8-card hand in the normal hand area; buttons USE (452,586,200,52) / KEEP (668,586,104,52, label "KEEP") / SKIP PACK (788,586,200,52).

**Blind select**: header "CHOOSE YOUR BLIND" Lilita 28 centered (764,64); sub "Ante 1 · Round 1" Nunito 13. Columns (294,100,300,560), (614,100,300,560), (934,100,300,560), r 14, fill `#2C2747`. Inside a column at (x,y): title band (x,y,300,44) in the blind color; disc r 40 at (x+150,y+118); requirement (x+150,y+188); reward (x+150,y+224); description box (x+24,y+256,252,90) `#171426`; skip-tag box (x+24,y+362,252,80); SELECT (x+30,y+452,240,52); SKIP (x+30,y+512,240,36). Current column at y 88, scale 1.0; others y 100, scale 0.96, alpha .85. Boss column has no SKIP. Rehearsal voucher adds "REROLL BOSS $10" (x+30,y+512,240,36) to the boss column.

**Game over / win**: overlay dim; panel (340,110,600,500) r 16. Title (640,168) Lilita 48; subtitle (640,208) Nunito 14; stats grid from y 250, row height 34, labels x 380, values right-aligned x 900; buttons (390,528,240,56) and (650,528,240,56).

**Pause / settings**: overlay dim; panel (440,120,400,480) r 16: "PAUSED" y 160; Master volume slider (472,216,336,24) r 12, track `#171426`, fill `#4FA3FF`, knob r 14 `#F3EFE6`; Mute toggle y 262; Reduced motion y 302; Screen shake y 342; Game speed segmented (472,382,336,36) ×1/×2/×4; RESUME (472,470,336,48); ABANDON RUN (472,530,336,40) outlined `#FF3860`. Toggle pill 52×26, knob r 10 travels 26px in 120ms outCubic.

---

## 4. Card rendering recipe

### Playing card (92×128, r 8), coordinates local to card top-left
1. Shadow rounded rect at (0,3) `rgba(23,20,38,0.45)`.
2. Paper `#F7F1E3`; border 1px `#C9C0AC` at 0.5 inset; top highlight 1px `rgba(255,255,255,0.6)` from (8,1) to (84,1).
3. Corner index top-left: rank at (8,6) top-aligned, Lilita 20, suit color; suit glyph size 14 at (8,30). Bottom-right: same pair rotated 180° (translate (92,128), rotate π).
4. Suit glyphs (size s, center cx,cy):
   - Heart: `moveTo(cx, cy+.45s); bezierCurveTo(cx−.9s, cy−.2s, cx−.45s, cy−.65s, cx, cy−.25s); bezierCurveTo(cx+.45s, cy−.65s, cx+.9s, cy−.2s, cx, cy+.45s)`.
   - Diamond: polygon (cx,cy−.55s) (cx+.42s,cy) (cx,cy+.55s) (cx−.42s,cy).
   - Club: circles r .22s at (cx,cy−.22s), (cx−.22s,cy+.06s), (cx+.22s,cy+.06s); stem trapezoid width .14s at cy+.05s → .3s at cy+.5s.
   - Spade: heart rotated 180°, scaled .9, shifted up .08s, plus the club stem.
5. Center pips, size 14: columns `L=28, C=46, R=64`; rows A `[28,46,64,82,100]` (a1..a5), rows B `[28,52,76,100]` (b1..b4). Pips below y 64 rotate 180°.
   2: C·a1, C·a5 · 3: + C·a3 · 4: L/R·a1, L/R·a5 · 5: 4 + C·a3 · 6: L/R·a1,a3,a5 · 7: 6 + C·37 · 8: 6 + C·37, C·91 · 9: L/R·b1..b4 + C·64 · 10: L/R·b1..b4 + C·40, C·88.
   Ace: one pip size 40 at (46,64) inside a 1.5px ring r 30, suit color alpha .35.
6. Face cards (J/Q/K): inner frame rounded rect (20,30,52,68) r 6 (clear of both indexes), stroke 2px suit color alpha .5, filled with 45° stripes suit color alpha .08 period 5. Center letter Lilita 44 suit color, 3px paper stroke, at (46,68). Crest at (46,42): J = one suit glyph size 12; Q = tiara (three triangles base 8 height 8 at x 38/46/54); K = crown (rect 24×6 + three triangles height 9).
7. **Enhancements** (tint replaces paper; badge = circle r 9 at (17,111), 1.5px `#171426` border, glyph Lilita 11 white):
   - Gilt (`bonus`): tint `#E6EEF9`, inner border 2px `#4FA3FF` alpha .6 inset 3, badge `#4FA3FF` "+".
   - Ember (`mult`): tint `#FBE6E0`, inner border `#FF5A3C`, badge `#FF5A3C` "M".
   - Chameleon (`wild`): paper normal; diagonal ribbon 16px wide at 45° through center made of the 4 suit colors, alpha .35; badge `#B36BFF` "C".
   - Crystal (`glass`): paper alpha .55 (felt shows through), border 1.5px `#BFEFFF`, two white streaks at 35° (widths 6 and 3, alpha .5, from x 20 and 34 at the top edge).
   - Iron (`steel`): vertical gradient `#D9DCE3` → `#AEB3BF` (50%) → `#D9DCE3`, border 2px `#7C8493`, four rivets r 2 inset 6.
   - Slab (`stone`): fill `#8C8A85` + grain, no index or pips, ellipse 44×34 `#6E6C68` with "50" Lilita 18 `#F3EFE6`; border 2px `#5A5955`.
   - Coin (`gold`): gradient `#F2D27A` → `#D9A93F`, border 2px `#B98A1C`, index color `#7A5A10`, badge `#F5C542` "$".
   - Charm (`lucky`): tint `#E9F7E6`, inner border `#3E9E5A`, badge `#3E9E5A` drawn as four r 3 circles (clover).
8. **Editions** (after pips, clipped to the card):
   - Gleam (`foil`): border 2px `#BFD7FF`; sheen band 40px wide at 60°, stops `transparent → rgba(255,255,255,.45) @.5 → transparent`, x from −40 to 132 over 2200ms linear, 800ms pause, loop; composite `lighter`.
   - Prism (`holo`): border 3px with a gradient along it `hsl(h,90%,65%) → hsl(h+120,…) → hsl(h+240,…)`, `h = (t/20) mod 360`; inner sheen same gradient alpha .12 composite `overlay`.
   - Aurora (`poly`): full-face 5-stop rainbow (`#FF5A3C #F5C542 #3E9E5A #4FA3FF #B36BFF`) at 30°, offset `(t/3000) mod 1`, alpha .30, composite `overlay`.
   - Void (`negative`): paper `#1B1830`, index/pips lightened (spades → `#F3EFE6`, other suits +25% lightness), border 1px `#8F7CFF`, shadow pass gets `shadowBlur 14, shadowColor #8F7CFF`, plus wisps (§7).
9. **Seal**: circle r 8 at (78,14); Mint (`gold`) `#F5C542` / Echo (`red`) `#FF4E42` / Augur (`blue`) `#4FA3FF` / Twin (`purple`) `#B36BFF`; 1.5px `#171426` border; highlight arc r 5 `rgba(255,255,255,.5)` top-left quadrant.
10. **Debuffed**: fill card rect `rgba(74,72,88,.55)` then `rgba(255,56,96,.12)`; red X 3px `#FF3860` alpha .85 from (16,16)→(76,112) and (76,16)→(16,112). Hover lift limited to 4px, no rotation.
11. **Face-down** (Blindfold boss, deck): back recipe. **Basilisk-locked** card: 14px lock glyph on a `#FF3860` disc r 9 at (46,−4) above the card; deselect attempts buzz.

### Joker card (100×140, r 10)
1. Shadow (0,3). Paper `#F7F1E3`. Border 3px rarity color at 1.5 inset. Legendary: extra 24px gold sheen band at 55° every 3000ms, composite `lighter`, alpha .5.
2. Name band (0,0,100,26), rounded top, fill rarity color; name Nunito 800 13 white, 2px ink stroke, auto-shrink to ≤ 92.
3. Glyph zone (0,26,100,64): emoji font-size 40 centered (50,60) over a soft disc r 26 `rgba(23,20,38,.06)`.
4. Description plate (6,92,88,42) r 5 `#EFE8D6`; Nunito 600 11 `#2B2740`, line-height 14, ≤ 3 lines; tokens `+N Mult`/`×N Mult` → `#B8302A`, `+N Chips` → `#2B6FC4`, `$N` → `#9A6E00`, hand names → `#4A3F8F`.
5. Shop price tag: 44×22 r 6 at (28,−14), fill `#F5C542`, 1.5px `#171426`, "$6" Lilita 15 `#3B2A00`; bobs with the card.
6. Sell tag on hover (owned): 46×24 r 6 at (−50,12), fill `#2C2747`, 1px `#F5C542`, "SELL $3" Nunito 800 10 `#F5C542`; fades in 120ms; clicking it sells.
7. Disabled joker (Gremlin): same overlay + X as a debuffed card. Face-down joker (Shroud): joker back.
8. Consumables (Arcana / Star / Phantom): same recipe, band colors `#B36BFF` / `#4FA3FF` / `#1FA8A0`, border 2px `#3A3560`. Vouchers: band `#F5C542`, glyph zone shows a big "V" Lilita 40.

---

## 5. Card physics ("the wobble")

Every card owns springs for position, rotation and scale, driven by `src/ui/spring.js` (force form `a = (target−x)·k − v·c`, sub-stepped at 1/240 s, `kick(dv)` for impulses). Render at `spring.x`, never at target. The class default (180, 18) is too soft for cards; use:

```js
import { Spring, Spring2 } from './spring.js';
const pos   = new Spring2(x, y, 320, 22);  // ζ = c/(2√k) = 0.61 → ~10% overshoot
const rot   = new Spring(0, 260, 18);      // ζ 0.56
const scale = new Spring(1, 400, 20);      // ζ 0.50, bounciest
// while dragging: pos k = 900, c = 40 (tight); restore on drop
pos.to(tx, ty);  scale.kick(1.8);  rot.kick(9);   // set targets, add impulses
```
Springs sleep via `settled`. Impulse units: position px/s, rotation rad/s, scale 1/s.

- **Hover**: pos target dy −22, scale target 1.08, rot target `clamp((mouseX − cardCenterX)/46, −1, 1) × 3°` (leans toward the cursor). Hovered card drawn last; neighbors get dx −6 / +6.
- **Selection pop**: target dy −36 from fan base; on select `pos.kick(0, −600)`, `scale.kick(1.8)` (peaks ≈ 1.06). Deselect: target back, `pos.kick(0, 240)`.
- **Idle sway** (added after the spring): `rot += 1.2° · sin(2π t/2600 + i·0.9)`, `y += 1.5 · sin(2π t/3100 + i·1.3)`. Jokers: 0.8°, period 3400, phase i·1.1. Sway continues while hovered/dragged.
- **Drag to reorder** (hand cards and jokers): begins after 6px of movement with the button down. Position follows the cursor through the tight spring; scale target 1.12; shadow offset (0,10). Tilt: `rot.target = clamp(vx/60, −14, 14)°`, `vx` = cursor horizontal velocity in px/s (EMA over 3 frames). When the dragged center crosses the midpoint between two slots, swap indices; displaced cards spring to their new slots. Release: restore (320, 22), scale target 1, rot target = fan rotation.
- **Deal-in** from the deck pile center (1202,616): stagger 70 per card, flight 380, quadratic Bezier with control point `mid + (0,−140)`, `t` eased outCubic; rotation 25° → slot rotation; scale 0.85 → 1.0; flip at t 0.5 (draw back scaled x by `|cos πt|` before, face after). On landing hand over to the spring with `pos.kick(0, 180)` for one settle bounce. Sound per card (§9).
- **Discard fly-off**: per selected card, stagger 50: tween 420 inCubic to `(1380, y−60)`, rotation `+= 380°·t`, scale → 0.8, alpha 1 until t .7 then → 0. Remaining hand re-spaces through springs, then deal-in replacements.
- **Play-to-staging**: set target to the staging slot with stagger 60 and `pos.kick(0, −300)`; rot target 0.

---

## 6. The scoring sequence

`beat = 120` at click. After **every** trigger: `beat = max(40, beat × 0.9)`. xMult triggers hold `max(60, beat × 1.5)`. The engine's step list (RULES §4) is the animation script; timeline from clicking PLAY HAND:

| t (ms) | Event |
|---|---|
| 0 | Button squash (§8), play whoosh (§9), sidebar buttons disabled, `chipStep = 0` (§9). |
| 0 → 300 | Selected cards fly to staging (stagger 60). Non-scoring kickers stay at y 320, alpha .85; scoring cards target y 308. |
| 420 | **Hand banner** at (720,216): "TWO PAIR" + plate "LVL 2". Scale 1.6 → 1.0 over 180 outBack, alpha 0 → 1 over 60. Simultaneously base chips and mult **slam** into the counters: values set, each box `scale.kick(3)` (peaks 1.35), box flashes white alpha .9 → 0 over 80. Sounds: chip blip + mult thud. |
| 760 → 980 | Banner whips to the sidebar hand-type slot (24,304): 220 inCubic, scale 1.0 → 0.57; slot punches (1.18) on arrival. |
| 900 | First scoring-card beat. |

**Per scoring card, left to right** (each line consumes one `beat`):
1. Card bounce `scale.kick(2.4)` (peaks ≈ 1.15), `pos.kick(0, −260)`. Chip popup "+11" (chips-blue) from card top-center. Chips counter `+= 11`: digits roll (§8), box `scale.kick(2)`, box flashes chips-blue alpha .5 → 0 over 160; 6 chip sparkles (§7). Sound: chip blip at `chipStep`, then `chipStep += 2`.
2. Enhancement / edition / seal, one beat each, in the engine order (+chips → +mult → ×mult): Gilt "+30" blue, Slab "+50" blue, Gleam "+50" blue, Ember "+4 Mult" red, Prism "+10 Mult" red, Charm "+20 Mult" red and/or "+$20" gold, Crystal "×2 Mult" and Aurora "×1.5 Mult" on the xMult plate with a shockwave ring. Smaller bounce `scale.kick(1.2)`. Mint seal: "+$3" gold popup + coin burst to the money readout. Augur seal: "STAR" popup blue + level-up star burst on the consumable slot. Echo seal: popup "AGAIN" white with a 2px `#FF4E42` plate border, then steps 1–2 repeat.
3. Each joker reacting to this card, left to right: joker **jiggle** `rot.kick(±9)` (alternate sign per trigger; visually ±6°, settles ≈ 250), `scale.kick(1.6)`. Popup over the joker (jokers sit at the canvas top, so spawn at the face center `(slotX+50, 94)` and rise 32 instead of 44, stacking upward): "+4 Mult" red, "+20 Chips" blue, "×1.5 Mult" plate + ring. Counter punches as in step 1. Sound: mult / chip / xmult (§9).

**Held-in-hand triggers** (RULES step c): each hand card with a held effect (Iron ×1.5, jokers' onHeld) bounces in place as in step 1, popup above it, jokers react as in step 3.

**Independent jokers** (step d), left to right, one beat each: Gleam "+50 Chips" / Prism "+10 Mult" first, the joker's own effect, then Aurora "×1.5 Mult"; jiggle + popup + counter punch. Retrigger jokers show "AGAIN" on the affected joker first.

**Special cases**: Undertow: after step d the chips box shakes x ±4 for 200 and shows "÷2" in `#FF3860`, counter rolls down. Monocle / Litany zero-score hand: banner shows the hand name struck through in `#FF3860`, counters slam to 0, error buzz, cards fly off after 500. Toll first hand: cards fly off as a discard, no banner. Crystal shatter rolls and Cinder destruction run after the final multiply (below), before the fly-off: shatter / burn effects (§7).

**Final multiply** (starts `beat × 2` after the last trigger, `tf` = that moment):
- `tf → tf+180`: chips box and mult box slide 20px toward each other (inQuad); the 12px gap closes and they overlap 28px at contact, hiding the "×" (which scales 1.0 → 1.6 during the slide).
- `tf+180`: contact. White flash over the chips×mult panel alpha .9 → 0 in 120; shockwave ring at (128,260); screen shake (below); xMult chord. Both boxes `scale.kick(3)`; position targets snap home so they rebound apart through the spring.
- `tf+180 → tf+580`: round score counts old → new total, `value = lerp(old, new, outQuart(t))` formatted per the rules below; score font scale 1.25 → 1.0 through the scale spring; rising tone plays for 400.
- `tf+580`: score **slams** into the blind bar: fill animates old → new fraction over 320 outCubic with a 4px white leading edge; bar container scale y 1.2 → 1 through the spring; shake A 4; thud. Chips and mult boxes drop out (y +14, alpha → 0 over 160) and refill with 0 at `tf+760`.
- Not beaten: staging cards fly off at `tf+900`, replacements deal in, buttons re-enable when the last card lands.

**Screen shake**: `A = clamp(4 + 14 × score/requirement, 0, 18)`; if `score ≥ requirement`, `A = clamp(A + 6, 0, 24)`. Duration 260; per frame offset `(rand(−A,A), rand(−A,A)) × (1 − t/260)²`, rotation `rand(−.4°,.4°) × A/24 × (1 − t/260)²`. Boss defeat: A 24, duration 360. Off when the Screen shake toggle is off.

**Blind cleared** (the moment the bar reaches full):
1. Full-screen white flash alpha .5 → 0 over 200 (boss: .7 → 0 over 300).
2. Blind panel cracks: 5 lines from (132,84) to random rim points, 2px white alpha .8, drawn over 80; then the panel splits into a 2×3 grid of quads with vertices jittered ±8; shards fly from the panel center at 120–260 px/s, gravity 900, spin ±360°/s, fade over 700. Behind them the panel re-renders "BLIND CLEARED" (Lilita 22 `#4CE07E`) scale 1.5 → 1 outBack 220. Boss: 12 shards and the bar shatters too.
3. Confetti 120 (boss 220) from the panel top (132,24) and the staging center (720,320) (§7). Sound: blind-cleared arpeggio (boss version).
4. Staging cards fly off (stagger 40). At +600 the **cash-out panel** (440,180,400,320) drops from y −340 over 400 outBack; rows appear every 140 in the RULES order ("+$3 Coin cards", "+$1 Interest", "+$3 Blind reward", "+$2 Remaining hands"), each with a 6-coin burst to the money readout; "CASH OUT $9" button (472,430,336,52) appears last.

**Popup style**: Lilita 22 (xMult 26), fill per type, 4px ink stroke; xMult sits on a plate (padding 8, r 8, xMult gradient, 2px ink border). Spawn at the source top-center. Lifetime 720: `y = y0 − 44 × outCubic(t/720)`; scale 0.4 → 1.15 over 90 outBack then → 1.0 by 200; alpha 1 until 520, → 0 at 720; rotation fixed at spawn `rand(−6°, 6°)`. **Stacking**: popups from the same source within 400 spawn `18 × stackIndex` higher and `±6` x alternating (max stack 4); older stack members are pushed a further 10 up over 80 when a new one spawns. Global cap 40; cull oldest.

**Number formatting** (`src/ui/fmt.js`): `n < 1e6` → thousands separators; `< 1e9` → `n/1e6` to 2 decimals with trailing zeros trimmed + "M" (12.5M, 123.46M); `< 1e11` → same with "B"; `≥ 1e11` → `toExponential(2)` ("1.23e11"); non-finite → "naneinf". Counters floor to integers (mult keeps 2 decimals); the count-up eases the value, then formats.

**Reduced motion** (settings toggle; also honor `prefers-reduced-motion`): keeps popups (fade in place 400, no rise, no rotation), counter ticks, sounds, bar fill, banner (fade only), staging move (instant reposition + 120 fade). Removes screen shake, deal arc (cards fade in at slot over 120), discard spin (fade 160), idle sway, hover rotation (lift 8 only), punches and jiggles, sheen/holo/rainbow animation (static frame), dust drift. Particle counts ÷4 (`particles.reducedMotion`); confetti and shards skipped (flash at alpha .3 instead). `beat` fixed at 90.

---

## 7. Particles & effects catalogue

Pool = `src/ui/particles.js` (`emit(cfg)`; angles in radians, −1.57 = up, `arc` = cone width, `size` = diameter px, `spin` rad/s, `life` ms). Design budget 300 alive; the pool hard-caps at 400 by evicting the oldest. Shards, wisps, coin flights and dust are small custom lists, not pool particles.

| Effect | `emit()` config / recipe |
|---|---|
| Chip sparkle (per chip trigger) | `{n:6, spread:10, angle:-1.57, arc:2.44, speed:[60,140], gravity:200, life:[320,480], size:[5,7], colors:['#9FD0FF','#FFFFFF'], shape:'spark', blend:'lighter', spin:[-6,6]}` |
| Mult ember (per mult trigger) | `{n:5, spread:20, angle:-1.57, arc:0.6, speed:[80,160], gravity:-120, life:[500,700], size:[6,8], colors:['#FF5A3C','#FF7A4A','#FFB03A'], shape:'circle', blend:'lighter'}` (x wobble `sin(age/100+φ)×1.5`) |
| xMult shockwave | ring `{n:1, speed:[0,0], gravity:0, life:[380,380], size:[30,30], colors:['#FFFFFF'], shape:'ring', blend:'lighter', shrink:false}` (radius 12 → 78) + sparks `{n:12, angle:0, arc:6.28, speed:[180,320], gravity:0, life:[300,300], size:[5,6], colors:['#FFD08A'], shape:'spark', blend:'lighter'}` |
| Money coin burst | custom: `min(12, 4+amount)` coins, r 5 disc `#F5C542` with 2px `#B98A1C` border and a highlight arc; launch 120–260 px/s in a cone −1.57 ± 0.87, gravity 900; from 360ms each homes to (132,442) with inCubic over its remaining life (total 700); on arrival the readout +1, punches, coin ping. |
| Card shatter (Crystal) | custom: draw card to an offscreen canvas, cut into 3×4 quads with vertices jittered ±6; each shard: outward 150–350 px/s + up 100, gravity 1100, spin ±9.4 rad/s, life 800, alpha fade last 300 (`drawImage` with a clip path per quad). Plus `{n:20, spread:40, angle:-1.57, arc:3.14, speed:[80,200], gravity:600, life:[400,700], size:[4,6], colors:['#BFEFFF','#FFFFFF'], shape:'spark', blend:'lighter'}` and the shatter sound. |
| Card burn (destroy) | custom: burn line sweeps y 128 → 0 over 500; clip hides the card below the line; line 1px `#FFB03A` with `shadowBlur 8`; card scale 1 → .6 over 500. Every 42ms along the line: `{n:1, x:rand along line, angle:-1.57, arc:0.8, speed:[40,120], gravity:-80, life:[400,600], size:[5,6], colors:['#FFB03A','#FF5A3C','#553322'], blend:'lighter'}`; at the end `{n:10, angle:1.57, arc:0.6, speed:[20,40], gravity:60, life:[900,900], size:[2,2], colors:['#4A4858'], shape:'square', shrink:false}`. |
| Confetti (blind clear) | `{n:120 (boss 220, split over 2 emit points), spread:20, angle:-1.57, arc:2.09, speed:[200,520], gravity:700, drag:0.985, life:[1400,2000], size:[8,12], colors:['#FF5A3C','#4FA3FF','#F5C542','#3E9E5A','#B36BFF','#F7F1E3'], shape:'confetti', spin:[-12,12], shrink:false}` |
| Boss defeat shatter | 12 panel shards as in Card shatter (160–320 px/s, gravity 900, life 900) + `{n:30, angle:-1.57, arc:6.28, speed:[250,450], gravity:300, life:[500,500], size:[5,6], colors:['#B36BFF','#FF2E7A'], shape:'spark', blend:'lighter'}` |
| Level-up star burst | `{n:16, angle:-1.57, arc:6.28, speed:[200,380], gravity:300, life:[600,900], size:[10,12], colors:['#F5C542','#FFFFFF'], shape:'star', blend:'lighter', spin:[-6,6]}` from (132,322); level plate scale 1.6 → 1; gold popup "LEVEL UP". |
| Joker purchase glow | card arcs shop → slot over 420 inOutCubic (control point −120 y) then springs; glow `shadowBlur 24` rarity color, alpha .9 → 0 over 600; `{n:10, spread:30, angle:-1.57, arc:0.5, speed:[60,120], gravity:-60, life:[600,600], size:[5,6], colors:[rarity], shape:'spark', blend:'lighter'}` from the card's bottom edge. |
| Void wisps | custom: one every 350 per Void card (max 6): spawn on a random perimeter point, drift outward 10–25 px/s + up 10, life 900, soft disc (radial gradient `#8F7CFF` .35 → 0) radius 8 → 14, composite `screen`, alpha inQuad → 0. |
| Ambient dust | custom: 40 motes over (264,18,1000,686): r 1–2, `#F7F1E3`, composite `lighter`, alpha `[0.06,0.14] × (0.5+0.5 sin(2π t/T))` with T 3000–6000; drift 4–10 px/s, heading += `rand(−.3,.3)` rad/s; wrap at edges. |

---

## 8. UI motion

- **Buttons**: rounded rect r 10 with a 4px darker bevel below (Play `#2F7BE0`/`#1E5AB0`, Discard `#E04A3C`/`#A8302A`, Next Round `#3E9E5A`/`#2C7442`, Reroll `#E04A3C`, Select `#F5C542`/`#B98A1C` with ink text, Skip outline 2px `#7C7793`). Hover: scale target 1.04 (scale spring), white overlay alpha .08. Press: scale x 1.05 / y 0.92 for 80, translate +3 so the bevel collapses to 1px, then spring back; click sound. Disabled (e.g. Quorum without 5 cards): fill `#4A4860`, text `#8B879F`, no bevel, alpha .7, no hover; clicking buzzes. Sort pills: active fill `#F7F1E3` text `#2B2740`, inactive 1px `#7C7793` border text `#B8B2CC`; the active fill slides 120 outCubic.
- **Panels**: shop slides in from y +720 over 360 outBack (≈12px overshoot) and out 260 inCubic; blind-select columns rise from y +720 with 60 stagger, 320 outCubic each, then the current column lifts 12 over 180; overlays dim 0 → .72 over 200; pause panel scales .92 → 1 over 180 outBack; cash-out per §6; game-over panel 400 outCubic from y −520, title punches on arrival.
- **Counter ticks**: per changed digit column, the old glyph scrolls up 1em and the new one enters from below over 90 outCubic, clipped to the digit box. Round-score increases ≥ 1000 count through intermediates over 400 outQuart; chips/mult snap with rolling digits only. Every change punches (1.18 via the scale spring) and flashes the box toward its accent (alpha .5 → 0, 160).
- **Tooltips**: appear 220 after hover start: alpha 0 → 1 and y +6 → 0 over 120 outCubic; hide in 60. Anchored above the source, centered, clamped to an 8px canvas margin (flip below if no room). Panel `rgba(23,20,38,.96)`, 1px `#3A3560`, r 8, padding 8, max width 220, 8px triangle pointer. Title line Nunito 800 12 (rarity/suit colored), body Nunito 600 12 with the joker-plate token coloring. Card tooltips: "K of Spades · +10 Chips", then enhancement / edition / seal lines.
- **Money**: gains fly as coins (§7); the readout increments per arrival with a punch and a coin ping (+1 semitone per coin, reset per burst). Spending: 3 coins fly from the readout to the item over 320 inCubic; readout rolls down over 220 with a squeeze (scale .9 → 1). Cannot afford: readout shakes x `±4 sin(t/240 × 8π)` for 240, flashes `#FF3860` alpha .5 → 0, error buzz.
- **Deck count** rolls like a counter; the pile pops (scale 1.1) on each deal.

---

## 9. Sound design (WebAudio synthesis)

Graph: voices → `sfxGain` → `masterGain` → `DynamicsCompressor` (threshold −12 dB, knee 6, ratio 4, attack 0.003, release 0.12) → destination. Master slider 0–100 → `gain = (v/100)²`; mute → 0 (20ms ramp). Max 24 voices, steal oldest. Every voice starts with a 1ms gain ramp from 0 and is humanized: pitch ±3 cents, gain ±8%, start ±5ms. Noise = 1s white-noise buffer through a BiquadFilter. Envelopes A/D/S/R in ms, S as level 0–1. Helper: `tone({type, f, fEnd, glide, A, D, S, R, gain, filter:{type,f,Q}})`.

| Event | Synthesis |
|---|---|
| Card hover tick | square 1800 → 1400 Hz over 20, lowpass 3 kHz, A1 D25 S0 R10, gain .08, freq ±5%; rate-limit 1 per 40ms |
| Card select | triangle 520 → 780 Hz glide 40, A2 D70 S0 R40, gain .25; + noise click highpass 4 kHz 15ms gain .10 |
| Card deselect | triangle 640 → 420 Hz glide 50, A2 D60 S0 R40, gain .20 |
| Deal card (index i) | noise bandpass 2500 Hz Q 1.2, A1 D45 S0 R30, gain .18; + sine `300 + 30·i` Hz A1 D60 gain .12 |
| Play hand whoosh | noise bandpass sweeping 400 → 2400 Hz over 220 (Q .8), A20 D180 S0 R100, gain .30; + sawtooth 90 → 60 Hz lowpass 200 Hz 180ms gain .20 |
| Chip gain | square `f = 660 × 2^(chipStep/12)`, chirp `f×1.06 → f` over 30, lowpass 4 kHz Q 2, A1 D90 S0 R40, gain .22. `chipStep += 2` per trigger of any type, cap +24; reset to 0 on Play Hand and after the final multiply |
| Mult gain | triangle at `220 × 2^(chipStep/12)` + sine one octave below, rising into pitch from `f×0.94` over 60, lowpass 1800 Hz, A2 D140 S0 R80, gain .28 |
| xMult | sawtooths at f, f×1.25, f×1.5 with `f = 110 × 2^(chipStep/12)` (cap +12), lowpass 900 → 3000 Hz over 120 Q 3, A5 D260 S.2 R220, gain .18 each; + sub sine 70 → 40 Hz over 120, A1 D200, gain .5; + noise slap highpass 2 kHz 30ms gain .15 |
| Score count-up | sine + triangle unison, `f = 300 + 600 × outQuart(t/400)`, vibrato 6 Hz ±8 cents, gain .18 for 400 then R60. Bar slam: square 180 Hz 40ms lowpass 600 + noise thud lowpass 300 Hz 80ms, gain .40 |
| Blind cleared | triangle arpeggio C5 523, E5 659, G5 784, C6 1047 at 90 spacing, each A3 D260 S0 R200 gain .25; + sine pad C4 261 A40 D600 gain .15; + sparkle noise highpass 6 kHz 300ms gain .08 |
| Boss cleared | sawtooth (lowpass 2.5 kHz) arpeggio C4 E4 G4 C5 E5 G5 C6 at 70 spacing gain .22; + sub sine 55 → 30 Hz 400ms gain .6; + shatter: 4 noise bursts bandpass 3 kHz Q .5, 60ms each at 0/40/90/150, gain .35 |
| Crystal shatter / card burn | shatter: 3 noise bursts bandpass 3.5 kHz Q .7, 50ms at 0/30/70, gain .3 + sine 2600 Hz D120 gain .12. Burn: noise lowpass 900 Hz, A60 D400 gain .2 + sawtooth 80 Hz lowpass 300 D400 gain .12 |
| Coin | sines 2093 + 2793 Hz (inharmonic 1.334) + triangle 1046, highpass 800 Hz, A1 D180 S0 R120, gain .20, ±4% pitch; successive coins in a burst +1 semitone, reset per burst |
| Buy | coin + triangle 440 → 660 Hz slide 80, A2 D160, gain .25; + sine 120 Hz 60ms thunk gain .30 |
| Sell | triangle 660 → 440 Hz slide 100, A2 D160, gain .22; + coin pitched −3 semitones |
| Reroll | noise bandpass 1200 Hz Q .6, three 40ms bursts at 0/50/100, gain .20; + square 300 → 500 Hz 100ms lowpass 1500 gain .12 |
| Error / can't do | sawtooth 110 Hz + square 113 Hz (beating), lowpass 500 Hz, A5 D40 S.6 R120, 200 total, gain .20; second hit at 110 |
| Game over | G4 392, Eb4 311, C4 262, G3 196 at 260 spacing, triangle + sawtooth detuned −8 cents, lowpass 1200 → 400 Hz across the phrase, each 320, last R900, gain .25; + sub sine 55 Hz 1200ms gain .30 |
| Win fanfare | square (lowpass 3 kHz) + triangle: C5 C5 C5 E5 G5 C6 at 0/120/240/360/540/720, gain .22, last note A5 D900; + pad C4 E4 G4 sawtooths lowpass 800 Hz A100 D1500 gain .10 each; + sparkle noise |
| Level up | triangle arpeggio C5 E5 G5 at 60 spacing + coin, gain .22 |
| Button click | square 900 → 600 Hz 25ms lowpass 2.5 kHz, A1 D40, gain .15; + noise click highpass 3 kHz 12ms gain .08 |

---

## 10. Juice priority list

1. Card springs: hover lift, selection pop, drag-reorder tilt (§5).
2. Scoring popups with ink outline, rise, stacking + counter punch/flash (§6, §8).
3. Beat-accelerating scoring loop: card bounce, joker jiggle, per-trigger timing (§6).
4. Sound core: hover tick, select, chip-blip pitch ladder, mult, xMult thump (§9).
5. Final multiply: counters collide, count-up, bar slam, screen shake (§6).
6. Deal-in arc with flip + discard fly-off spin (§5).
7. Blind cleared: flash, panel crack/shards, confetti, cash-out coin flights (§6, §7).
8. Button squash/bevel + panel slide transitions (§8).
9. Editions: Gleam sheen, Prism border, Aurora rainbow, Void glow (§4).
10. xMult shockwave ring, mult embers, chip sparkles (§7).
11. Rolling digit counters + tooltips (§8).
12. Ambient layer: idle sway, dust motes, felt grain/vignette, Crystal shatter, burn (§5, §7).

---

## 11. Screens copy

**Title screen**: logo "ABBYTRO" Lilita 96 at (640,230), letters colored in sequence `#F7F1E3 #4FA3FF #FF5A3C #F5C542 #1FA8A0 #B36BFF #3E9E5A`, 6px ink stroke, 6px hard shadow `#171426`, each letter bobbing `4 × sin(2π t/2400 + i×0.5)`. Tagline (Nunito 600 14 `#B8B2CC`): "Poker hands. Absurd numbers. One deck." Buttons (240×52, stacked from y 340, gap 14): "NEW RUN", "CONTINUE" (disabled with sub-label "no saved run"), seed field (240×40) placeholder "SEED — blank for random", "HOW TO PLAY". "v0.1" bottom-right (Nunito 10 muted). Background: felt with 6 giant card silhouettes drifting at 6 px/s, alpha .05.

**How to play** (4 lines): "Select up to 5 cards and PLAY HAND. Your hand's Chips × Mult is your score." / "Beat the blind's requirement before you run out of hands." / "Jokers change the math. They trigger left to right." / "Spend money in the shop between blinds. Interest rewards saving."

**Blind select**: header "CHOOSE YOUR BLIND", sub "Ante 1 · Round 1". Columns "SMALL BLIND" / "BIG BLIND" / "BOSS BLIND"; reward lines "Reward $3" / "$4" / "$5" (Finisher "$8"). Buttons "SELECT" and "SKIP · take tag" with the tag name beneath (e.g. "Double Down"). Boss description = name + RULES effect text, e.g. "VERDIGRIS — All Club cards are debuffed." / "HUSH — No discards this blind." / "UNDERTOW — Chips are halved after jokers." / "RAMPART — 4× requirement." / "ECLIPSE — All cards debuffed until you sell a joker."

**Shop**: header "SHOP"; sub "Round 2 cleared · $12". Buttons "NEXT ROUND ▶", "REROLL $5". Section labels "CARDS", "VOUCHER", "BOOSTER PACKS". Pack titles "ARCANA PACK", "STAR PACK", "DECK PACK", "JOKER PACK", "PHANTOM PACK", "GRAB BAG" with "Standard · pick 1 of 3" / "Jumbo · pick 2 of 5". Pack screen buttons "USE", "KEEP", "SKIP PACK".

**Cash out**: "CASH OUT"; rows "+$3 Coin cards", "+$1 Interest ($1 per $5, max $5)", "+$3 Blind reward", "+$2 Remaining hands"; button "CASH OUT $9".

**Game over**: "RUN OVER"; subtitle "Ante {ante} · Best hand {bestHand}". Stats: "Rounds cleared", "Hands played", "Cards discarded", "Most played hand", "Seed {seed}" with "COPY". Buttons "NEW RUN", "MAIN MENU".

**Win**: "YOU BEAT ANTE 8" (Singularity: "SINGULARITY" with sub "The numbers stopped being numbers."); subtitle "Best hand {bestHand} · {jokers} jokers"; flavor "The deck is yours." Buttons "CONTINUE (ENDLESS)", "NEW RUN", "MAIN MENU". Confetti 60 every 2500 while open.

**Loading / flavor tips** (Nunito 600 13, one at a time, 6s each):
1. "Play fewer, bigger hands. Every unused hand pays $1."
2. "Mult multiplies Chips. ×Mult multiplies Mult. Order matters."
3. "Jokers trigger left to right. Drag to reorder them."
4. "Save a discard for the boss. You'll want it."
5. "Star cards level a hand forever. Level the one you actually play."
6. "Interest pays $1 per $5 held, up to $5. Being rich is a strategy."
