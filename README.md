# Descend

An AI-narrated survival text adventure. You are a condemned criminal sent down the Long Stair into **Dakavinor**, a ruined city buried under the earth. Recover enough ancient artifacts and the Crown will set you free. At night the gate on the stair is sealed; by day the guards open it to trade. Down there you learn to survive on your own, or you don't.

You type what your character attempts, and an AI narrator (Claude or GPT) tells you what happens.

## Running it

You need Node.js 22 or newer.

1. Download the project. Either run `git clone -b claude/determined-babbage-qhrvh9 https://github.com/wampus1/ClaudeTesting2.git`, or open the branch on GitHub and use **Code → Download ZIP**, then unzip it.
2. Open a terminal in the project folder. On Windows, you can type `cmd` into the File Explorer address bar.
3. Run:
   ```
   npm install
   npm start
   ```
4. Open **http://127.0.0.1:3000** in your browser.
5. On the title screen, paste your API key. Claude keys (`sk-ant-…`) and OpenAI keys (`sk-…`) are told apart automatically. The key is checked, and the game reports which model will narrate.

To play without a key, choose **No AI (demo)** on the title screen, or start the server with `npm run mock`. The demo is a short canned tale with no AI and no cost.

The key is kept in your browser's storage and sent only to the game's own server on your computer, which passes it on to Anthropic or OpenAI. **Forget saved keys** under *More settings* removes it. You can also leave the title screen blank and put `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in a `.env` file (copy `.env.example`).

## Playing

- **Act** by typing into the box at the bottom and pressing Enter. The narrator treats what you type as an attempt; your attributes, gear, wounds, hunger and luck decide how it goes.
- **Items** in the story are *orange*. Click one to **Examine** it (a card with its picture, which tilts as you move the mouse) or **Pick Up** (adds `pick up <item>` to your action).
- **NPCs** are coloured by alignment: green for peaceful, yellow for neutral, red for hostile. Click one to **Attack**, **Examine**, **Talk**, **Trade**, **Gift** or **Steal**.
- **Inventory** (the hooded figure on the left edge, or <kbd>Alt</kbd>+<kbd>I</kbd>) opens your pack and person in a panel on the left:
  - Equipment slots on a figure: hand, head, body, feet and trinket. There are also special slots for **two gadgets** (a pocket watch, a compass, a spyglass…) and **one relic**.
  - The pack is a 10×6 grid. Items take up space by what they are: a sword is 3×1, a helmet 1×1, a chestplate 2×2, a torch 1×2. Each item is shown by its picture, and hovering shows its name and stats.
  - **Drag** items to rearrange them, onto a slot to equip them, or off a slot to take them off. Press <kbd>R</kbd> (or right-click) while dragging to rotate. Drop an item on the action bar to use it. Click an item for Examine, Use, Equip, Rotate or Drop.
  - If the pack is full, new items are carried *loose* and the narrator treats you as overburdened.
- **The ledger** (the book on the left edge, or <kbd>Alt</kbd>+<kbd>L</kbd>) is your character sheet: vitals, attributes, the people you've met, and the chronicle.
- **Time** passes with every action, and the gate opens at 07:00 and is sealed at 19:00. You only know the hour if you have a **pocket watch equipped** in a gadget slot. Then the header shows a watch face, the day and the gate's state. Without one, the hour is unknown to you, and the narrator won't tell you either. Some prisoners start with a watch, and you can reroll the Writ of Condemnation until you get one.
- **Sound**: everything you hear is synthesized in the browser. There are no audio files. You can turn the sound, its volume and the cave ambience on or off under *More settings*, or turn the sound off from the ☰ menu in the game.
- The game autosaves in your browser after every turn.

## What the AI does

- **Narration**: each turn the browser sends the recent story, a `<state>` block (the character sheet, the time, and whether the character knows it), and your action. The reply streams back as it's written.
- **Memory**: the story sent to the narrator is kept to a budget (about 24,000 tokens). When it grows past that, the oldest turns are summarized into a short **chronicle** entry that keeps names, relationships, promises, places, items and threats. Those turns are then dropped from what the narrator is sent. The chronicle is sent with every turn, and when it grows long its entries are merged into one. The story on your screen is never cut, and the chronicle can be read in the ledger. To watch it happen sooner, open the game at `http://127.0.0.1:3000/?budget=3000`.
- **Illustrations**: item and NPC pictures are made by the AI when you examine something, when an item enters your pack, and when you open the inventory.
  - With a **GPT** key, an image model (`gpt-image-2`, or the best one your key can use) paints them in the game's style. Items get transparent backgrounds and are sized to their grid shape.
  - With a **Claude** key, or if your OpenAI organization can't use the image models, the language model draws each picture as an SVG in the same woodcut style as the game's hand-drawn icons, using those icons as references.
  - Until a picture arrives, and in the demo, the hand-drawn icons are shown. Pictures are cached in `.art-cache/`, so each is only made once.
  - Every picture is a paid API call. Turn **Illustrations drawn by the AI** off under *More settings* to save money.

## Settings

Everything the title screen offers can also be set with environment variables or a `.env` file:

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | none | Used when no key is entered on the title screen. |
| `DESCEND_MODEL_ANTHROPIC` | `claude-opus-5` | The Claude narrator model. |
| `DESCEND_MODEL_OPENAI` | best available, from `gpt-6-astra` down | The GPT narrator model. |
| `DESCEND_IMAGE_MODEL` | best available, from `gpt-image-2` down | The GPT illustration model. |
| `DESCEND_IMAGE_QUALITY` | `medium` | `low`, `medium` or `high`, for GPT illustrations. |
| `DESCEND_EFFORT` | `medium` | How hard the narrator thinks: `low`, `medium`, `high`, `xhigh` or `max`. Lower is faster. |
| `DESCEND_FALLBACKS` | `on` | Claude's server-side refusal fallbacks. Set `off` to disable. |
| `DESCEND_MOCK` | off | `1` forces the demo narrator (the same as `npm run mock`). |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens. Keep it local, because anyone who can reach it can use your keys. |

## How it works

```
public/                 the browser game (plain ES modules, no build step)
  js/main.js              screens, turns, title-screen settings, wiring
  js/story.js             renders streamed prose; turns tags into clickable highlights
  js/markup.js            parses [Tag: "value", key: "value"] out of the stream
  js/state.js             applies state tags to the character sheet; equipment rules
  js/grid.js              pack grid: item footprints, placement, rotation
  js/inventory.js         the inventory panel: slots, grid, drag and drop, tooltips
  js/clock.js             the game clock and "[Elapsed: …]" parsing
  js/memory.js            the chronicle (summarizing old turns)
  js/art.js               requests and caches AI illustrations
  js/audio.js             synthesized sound effects and ambience
  js/icons.js             hand-drawn SVG icons and portraits (placeholders and style references)
  js/ui.js                HUD, ledger, menus, examine cards
lib/
  providers/anthropic.js  Claude via @anthropic-ai/sdk
  providers/openai.js     GPT via the openai SDK (chat + image models)
  providers/mock.js       the canned demo narrator
  prompt.js               narrator and chronicler prompts, the per-turn state block
  art.js                  illustration prompts, SVG sanitizing, the disk cache
server.js               static files and the API: /api/turn, /api/summarize, /api/art, /api/check, /api/status
```

The browser keeps the game (character sheet, recent transcript, chronicle, story log) in `localStorage`. The server keeps nothing between turns except cached pictures.

### The tag protocol

The narrator annotates its prose with bracketed tags that the player never sees.

**Entity tags** go right after the words they describe, and those words become clickable highlights:

```
A rusted sword [Item: "rusted sword", type: "weapon", damage: "2", durability: "4", description: "..."] leans against the wall.
A goblin [NPC: "goblin", alignment: "neutral", type: "trader", health: "5", relationship: "-5", description: "..."] squats by the fire.
```

**State tags** update the character sheet:

| Tag | Effect |
|---|---|
| `[Gain: "name", ...fields]` | Adds an item to the pack, in the first space it fits. |
| `[Lose: "name"]` | Removes an item. |
| `[Equip: "name", slot: "gadget"]` / `[Unequip: "name"]` | Moves gear between the pack and the weapon, head, body, feet, trinket, gadget and relic slots. |
| `[Stat: "health", change: "-3"]` | Changes health, hunger, sanity, an attribute, or coin. |
| `[Wear: "name", change: "-1"]` | Reduces durability; the item breaks at 0. |
| `[Location: "The Drowned Market"]` | Updates the location shown in the header. |
| `[Deliver: "artifact"]` | Hands an artifact to the Warden. Five set you free. |
| `[End: "death"]` / `[End: "freedom"]` | Ends the story. |
| `[Elapsed: "40 minutes"]` | Ends every reply and advances the game clock. |

### API usage

- **Claude**: `claude-opus-5` with adaptive thinking (`medium` effort for narration, `low` for chronicle summaries, `medium` for drawings), streamed. Top-level prompt caching covers the fixed system prompt and the append-only transcript. Server-side refusal fallbacks are on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
- **GPT**: Chat Completions with streaming and `reasoning_effort` for reasoning models. The prompt layout keeps OpenAI's automatic prefix caching working. Illustrations come from the Images API as WebP.
- **Refusals**: if the narrator declines a turn, the game rolls the turn back and asks you to try something else.
