# Class Trial stage (Danganronpa-style camera)

Added 2026-10-13, reworked 2026-10-14. A courtroom you drive from a GM dashboard; the players watch it — and take part — on their own screens.

## Where it lives
| Who | URL |
|---|---|
| GM dashboard | `GM_PATH/trial` (link "⚖ Class Trial stage" bottom-right of the cockpit) |
| Players | `/trial` — they pick their character; the stage shows a waiting screen until you press **Court closed → Court in session** |

## Inviting the players
**✉ Invite players** (top bar of the dashboard) is the way in from the hourglass:
1. The hourglass is paused (the server pauses it, exactly like the cockpit's Pause).
2. On the players' hourglass screen (`/`) time stops: violet flash, the screen shakes, a shockwave from the glass's neck, a tape-stop sound and a deep bell (for players who enabled sound), the grains freeze in mid-air, the hourglass goes grey, "TIME STANDS STILL" under the clock.
3. **JOIN CLASS TRIAL** slams in over the middle of the hourglass ("The court awaits"). It takes them to `/trial`, where they pick their character.

The button stays until you click **✉ Players invited ✕** to withdraw it (also after a reload). Withdrawing does not restart the hourglass, and opening the court is still your **Court closed / Court in session** button. Resume the hourglass from the cockpit as usual; if you do it while the invitation is still out, the sand flows again and the button stays.

## Credibility Points
The prosecution's score. **Prosecution column of the dashboard: − [CP] + and ↺.** − takes 1, + adds 1, ↺ puts it back to 10 (new trial). It stays between 0 and 20 and survives a restart.
On the players' trial screen it shows **top-right of the stage, "Credibility Points 10"**, only while the court is in session. A change pops (+1 green, −1 red shake); at 3 or less the number turns red.

## Skill checks (trial and exploration)
**🎲 SKILL CHECK** is on the trial dashboard (Prosecution column, under the seats) and in the cockpit (a small dock bottom-left; click its title to fold the log away).
1. The window shows the five PCs. **Click a portrait to select / deselect** (it opens with the characters someone is playing already selected; "not at the table" = nobody plays them right now).
2. Under each portrait, the skill (A→Z: abilities, saving throws and skills). Shortcuts: **Same skill for all**, and **Opening checks** (Müne Investigation, Askii Intelligence, Angèle Persuasion, Pryah Intimidation, Bardik Insight).
3. Optional **DC**, judged on **each roll** (pass/fail, successes 3/5) or on **the sum** (group roll: "vs DC 65 ✓ reached / ✗ short by 4"). Leave it empty for plain rolls. Players never see the DC.
4. **Ask for the roll.** Each selected player gets a window **"Roll for Insight"**: their modifier (− 0 +, remembered per skill on their device), then **Roll / Roll with advantage / Roll with disadvantage**.
5. **The server throws the d20s**, so everyone's screen shows the same dice: they tumble on a table at the bottom of the screen (trial page and hourglass page alike), then the result: die + modifier = total. Advantage / disadvantage throw two dice and keep the higher / lower (the other one dims). Natural 20 and natural 1 get a flourish.
6. **Your log** (dashboard and cockpit) fills in as each roll lands: total, the dice, the modifier, ADV/DIS, ✓/✗ against the DC, the sum and the successes. A few seconds after the last roll the table disappears from the players' screens; **Close** ends a check early (someone isn't answering). The log keeps the last 12 checks; "Clear the log" empties it.

Each PC has their own die, drawn in code: Angèle violet marble with gold, Askii brass with rivets and gears, Pryah obsidian with lava cracks, Müne moss and leaves with bark edges, Bardik smoke and shadow.
**On the hourglass page** a chip bottom-left says who that screen plays ("Who are you?" → pick a character; same choice as on `/trial`, a taken character is locked). If a roll is asked of a character nobody plays yet, the chip blinks.

## Slideshows (Closing Argument, Punishment)
Left column of the dashboard, under the players: **Slideshows**.
- **+ New slideshow** opens the editor. Name it ("Carnage slideshow"), then **+ Add pictures**: click or drop files. Several at once are sorted by file name ("Slide 2" before "Slide 10"); big pictures are shrunk to 1920 px. **A PDF works too**: in Google Slides, *File → Download → PDF document*, drop the PDF, and every page becomes a slide.
- **Reorder** by dragging a thumbnail (or its ◀ ▶), **✕** deletes one.
- **♪ Music** (MP3, M4A, OGG, WAV — up to 25 MB): starts with the slideshow, fades out when it ends, **Loop** if it should repeat. **Plays on**: *everyone's screens* (online play: each player hears it on their own device, started at the right moment even for someone who arrives late) or *my screen only* (same room: your dashboard plays it through your speakers). A player whose browser blocks sound gets a "🔊 Tap for the music" button; the 🔊 / 🔇 switch of their trial page also mutes it. All screens play in step: each one follows the server's clock (measured on every poll, so a computer whose clock is wrong doesn't matter), jumps when it is more than 0.4 s off and otherwise speeds up or slows down by a few % (same pitch) until it is within a few hundredths of a second.
- **▶** (in the list or the editor) plays it **full screen on the players' trial screens** — the whole picture, never cropped, pages crossfading. Your preview shows the same picture.
- While it plays, a strip at the bottom of the dashboard: **◀ 3 / 12 ▶** (or the ← → keys), **Give control to…** a player, **♪ Music** on/off and **⟲** from the top, **🎧 Here** (hear the music on this computer too — turn it off when your dashboard sits in the same room as the players' screens; remembered by this browser), **■ End**.
- **Give control to Pryah**: Pryah's screen gets **◀ Previous / Next ▶** (also the arrow keys or a swipe) and everyone sees "Pryah presents". You can still turn pages yourself. "nobody — only me" takes the control back.
- No peeking: a player's browser can only fetch the slides up to the next one, and nothing once the slideshow ends.
- The pictures and the music are kept on the server and, with GH_TOKEN, on the GitHub `data` branch (`sablier-app/trial_slides/`), so they survive a restart; the list of slideshows lives in `trial.json`. Deleting a slide removes the server's copy (the GitHub copy stays in the branch's history).

## NPC sprites (3 extra pictures per NPC)
**Click an NPC's token** (seated or in the pool): a menu opens right under it — **Default** and three slots.
- **+** on an empty slot: pick a picture. It is trimmed and shrunk in your browser (a PNG with a transparent background looks best), then kept on the server like the players' emotes (and on GitHub with GH_TOKEN). Uploading does not dress the NPC in it yet.
- **Click a picture**: the NPC wears it on every screen (and in your preview). **Default** puts their own sprite back. Their token shows a small number (②) while they wear another picture.
- **−**: deletes it (it asks "delete?" — click again within 3 s).
- Esc, ✕ or a click elsewhere closes the menu. Clicking a seated token still gives them the floor as before.
- No peeking: a player's browser can only fetch the picture an NPC is wearing right now (a "true form" stays hidden until you show it).

## BRAINSTORMING
**BRAINSTORMING** (last of the banner buttons) plays its banner (teal, "POLYCHROMA ASKS"); once it has played, the camera goes up to Polychroma (if she is seated). Players see "Polychroma prepares her question…".
Under the banners a box opens: type the question, **Show the question · 60 s** (or Enter). On every screen the question shows big at the bottom of the stage with a 60-second countdown (a number and a bar; red and ticking for the last 10 s; **TIME'S UP!** with a buzzer at 0 — the question stays).
Your box then has **⟲ 60 s again**, **+15 s**, **Change the question** (restarts the 60 s) and **■ End brainstorming** (the card leaves every screen). Typed words + BRAINSTORMING = your words on the banner.

## ABOUT TO TIP: the face-off
**ABOUT TO TIP** (or T) plays its banner, then the face-off: the courtroom fades back and the two sides face each other — the defense (seat **Defense**, L1) and its ally (seat **Support**, L2) on the left, the five PCs on the right, three empty sockets above each side.
Under the banners, your face-off panel walks you through each round:
1. **Defense speaks:** click the defense or the ally — they step forward.
2. **🎲 ROLL**: the server throws a die carrying the faces of the prosecutors who have not spoken yet, each the same number of times: **d10** for five (2 faces each), **d12** for four (3 each), **d6** for three (2 each), **d20** for two (10 each). Every screen sees the same tumble and the same face: "ASKII! TAKES THE STAND". The last prosecutor needs no die: they come straight in after the defense speaks.
3. The chosen prosecutor comes to the centre, face to face.
4. **BREAK** (a Polychroma token flies to the prosecution's sockets) or **FAIL** (to the defense's). Back to step 1; whoever has spoken leaves the die (greyed, with BREAK / FAIL under them).

First side to 3 tokens wins: "THE PROSECUTION / THE DEFENSE WINS THE FACE-OFF 3 – 1", then every screen goes back to the courtroom by itself; **Close** clears your panel. **↶ Undo last** takes back the last BREAK / FAIL (even after the end), **✕ Stop** ends it at once. While one is running, ABOUT TO TIP only replays the banner (Stop first to start a new one). With nobody in Defense or Support, only the banner plays. The face-off is a moment: a server restart forgets it.

## Trial powers
Below the courtroom, the **⚡ Trial powers** table: **+ Add a power**, then per row **Granted by** (an NPC), **Power** (its name), **What it does** (the players read it), and **⚡ Unlock**. Rows are saved as you type and survive a restart.
- **⚡ Unlock**: every player's screen plays "YOU UNLOCKED [power]" (with what it does and who granted it), then it becomes a button top-left of the stage. Hovering it shows what it does. Players never see a locked power.
- A player who clicks it **proposes** it: every player at the table gets "[PC] PROPOSES TO USE [power]" with **Accept / Deny** (the proposer counts as accepting, and can Withdraw). One **Deny** cancels it ("DENIED BY BARDIK") and the power stays theirs. When everyone at the table has accepted, "[power] ACTIVATED!" plays on every screen, the button disappears and your row goes back to **⚡ Unlock** ("used ×1"); you get a note at the top of your dashboard. Someone leaving the table during a vote no longer counts; spectators watch without voting; one vote at a time.
- Your row shows the vote as it happens (**Cancel the vote**), **Take back** removes an unlocked power without any animation, 🗑 deletes a row (click twice).

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
| ABOUT TO TIP | T | amber band, the words rock like a scale — **then the face-off** (see above) |
| COUNTER! | C | the speaker's cut-in art (Askii, Bardik, Angèle, Müne, Pryah); with your words, a cyan band |
| I AGREE! | A | green band |
| Reveal | R | cinema bars, slow golden serif |
| SHOCK! | X | red flash, sunburst, heavy shake |
| whisper… | W | quiet line low on screen |
| SLAM | | violet band |
| BRAINSTORMING | | teal band with sparks, "POLYCHROMA ASKS" — then the question box (see above) |

Keyboard letters always play the default words.

## The players
On `/trial` each player:
1. **Picks their character** among Angèle, Pryah, Askii, Müne and Bardik. A taken character is locked for everyone else. The choice is remembered on that device (reloading keeps it). "Just watch" = spectator. "Change character" (their name, bottom-left) lets go.
2. **Presses SPEAK** — they take the floor: the camera moves to their character on every screen, yours included, exactly as if you had clicked their token (no banner). One per 1.2 s per player; only while the court is in session and their character is seated.
3. **Presses REACTION!** — to interrupt: the camera moves to them and the REACTION banner plays once it lands. One per 2.5 s per player; only while the court is in session.
4. **Wears emotes** — five buttons at the bottom. Emote 1 is their own sprite and can't be changed. Emotes 2–5: they give a name and upload a picture (shrunk and trimmed in their browser; a PNG with a transparent background looks best). Clicking an emote swaps their sprite for everyone, without moving the camera. In a small window the emote window scrolls and its Save / Cancel row stays pinned at the bottom.
5. **Sees who sides with whom** — around the stage, the 11 NPC Primes' tokens: Defense in the left strip, Prosecution in the right one, the Jury along the top, each with a count. A token moves to its new strip when the NPC starts walking on stage. Trembling tokens = wavering. **⚖** (or T) hides/shows the strips on that screen. Hidden while the court is closed.

**SPEAK / REACTION switches:** the two pills in your top bar ("Players · SPEAK · REACTION"). Click one to switch it off for the whole table (it turns grey and struck through); click again to switch it back on. With both off, the players' buttons read "listen" under a "THE JUDGE ASKS YOU TO LISTEN" label.

On your dashboard, **Players at the table** (under the defense) shows who is playing whom and what emote they wear: **Release** frees a character (lost phone, wrong pick), **↺** puts someone back on their own sprite.

## Files
| File | Role |
|---|---|
| `trial_core.js` | Cast list, seats, the line order, banner styles, the GM reducer and the player actions. **Public file** — no GM secrets in it. |
| `trial_server.js` | Shared state + emote pictures. Rolls the skill-check dice (crypto). Saves the room (seats, open/closed, who is wavering, the invitation, Credibility Points, the roll log) and the players' side (who plays whom, emote names, SPEAK/REACTION switches) to `trial.json`, the pictures to `trial_emotes/`, and — with GH_TOKEN — all of it to the GitHub `data` branch like the timeline and the board. Also the trial powers (the table) and the NPCs' extra sprites (`trial_emotes/<npc>_<n>.json`, like the emotes); it throws the face-off die. Clicks, banners, side-change moments, brainstorming, the face-off and votes are never saved. |
| `trial_stage.js` | The stage renderer (camera, tilt, group shot, background, banners, emotes, synthesised sound). Used by both pages. |
| `trial_gm.html`, `trial.html` | The two pages. |
| `trial_bg.jpg` | The tribunal (`07_Citadel and maps/Scenes/X Class Trial Tribunal`), 2048 px wide. |
| `public/sprites/<key>.webp` | Transparent full-body sprites, cropped from `01_Characters/transp/`. |
| `public/cutins/<key>.webp` | COUNTER cut-ins, from the five `Trial_Counter_*.jpeg` images. |
| `public/tokens/token_angele.webp` | New token (the others were already there). |
| `trial_dice.js` | Skill checks, players' side: the five d20s (3D, drawn on a canvas), the "Roll for …" window, the dice table, the "Who are you?" chip of the hourglass page. Loaded by `trial.html` and `player.html`. |
| `trial_dice_gm.js` | Skill checks, GM side: the SKILL CHECK window and the roll log. Loaded by `trial_gm.html`; the server adds it to the cockpit as a dock. |
| `trial_show.js` | Slideshows, players' side: full-screen pictures, the presenter's ◀ ▶, the hidden music (also the small copy in the GM preview). |
| `trial_faceoff.js` | ABOUT TO TIP: the face-off scene on every stage, and its dice (d6, d10, d12, d20 with the PCs' tokens, drawn in code). |
| `trial_powers.js` | Trial powers: the players' buttons, the vote window, "You unlocked …" / "… activated!", and your table. No secrets inside. |
| `trial_show_gm.js` | Slideshows, GM side: the list, the editor (pictures, PDF pages, order, music), the play strip. |
| `trial_slidestore.js` | The slideshow files on the server's disk + GitHub (fetched back after a restart), served with Range for the music. |
| `store_github.js` | Durable copy on GitHub (timeline, board, trial) — now also binary files (`saveBinary` / `loadBinary`, read raw so files over 1 MB work). |
| `player.html` | The hourglass screen: also plays the time-stop and shows JOIN CLASS TRIAL when you invite the players. |
| `server.js` | Hooks: require, the invitation in `/state` (and the pause when you invite), public routes (`/trial`, `/trial/state`, `/trial/play`, `/trial/emote/…`, `/trial_core.js`, `/trial_stage.js`, `/trial_bg.jpg`, `/sprites/`, `/cutins/`, `/trial_faceoff.js`, `/trial_powers.js`), GM routes (`GM_PATH/trial/emote/…` shows you every NPC sprite, worn or not), POST. |

## Changing things
- **Add a character:** one line in `CAST` (`trial_core.js`) + `public/sprites/<key>.webp` (+ `public/cutins/<key>.webp` and `cutin: true` for a COUNTER card). Never add a hidden identity there: players' browsers load that file.
- **Someone looks too big/small:** their `h` in `CAST` (1.75 = a human). `lift` floats them (fairies).
- **Camera feel:** `CFG` at the top of `trial_stage.js` — `hfov` = zoom, `lineSpan` = how wide the whole line is, `benchRise` / `benchDepth` / `benchSpread` = where the bench sits, `benchZoom`, `bgUpShift` (how far the hall slides as the camera looks up); pan speed in `startPan`.
- **REACTION / SPEAK cooldowns:** `REACT_COOLDOWN` / `SPEAK_COOLDOWN` in `trial_core.js`.
- **The skill list, the opening checks, CP limits:** `SKILLS`, `OPENING_CHECKS`, `CP_START` / `CP_MIN` / `CP_MAX` in `trial_core.js`.
- **A die's look:** `STYLES` in `trial_dice.js` (colours, edge, number ink, texture recipe). The face-off dice: `COLOR` and `drawSolid` in `trial_faceoff.js`.
- **Brainstorming countdown:** `BRAIN_MS` (60 s) in `trial_core.js`; how long the camera waits for the banner: `BRAIN_PAN_DELAY`.
- **Face-off:** tokens to win `FO_WIN` (3), which die for how many prosecutors `FO_DIE`, in `trial_core.js`; where everyone stands: `POS` in `trial_faceoff.js`.
- **NPC sprites:** three slots, `NPC_SPRITE_SLOTS` in `trial_core.js`.
- **Banner words for side changes:** `SIDE_FX` in `trial_stage.js`.
