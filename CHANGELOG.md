# Changelog

Every version is also served pinned at `https://chiplets.dev/v<version>/chiplets.js` and never changes.
`/v1/chiplets.js` always points at the newest 1.x. The same paths on chiplets.win serve the same files, forever.

## 1.3.3 — Better guests on other sites
Found by the first embed on someone else's page (a radio station's "play while you listen" corner):
- Keys stay in the game: Space and Enter on a game's buttons, and anything typed into its bet box, no longer reach
  the host page too — so a site's own shortcuts (Space to play or pause a stream, say) don't fire while people play.
- Autoplay stops when the game is hidden — taken off the page, inside a closed tab or panel (`display: none`), or
  the page itself in the background — once the rounds in play land. Scrolling it out of view doesn't count.
- New `sound="muted"`: the game starts muted but keeps its speaker button, so players can turn sound on (the same as
  `data-sound="off"` on the script, for one game). `sound="off"` still silences a game completely.

## 1.3.2 — Sound comes back
- Fixed: on iPhone and iPad, sound could stop for good after switching apps, taking a call or locking the
  screen (Safari leaves the audio "interrupted", and the kit only woke it from "suspended"). The next tap on a
  game now brings it back from any state, and a closed audio context is replaced. Coming back to the tab tries
  too. (The phone's silent switch still silences the games, like other apps.)

## 1.3.1 — A home of its own
- The script's home is now **chiplets.dev**: docs, a playground that builds your snippet, and
  `https://chiplets.dev/v1/chiplets.js`. Snippets that load from chiplets.win keep working — same files.
- The small "chiplets" link under each game, and the note at the top of each file, point to chiplets.dev.
  No other changes; `no-footer` still hides the link.

## 1.3.0 — Engines
- Every outcome now comes from an **engine**; games only animate its answer. The built-in browser engine
  behaves exactly as before. `Chiplets.connect(engine)` swaps in another one (chiplets.win uses its server for
  signed-in players); `Chiplets.engine` says which is active.
- Winnings stay out of the shown balance until the animation lands (a falling ball never gives it away).
- Round rules are shared code (`src/rules/*`), so a server can run exactly what the browser runs.
- Crash only learns its result from the engine, so with a server engine the crash point never reaches the
  browser early. Crash and Mines rounds resume after a reload when the engine still has them.
- `Chiplets.wallet.give/take/reset` only touch the built-in wallet; `refill()` asks the engine.
- chiplets.win: optional accounts (Google, Discord, GitHub), account page, privacy and terms pages.

## 1.2.0 — Feel
- **Sound** for every game, synthesized in the browser (no audio files): reel ticks and thuds, peg pings,
  rising gem chimes, cash-out, explosions, and win fanfares sized to the win. A speaker button (or `M`)
  mutes every game at once and is remembered. `sound="off"` silences one game; `data-sound="off"` starts
  the whole page muted.
- **Vibration** on Android phones, following the sound switch.
- **Big-win celebrations:** 10× and up bursts coins with a counting banner; 100× and up adds confetti and
  a shake.
- **Slots:** suspense on the last reel when the first two match (it always lands where the draw put it),
  winning-line pulse, bouncing winning symbols, turbo.
- **Plinko:** pegs light up and ping as the ball passes, ball trails, drop 5 or 10 balls at once, turbo.
- **Mines:** random-tile button, sparkles, arrow-key movement between tiles.
- **Crash:** a rocket and streaming stars, the auto cash-out target on the chart, a "You" marker where you
  cashed out, and the rest of the round replayed (sped up) so you see where it really crashed.
- **Autoplay** for Slots, Plinko and Crash: number of rounds, stop at a profit target, a loss limit, or a
  single big win. New `chiplets:auto` event; autoplay rounds carry `auto: true`.
- **Keyboard:** Space / Enter for the main button, `M` sound, `T` turbo. Focus rings and screen-reader labels.
- **Reduced motion** respected: no particles, shaking or vibration, short animations.
- Games reserve about the right height while loading, so pages don't jump.
- New: `Chiplets.sound.muted`, `Chiplets.sound.toggle()`. Attributes `no-auto`, `turbo`, `sound="off"`.
- Fixed: the bet box stayed locked after autoplay ended (pre-release).

## 1.1.0 — Foundation
- Split into a small core plus one file per game, loaded only when a page uses it.
- Versioned URLs: `/v1/` (latest 1.x) and pinned `/v1.x.y/` (cached for a year). `chiplets.all.js` bundles
  everything in one file. The original `/chiplets.js` keeps working.
- Fixed: a click in the very first moment after Plinko appeared did nothing.
- Fixed: tapping right as a Crash or Mines round ended could start a round you didn't mean to play
  (short lockout after each round).

## 1.0.0 — 2026-10-18
- Slots, Plinko, Mines and Crash as `<chip-*>` web components with a shared play-money wallet, 99% return
  on every game, themes, events and a JavaScript API.
