# Deliver the Message

A small side-scrolling platformer in the spirit of Super Mario, built with HTML5 Canvas and vanilla JavaScript only.
No frameworks, no build step, no image/audio assets (every sprite and sound is generated in code).
UI type uses the Staffbase brand fonts (Epilogue + Inter) loaded from Google Fonts; offline it falls back to the system sans-serif and everything still works.

Two levels ship:
* **Healthcare** is a 60-second **score-attack round** through an **endless hospital** (no sections: new stretches are generated ahead of you, different every run; most colleagues are on the mezzanine and walkway): roam a two-floor hospital (floor, mezzanine, walkway) (it starts easy and gets harder the further you go: shorter platforms, scarcer coins, vending machines standing on the upper floors, more lift-shaft pits; trolleys stay on the ground floor. The first **staff corridor** choke point comes about 25 seconds in and the second about 25 seconds after that (never a third): a low-ceilinged tunnel (no platforms, no big jumps) with trolley traffic, where your top speed drops to 60% (`C.ATTACK.TUNNEL_SPEED_MULT`)) and touch as many frontline colleagues
  (nurses, doctors, porters, pharmacists, cleaners; Nurse Leads, the unit managers, count triple and add 3s to the clock) as you can before handover. New colleagues keep
  spawning. The only people are frontline colleagues (plus the CEO): the challenge is physical. Patrolling trolleys and meds/linen
  carts slow you, closed rooms are solid blocks you hop over (tile `R`), and pits are out-of-service lifts.
  Coins add 0.5s. The CEO appears after you leave the first corridor/lounge (placard: All Staff Update / Crisis Comms / Monthly Finance Update) and an HR Manager after the second (New Benefits / Welcome New Starters / Policy Updates). They step out just ahead of you (`C.ATTACK.CHASER_AHEAD_TILES`) and run at you head-on. They steal colleagues they reach first, re-roll their message on each steal, and stun you for 2s if they catch you. There are exactly two corridors (about 6-7 stretches apart); after the second there are none. Enter on the end screen replays instantly.
* **Manufacturing** is the same 60-second round in an endless factory (it shares the generator, `js/levels/endless.js`). Colleagues are operators, welders, packers, drivers and cleaners; **Shift Supervisors** count triple and add 3s. Obstacles are pallet jacks, box trolleys, shipping containers and shelving, plus the factory extras: **forklifts** and **union reps**; all of them slow you down and none score. The two choke-point corridors are the **Loading Bay** and the **Break Room**, with the CEO and HR Manager chasing after them, exactly as in Healthcare.

Finance and Transport are placeholders.

You are an internal Communications employee (you choose the name). A message must reach the nurse in Ward 4 before shift
handover. Managers, pickets, patients and a CEO carrying a *different* message are in the way.

## How to play

| Key | Action |
| --- | --- |
| Left / Right | Move |
| Up or Space | Jump (hold = higher, tap = hop). Also double-jump with the Translation Tool |
| Down | Crouch; on a gurney / trolley / counter it drops you through |
| P or Esc | Pause |
| M | Mute |
| Enter | Confirm menus. On the home screen, move up to the name field and press Enter to edit it (Enter saves, Esc cancels). The mouse works too: click the name or pencil to edit, click the tick or anywhere else to save, click Start to play |

* **Message Integrity** (0-100%) replaces health. The message in the HUD corrupts as it drops.
  At 0% you restart from the last **Manager sign-off** checkpoint.
* **Stomp** Managers ("Approved!"). Middle Managers take two stomps. Executive Assistants take one - and leave a
  pile of rescheduled meetings in the CEO's way.
* **Union Reps** bounce you back and cost a little integrity. Jump over (or on) them. They are not villains.
* **Patients** cannot be hurt. They only slow you down. Jump over them or wait.
* **Beeping Pagers** stun you briefly (stomp them to silence them). **Wet floor signs and coffee puddles** are slippery.
* **"Lift out of service" shafts** cost 20% integrity; you reappear on the near side.
* **The CEO** appears after the first checkpoint and chases you at a gradually varying speed. If he catches you,
  integrity drains fast and his competing message overlays yours. Slow him down: hit the red **door switch** blocks
  (a door slams behind you) or the **linen-cart switch** (a cart tips over), or stomp **Executive Assistants**.
* Every 20 **Engagement** coins restores some integrity.
* **Blocks:** `?` = coins; hidden power-ups: **Clear Subject Line** (speed, 8s), **Executive Sponsor** (invincible, 6s),
  **Translation Tool** (double jump, 10s), **Push Notification** (breaks supply crates, 10s).

## Run locally

Option 1 - just open `index.html` in a desktop browser (it uses plain `<script>` tags, so `file://` works).

Option 2 - serve it:

```bash
python3 -m http.server
# then open http://localhost:8000
```

Add `?debug` to the URL for an FPS / position read-out.

## Deploy to GitHub Pages

1. Put this folder's contents at the root of a GitHub repository (so `index.html` is at the top level).
2. Repository **Settings -> Pages**.
3. **Build and deployment -> Source: Deploy from a branch**, choose branch `main` and folder `/ (root)`, then Save.
4. After a minute the game is live at `https://<user>.github.io/<repo>/`.

There is nothing to build; GitHub Pages serves the files as-is. (The `dev/` folder is an optional test autopilot and
is not loaded by the game.)

## Project layout

```
index.html            page + script tags (plain scripts, no modules)
assets/staffbase-logo.svg   official Staffbase wordmark (Brand Assets folder), shown on the home screen
style.css             centring + crisp (pixelated) scaling
js/constants.js       ALL tuning values (gravity, jump, speeds, CEO, damage...) + LEVELS registry
js/input.js           the only place that knows about keyboards -> abstract actions
js/audio.js           Web Audio sound effects (generated, no files)
js/ui.js              text/shape helpers + sprite helpers (Gfx) and every screen / HUD (UI); Staffbase look lives here
js/player.js          the player
js/attack.js          score-attack round: colleagues (NPCs), spawning, ranks
js/enemies.js         managers, union reps, patients, pagers, assistants, nurse, CEO
js/game.js            Level (tiles, collision, items, barriers), state machine, camera, fixed-step loop
js/levels/endless.js        the shared endless map generator (chunks, tiers, choke-point corridors)
js/levels/manufacturing.js   The endless factory (cast, obstacles, theme and art)
js/levels/healthcare.js   The endless hospital (cast, obstacles, theme and art)
dev/bot.js            optional autopilot used to verify the level is completable
```

Game states: name entry, title (home), choose level, how to play, leaderboard, intro, playing, paused, game over, level complete.
The leaderboard is local: every attempt, delivered or failed, gets one numeric score (tuned in `C.SCORE`) and is kept in this browser's localStorage (`C.BOARD_KEY`), highest first. The leaderboard screen shows **All levels** together by default; a dropdown at the top filters it to one level.
The simulation runs at a fixed 60 Hz step; collision is AABB per axis in steps of at most 6px (no tunnelling).
The canvas is 480x272 logical pixels, drawn on a hi-res backing store (an integer multiple, set in `Game.resize`) so vector
text stays crisp while sprites stay hard-edged (`imageSmoothingEnabled = false` / `image-rendering: pixelated`).

### Gamepad support later

`js/input.js` exposes abstract actions only: `moveLeft, moveRight, jump, up, down, pause, confirm, mute`
(`Input.down / pressed / released`). To add a controller, register a source - no game code changes:

```js
Input.addSource(() => {
  const pad = navigator.getGamepads()[0]; if (!pad) return {};
  return { moveLeft: pad.axes[0] < -0.4, moveRight: pad.axes[0] > 0.4, jump: pad.buttons[0].pressed,
           down: pad.axes[1] > 0.5, pause: pad.buttons[9].pressed, confirm: pad.buttons[0].pressed };
});
```

## Adding a new industry level (Retail, Manufacturing, Logistics...)

A level is **one self-contained file** that registers itself on `LEVELS`.

1. Copy `js/levels/manufacturing.js` (or healthcare.js) to `js/levels/retail.js`. A new score-attack level is an `Endless.make({...})` config (cast, obstacles, signs, corridor names) plus its art.
2. Edit the data:
   * `id`, `title`, `message` (the HUD message that corrupts), `route`, `intro(name)`, `goalLine`, `checkpointLabel`
   * `areas` (name + tile-column range; drives HUD area names, banners and background style)
   * `map`: array of equal-length strings, 17 rows high (one char = 16x16 tile; legend is at the top of the file;
     map row 15-16 is the floor, gaps are pits). `S` = start, `1 2 3` = checkpoints, `N` = goal character.
   * `entities`: `{type, x, y?, range?}` using types `manager`, `middleManager`, `union`, `trolley` (`gurney` / `meds` / `linen`), `forklift`, `drone`, `patient`
     (`wheelchair` / `iv` / `gurney` variants), `pager`, `assistant`. Add new archetypes in `js/enemies.js`
     and `createEnemy()`.
   * `barriers`: things a switch block drops behind the player to slow the CEO (`door` / `cart`).
     Use global map rows (0-16) for `y`.
   * `art`: tile sprites (`tileSprite`), parallax background (`drawBackground`) and `areaStyle` palettes.
     Replace the hospital drawers with your theme.
3. Register it: add `<script src="js/levels/retail.js"></script>` to `index.html` (before `js/game.js`).
4. List it: add (or edit) its entry in `C.LEVEL_LIST` in `js/constants.js` (Finance and Transport are already listed as "coming soon" placeholders; they unlock automatically once `LEVELS.<id>` is registered). Add a glyph for it in `glyph()` / `LEVEL_COLOR` in `js/ui.js` if you want a custom icon.

Tips for level design: the player jumps about 3.9 tiles high and ~6 tiles far; keep pits to 3 tiles or fewer (the CEO
leaps them too), don't put solid blocks directly over takeoff points of jumps, and keep CEO barriers a few tiles away
from shaft landings. `dev/bot.js` (`runBot({god:true})` in the browser console) checks the level is completable.

A level can also set `goalName`, `goalLabel`, `goalLine`, `goalNearLines`, `failLine`, `checkpointLabel`, `doorText` and `pitText`,
and supply a `drawGoal(ctx, sx, y, hop, t)` function to draw its own goal character (see `manufacturing.js`).

### Score-attack mode
A level opts in with `mode: 'attack'` plus `npcStart` and `spawnPoints` (see `js/levels/healthcare.js`, `js/attack.js`).
All its numbers live in `C.ATTACK` (round length, spawn interval, role values, stun/slow times, CEO speed and start time, ranks).
The leaderboard keeps up to `C.BOARD_MAX` (100) scores per level and shows `C.BOARD_PAGE` (10) per page, with page buttons (or Left / Right) beyond that. Shift+R on the home screen resets it.

### Look and camera (Healthcare)
Healthcare is drawn 1.33x closer (`C.ZOOM`, set per level with `zoom` in the level data), so you see about 22 tiles across and
roughly 12 rows below the header strip. The camera only scrolls sideways: its vertical framing is fixed (`C.CAMERA.FIXED_Y`), so it never bobs. An "Upstairs" pill appears when the only colleagues left in this stretch are above you.
The backdrop is deliberately Mario-simple: one flat wall colour with a single skirting line and a few faded, floor-level pieces
(door, window, plant, noticeboard) so the player, colleagues and platforms stand out. Platforms are hospital furniture: gurneys,
wall-mounted medical cabinets and nurse-station counters. Manufacturing uses the same zoom, camera, header, noticeboards and Mario-simple wall, in factory colours (steel, safety orange, hazard stripes), with conveyors, scaffold grates and pallet-rack beams as its platforms.

**Noticeboards:** a board hangs high on the wall roughly every 5th scenery slot, only where no platform, block, machine, trolley or colleague can be in front of it. Edit the `C.NOTICES` list in `js/constants.js` to post your own
messaging: `{ tag: 'HEADER', lines: ['up to 3 short', 'lines of text'], color: '#FF475D' }`. Text auto-shrinks to fit the board.

## Tuning difficulty (js/constants.js)

| Want... | Change |
| --- | --- |
| Easier / harder CEO | `CEO.BASE_SPEED`, `CEO.SPEED_VARIATION`, `CEO.SPAWN_BEHIND_TILES`, `CEO.CATCHUP_MULT`, `INTEGRITY.CEO_DRAIN_PER_SEC` |
| Longer CEO delays | `CEO.BARRIER_DELAY_DOOR / _CART / _PILE` |
| More forgiving damage | `INTEGRITY.MANAGER_HIT`, `UNION_HIT`, `FALL`, `INVULN_TIME` |
| Floatier / snappier jumping | `GRAVITY`, `PLAYER.JUMP_VELOCITY`, `JUMP_CUT_VELOCITY`, `COYOTE_TIME`, `JUMP_BUFFER` |
| Faster / slower hero | `PLAYER.RUN_SPEED`, `ACCEL`, `FRICTION` (keep `CEO` max speed below `RUN_SPEED`) |
| Slipperiness | `PLAYER.SLIP_ACCEL`, `SLIP_FRICTION` |
| Longer power-ups | `POWERUPS.*.time` |
| More healing from coins | `INTEGRITY.COINS_PER_BOOST`, `COIN_BOOST` |

All characters are generic role-based archetypes (CEO, Manager, Union Rep, Executive Assistant, Nurse...). There are no
individual names, real people, real organisations or brands in the game.
