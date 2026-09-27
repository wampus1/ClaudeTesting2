# Descend

An AI-narrated survival text adventure. You are a condemned criminal sent down the Long Stair into **Dakavinor**, a ruined city buried under the earth. Recover enough ancient artifacts and the Crown will set you free. At night the gate on the stair is sealed; by day the guards open it to trade. Down there you learn to survive on your own, or you don't.

You type what your character attempts. Claude narrates what happens.

## Running it

Requires Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env      # then put your ANTHROPIC_API_KEY in it
npm start                 # http://127.0.0.1:3000
```

To try the interface without an API key, `npm run mock` starts a canned narrator that recognises a handful of verbs (look around, pick up, attack, talk, trade, steal, eat, rest, deliver).

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Your API key. `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile also work. |
| `DESCEND_MODEL` | `claude-opus-5` | The narrator model. |
| `DESCEND_EFFORT` | `medium` | How hard the narrator thinks: `low`, `medium`, `high`, `xhigh` or `max`. Use `low` for snappier turns and `high` for a more careful game master. |
| `DESCEND_FALLBACKS` | `on` | Server-side refusal fallbacks (see below). Set `off` to disable. |
| `DESCEND_MOCK` | off | `1` uses the canned narrator. |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens. Keep it local, because anyone who can reach it spends your key. |

## Playing

- **Act** by typing into the box at the bottom and pressing Enter. The narrator treats what you type as an attempt; your attributes, gear, wounds, hunger and luck decide how it goes.
- **Items** in the story are *italic orange*. Click one for **Examine** (a card with its icon, which tilts as you move the mouse, and its stats) or **Pick Up** (adds `pick up <item>` to your action).
- **NPCs** are *italic* and coloured by alignment: green for peaceful, yellow for neutral, red for hostile. Click one for **Attack**, **Examine**, **Talk**, **Trade**, **Gift** or **Steal**. Examine opens a card with their portrait, health and regard for you; the other options add the action to your input.
- **The Ledger** (top right) is your character sheet: vitals, attributes, equipped gear, your pack and the people you've met. Everything in it is clickable.
- Stats and starting equipment are rolled randomly on the **Writ of Condemnation**. Reroll as often as you like.
- The game autosaves to your browser after every turn.

## How it works

```
public/            the browser game (plain ES modules, no build step)
  js/main.js         screens, turns, save/load, click handling
  js/story.js        renders streamed prose and turns tags into clickable highlights
  js/markup.js       parses [Tag: "value", key: "value"] out of the stream
  js/state.js        applies state tags to the character sheet
  js/character.js    random prisoner generation
  js/icons.js        hand-drawn SVG item icons and NPC portraits
  js/ui.js           HUD, ledger, menus, examine cards
lib/
  prompt.js          the narrator's system prompt and per-turn message
  narrator.js        the Claude API call (streaming)
  mock.js            the canned narrator
server.js          static files + POST /api/turn (newline-delimited JSON stream)
```

Each turn the browser sends the transcript so far, the current character sheet, and the action. The server adds a `<state>` block to the player's message and streams Claude's reply back. The browser holds the transcript and the character sheet (in `localStorage`), and the server holds nothing between turns.

### The tag protocol

The narrator annotates its prose with bracketed tags that the player never sees.

**Entity tags** go right after the words they describe. Those words become clickable highlights:

```
A rusted sword [Item: "rusted sword", type: "weapon", damage: "2", durability: "4", description: "..."] leans against the wall.
A goblin [NPC: "goblin", alignment: "neutral", type: "trader", health: "5", relationship: "-5", description: "..."] squats by the fire.
```

**State tags** update the character sheet silently, and each change shows as a small note under the passage:

| Tag | Effect |
|---|---|
| `[Gain: "name", ...fields]` | Adds an item to the pack. |
| `[Lose: "name"]` | Removes an item. |
| `[Equip: "name", slot: "weapon"]` / `[Unequip: "name"]` | Moves gear between the pack and the weapon, head, body, feet and trinket slots. |
| `[Stat: "health", change: "-3"]` | Changes health, hunger, sanity, an attribute, or coin. |
| `[Wear: "name", change: "-1"]` | Reduces durability; the item breaks at 0. |
| `[Time: "night"]` | Sets dawn, day, dusk or night. The gate is open only by day. |
| `[Location: "The Drowned Market"]` | Updates the location shown in the header. |
| `[Deliver: "artifact"]` | Hands an artifact to the Warden. Five sets you free. |
| `[End: "death"]` / `[End: "freedom"]` | Ends the story. |

### Claude API usage

- **Model:** `claude-opus-5` with adaptive thinking at `medium` effort, streamed so prose appears as it's written.
- **Prompt caching:** the system prompt is fixed, the transcript is append-only, and top-level `cache_control` caches the growing conversation, so each turn pays full price only for the new message.
- **Refusal fallbacks:** requests include `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). If a safety classifier declines a turn, the API re-runs it on a recommended fallback model in the same call. If the whole chain declines, the game rolls the turn back and asks you to try something else.
- The transcript stores only the narrator's text, not its thinking blocks. That keeps saves small and the history append-only.
