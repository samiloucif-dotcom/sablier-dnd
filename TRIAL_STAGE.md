# Class Trial stage (Danganronpa-style camera)

Added 2026-10-13, reworked 2026-10-14. A courtroom you drive from a GM dashboard; the players watch it — and take part — on their own screens.

## Where it lives
| Who | URL |
|---|---|
| GM dashboard | `GM_PATH/trial` (link "⚖ Class Trial stage" bottom-right of the cockpit) |
| Players | `/trial` — they pick their character; the stage shows a waiting screen until you press **Court closed → Court in session** |

## The stage
The courtroom is seen from the front: **defense on the left, the jury in the centre, the prosecution on the right, and the bench (Polychroma + her two specialists) raised above the jury's centre**, in front of the three thrones of the tribunal.

- **Seat people:** drag a token from the pool onto a seat (or tap it, then tap a seat). Drop on an occupied seat = swap. Drag back to the pool = out of the room.
- **Give the floor:** click a seated token. The camera moves to them past everyone in between, then slows and settles. It pans left/right and tilts up/down together: jury → bench goes straight up, prosecution → bench goes diagonally up-left. Click the same person again = punch-in.
- **Prosecution seats 1–5:** when one of them speaks, the other four step in behind them, out of focus.
- **A juror is convinced:** drag them from the jury to a "Joined the…" seat. While the court is in session, every screen stages it: the camera goes to them in their old seat, rides with them as they walk to the new one, and a banner plays. Their podium changes colour (red defense / cyan prosecution / gold jury / violet bench).

  | Move | Banner |
  |---|---|
  | jury → defense | **NAME** joined the Defense team (red) |
  | jury → prosecution | **NAME** joined the Prosecution team (cyan) |
  | defense or prosecution → a jury seat | **NAME** is back on the Jury pool (gold) |
  | defense ↔ prosecution | **NAME** switched sides! (red-to-cyan, with a shake) |

  Only NPCs get a banner (not the five PCs). Several drags in a row are staged one after the other. Dragging someone down to the token pool still just takes them out of the room (no banner); while the court is closed, moves are silent too. Afterwards the camera stays on them, and they show as ON STAGE on your dashboard.
- **Wavering (Resolve 4):** click the small **〰** on an NPC's token. Their sprite trembles every couple of seconds on every screen, and so does their token in the players' side tracker. Click 〰 again to stop. It also stops by itself when they change area, leave the room, or the room is cleared.
- **Sweep (S):** from where the camera is, it slowly pans along the 16 Primes — to the nearer end of the line, then across to the other end — at their level (not up to the bench), and comes back to whoever had the floor.
- **Dragging near the top or bottom of the window scrolls the page**, so a token from the pool can go straight up to the bench.
- **⛶** on the preview shows it full-window (Esc to come back).

## Banners
Leave the box empty: each button plays its own words. **Type in the box, then click any button: your words flash in that style.** A `/` makes two lines. Enter = last style used, ↑ = your last words. The box empties after each flash.

| Button | Key | Look |
|---|---|---|
| CLASS TRIAL | | gold on violet; `Title / subtitle` |
| NON-STOP DEBATE | N | two pink bands sliding in from both sides |
| BREAK! | B | red band, the words crack in two |
| ABOUT TO TIP | T | amber band, the words rock like a scale |
| COUNTER! | C | the speaker's cut-in art (Askii, Bardik, Angèle, Müne, Pryah); with your words, a cyan band |
| I AGREE! | A | green band |
| Reveal | R | cinema bars, slow golden serif |
| SHOCK! | X | red flash, sunburst, heavy shake |
| whisper… | W | quiet line low on screen |
| SLAM | | violet band |

Keyboard letters always play the default words.

## The players
On `/trial` each player:
1. **Picks their character** among Angèle, Pryah, Askii, Müne and Bardik. A taken character is locked for everyone else. The choice is remembered on that device (reloading keeps it). "Just watch" = spectator. "Change character" (their name, bottom-left) lets go.
2. **Presses SPEAK** — they take the floor: the camera moves to their character on every screen, yours included, exactly as if you had clicked their token (no banner). One per 1.2 s per player; only while the court is in session and their character is seated.
3. **Presses REACTION!** — to interrupt: the camera moves to them and the REACTION banner plays once it lands. One per 2.5 s per player; only while the court is in session.
4. **Wears emotes** — five buttons at the bottom. Emote 1 is their own sprite and can't be changed. Emotes 2–5: they give a name and upload a picture (shrunk and trimmed in their browser; a PNG with a transparent background looks best). Clicking an emote swaps their sprite for everyone, without moving the camera.
5. **Sees who sides with whom** — around the stage, the 11 NPC Primes' tokens: Defense in the left strip, Prosecution in the right one, the Jury along the top, each with a count. A token moves to its new strip when the NPC starts walking on stage. Trembling tokens = wavering. **⚖** (or T) hides/shows the strips on that screen. Hidden while the court is closed.

**SPEAK / REACTION switches:** the two pills in your top bar ("Players · SPEAK · REACTION"). Click one to switch it off for the whole table (it turns grey and struck through); click again to switch it back on. With both off, the players' buttons read "listen" under a "THE JUDGE ASKS YOU TO LISTEN" label.

On your dashboard, **Players at the table** (under the defense) shows who is playing whom and what emote they wear: **Release** frees a character (lost phone, wrong pick), **↺** puts someone back on their own sprite.

## Files
| File | Role |
|---|---|
| `trial_core.js` | Cast list, seats, the line order, banner styles, the GM reducer and the player actions. **Public file** — no GM secrets in it. |
| `trial_server.js` | Shared state + emote pictures. Saves the room (seats, open/closed, who is wavering) and the players' side (who plays whom, emote names, SPEAK/REACTION switches) to `trial.json`, the pictures to `trial_emotes/`, and — with GH_TOKEN — all of it to the GitHub `data` branch like the timeline and the board. Clicks, banners and side-change moments are never saved. |
| `trial_stage.js` | The stage renderer (camera, tilt, group shot, background, banners, emotes, synthesised sound). Used by both pages. |
| `trial_gm.html`, `trial.html` | The two pages. |
| `trial_bg.jpg` | The tribunal (`07_Citadel and maps/Scenes/X Class Trial Tribunal`), 2048 px wide. |
| `public/sprites/<key>.webp` | Transparent full-body sprites, cropped from `01_Characters/transp/`. |
| `public/cutins/<key>.webp` | COUNTER cut-ins, from the five `Trial_Counter_*.jpeg` images. |
| `public/tokens/token_angele.webp` | New token (the others were already there). |
| `server.js` | Hooks: require, public routes (`/trial`, `/trial/state`, `/trial/play`, `/trial/emote/…`, `/trial_core.js`, `/trial_stage.js`, `/trial_bg.jpg`, `/sprites/`, `/cutins/`), GM routes, POST. |

## Changing things
- **Add a character:** one line in `CAST` (`trial_core.js`) + `public/sprites/<key>.webp` (+ `public/cutins/<key>.webp` and `cutin: true` for a COUNTER card). Never add a hidden identity there: players' browsers load that file.
- **Someone looks too big/small:** their `h` in `CAST` (1.75 = a human). `lift` floats them (fairies).
- **Camera feel:** `CFG` at the top of `trial_stage.js` — `hfov` = zoom, `lineSpan` = how wide the whole line is, `benchRise` / `benchDepth` / `benchSpread` = where the bench sits, `benchZoom`, `bgUpShift` (how far the hall slides as the camera looks up); pan speed in `startPan`.
- **REACTION / SPEAK cooldowns:** `REACT_COOLDOWN` / `SPEAK_COOLDOWN` in `trial_core.js`.
- **Banner words for side changes:** `SIDE_FX` in `trial_stage.js`.
