# Crew Health tablet

A touch-first tablet interface for the team's crew health prototype (NASA Space Apps 2026, "Create Health Monitoring Software for Astronauts on Space Missions").

It runs on top of the team's existing server (`vitals-atlas-radiation`). The server is not changed or copied. Every rule, number and scenario still comes from it, so the tablet does everything the original interface does. Only the screen is new.

Demo data for a fictional crew. Treatment detail is mock content. This is not a medical device.

## Start it

**Windows:** double-click `start.bat`. The tablet opens in your browser.

**Any system:**

```
python run.py
```

Then open http://localhost:5050.

The folder must sit next to the `anna` folder, like this:

```
NASA Hackathon/
  anna/vitals-atlas-radiation/     the team's server (untouched)
  crew-tablet/                     this folder
```

If the server is somewhere else, run `python run.py --backend "path\to\vitals-atlas-radiation"`.

Nothing needs installing beyond what the server already needs (`pip install flask pandas requests`). Node is not needed to run it.

## Pages

| Address | What it shows |
| --- | --- |
| `/?as=lena` | Lena's tablet (flight engineer; the person in the heart scenario) |
| `/?as=sam` | Sam's tablet (crew doctor; adds "Crew overview") |
| `/?as=ravi`, `/?as=maya` | Ravi's and Maya's tablets |
| `/?wall=1` | All four tablets side by side, in step. Best for a demo or a video. |
| `/?device=cuff&as=lena` | Wrist cuff concept: the alerts and one-tap answers on the arm |
| `/classic` | The original interface, for comparison |

Add `&theme=light` for the light theme and `&size=large` for larger text and buttons. Both are also under "Demo tablet" (top right).

To open it on a real tablet or phone on the same network: `python run.py --host 0.0.0.0`, then use this computer's network address in place of `localhost`.

## A two-minute demo

1. Open `/?wall=1`. Four quiet tablets.
2. Press **Start heart scenario**. Lena gets a caution with a quick check. Sam gets a quiet advisory. Ravi and Maya see nothing.
3. On Lena's tablet answer **Yes**. A 10-second countdown runs. Let it finish.
4. Every tablet switches to the emergency by itself. Each person sees their own action in the largest type. Tap **I'm responding** on a few.
5. On Sam's tablet record a checklist step, then look at **Earth**: the report was sent by itself, with the earliest possible reply. "Continue without waiting."
6. Sam presses **End emergency**, gives a reason and ends it. Every tablet returns to normal. Lena sees that crew access to her data has closed.
7. Press **Start solar storm** for the second scenario, or **Reset everything**.

## What is new compared with the original interface

Everything the original does is here. These are additions:

- **Touch-first layout.** A status bar with the three alert lamps on every view, a dock of large keys along the bottom, and "Get crew doctor" always in reach.
- **Decisions never hide below a scroll.** The crew doctor's four decisions, and "Send now" and "Stop" during a countdown, stay pinned under the evidence.
- **Reasons by tap.** Reasons for a decision or for ending an emergency can be tapped instead of typed.
- **Beat shape.** For the heart rhythm indicator, a schematic of one heartbeat shows what an "ST shift" is: the usual shape against the shape now.
- **Earth link as a signal in flight.** The report to Earth is drawn travelling out, with the earliest possible reply.
- **Stale connection is said in words.** If the tablet cannot reach the server it says so, with the time of the last data. Old data is never shown as current.
- **Light and dark themes, and a Large size** for gloves, vibration or tired eyes.
- **The wall and the wrist cuff concept** (see Pages).
- **Event record** in the crew doctor's view: the server's own log of what happened and when.

The reasons for each design choice, with sources, are in `docs/design-notes.md`.

## Checks that were run

- `npm run check` taps through every action in a real browser and checks the server's state after each: 32 checks, all passing on 14 November 2026.
- An automated accessibility scan (axe-core, WCAG 2.0 to 2.2 levels A and AA) on 10 screens in both themes: no violations. An automated scan cannot prove full conformance.
- No text is smaller than 16 px. Main actions are at least 56 px high, emergency actions at least 76 px.

Not done: a run on Windows (the launcher was tested on Linux), testing on a physical tablet, with a screen reader, or with crew.

## Changing the interface

Needs Node 18 or newer.

```
npm install
npm run dev        # http://localhost:5173, talks to the server on port 5000 (python server.py in the server folder)
npm run build      # rebuilds dist/, which run.py serves
```

| Path | What it holds |
| --- | --- |
| `run.py`, `start.bat` | Starts the team's server with this interface in front of it |
| `dist/` | The built interface, ready to serve |
| `src/api.ts` | The server's endpoints and the shapes of what it sends |
| `src/store.ts` | Asks the server for the state once a second; sends actions |
| `src/logic.ts`, `src/content.ts` | What each tablet shows, and the words and sources (carried over from the original `static/app.js`) |
| `src/views/` | One file per view: My health, Emergency, Crew overview, Radiation exposure, the rest |
| `src/charts.tsx`, `src/ui.tsx` | Charts and shared controls |
| `src/styles/tokens.css` | Colours, type and sizes, from the team's style guide |
| `scripts/walkthrough.mjs` | The 32-check walk-through |
| `docs/design-notes.md` | Design decisions, sources and what is not verified |

## Credits

- Server, scenarios, radiation model and all content rules: the team's `vitals-atlas-radiation` project.
- Fonts: Inter and DM Mono, SIL Open Font License 1.1 (`src/assets/fonts/`).
- Icons: Material Symbols by Google, Apache License 2.0 (`src/icons.tsx`, licence in `src/icons-LICENSE.txt`).
- This interface was written with the help of an AI model (Claude, by Anthropic), at Ammar Kashif's direction.
- No NASA insignia or logotype is used. This project is not endorsed by NASA.
