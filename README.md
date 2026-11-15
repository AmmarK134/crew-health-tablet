# Crew Health tablet

A touch-first tablet interface for the team's crew health prototype (NASA Space Apps 2026, "Create Health Monitoring Software for Astronauts on Space Missions").

It runs on top of the team's existing server, Anna Briskina's `vitals-atlas` (formerly `vitals-atlas-radiation`), linked into this repository as the `backend` folder (a git submodule, pinned to the version the tablet was tested against). The server is not changed or copied. Every rule, number and scenario still comes from it, so the tablet does everything the original interface does. Only the screen is new.

Demo data for a fictional crew. Treatment detail is mock content. This is not a medical device.

## Start it

Clone it together with the server:

```
git clone --recursive https://github.com/AmmarK134/crew-health-tablet
cd crew-health-tablet
```

**Windows:** `pip install -r backend/requirements.txt` once, then double-click `start.bat`. The tablet opens in your browser.

**Mac or Linux** (the Mac has `python3`, not `python`, and a virtual environment keeps the packages to this folder):

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python run.py
```

Next time, only `source .venv/bin/activate` and `python run.py`. Then open http://localhost:5050 if the browser does not open by itself.

**Updating** after someone pushes: `git pull`, then `git submodule update --init` so `backend` moves to the version this repository is pinned to.

If the `backend` folder is empty, run `git submodule update --init`. If the server is somewhere else, run `python run.py --backend "path/to/vitals-atlas"`. Node is not needed to run it.

## Pages

| Address | What it shows |
| --- | --- |
| `/?as=lena` | Lena's tablet (flight engineer; the person in the heart scenario) |
| `/?as=sam` | Sam's tablet (crew doctor; adds "Crew overview") |
| `/?as=ravi`, `/?as=maya` | Ravi's and Maya's tablets |
| `/?wall=1` | All four tablets side by side, in step. Best for a demo or a video. |
| `/?device=cuff&as=lena` | The watch: alerts, vitals, SOS, check-ins and radiation on the wrist (swipe between screens) |
| `/classic` | The original interface, for comparison |

Add `&theme=light` for the light theme and `&size=large` for larger text and buttons.

**Demo controls are hidden from the tablet screen.** Press **D** to open or close them, or hold the clock (top left) for 2 seconds on a touch screen. They switch whose tablet it is, start every scenario (heart caution, SOS from any crew member, simulated or recorded solar storms), change the mission setting and display, and reset everything.

To open it on a real tablet or phone on the same network: `python run.py --host 0.0.0.0`, then use this computer's network address in place of `localhost`.

## A two-minute demo

Before you start: allow sound for `localhost:5050` once (see "Sound with no tap" below), and open Lena's watch (`/?device=cuff&as=lena`) in its own tab.

1. Open `/?wall=1`. Four quiet tablets.
2. Press **Start heart scenario**. Lena gets a caution and a check-in: "Do you have chest pain, pressure or discomfort?" Sam gets a quiet advisory. Ravi and Maya see nothing.
3. Switch to Lena's watch tab: it shakes and plays her alarm until she answers. Answer **Yes** there or on her tablet. The crew doctor is alerted now and decides; nothing is declared by itself. Lena is told to rest and press SOS if it gets worse.
4. Switch to Sam's tablet: "a warning has been issued" plays. Open Lena's evidence (Lena sees when he has seen it), run the **ACTIS blood clot test**, then **Escalate**. A 10-second countdown runs; let it finish or press **Send now**.
5. Every tablet switches to the emergency by itself. Each person sees their own action in the largest type. Tap **I'm responding** on a few, and **Undo** one to show that a mistaken tap can be taken back.
6. On Sam's tablet record a checklist step (and **Change** it), then look at **Earth**: the report was sent by itself, with the earliest possible reply. "Continue without waiting."
7. Sam presses **End emergency**, gives a reason and ends it. Every tablet returns to normal. Lena sees that crew access to her data has closed.
8. Press **SOS** (top right) on any tablet, or hold SOS for 3 seconds on the watch. It asks once, then the whole crew gets an emergency with that person's name and location. For 10 seconds the sender can cancel it as a mistake; it is still recorded, as a false alarm.
9. Press **Start solar storm** for the last scenario, or **Reset everything**.

## New in this version (15 November 2026)

- **Anna's newest server** (`backend` at commit `b123126`): measures in the design team's shape, the new check-in flow ("Yes" alerts the crew doctor, no answer in 3 minutes alerts the crew doctor, "seen at" time), the ACTIS blood clot test, SOS, and the Canadian data below. `src/measures.ts` turns the new measure format into the tablet's indicators.
- **SOS on every tablet**, in the status bar. Asked once; the sender can cancel a mistake for 10 seconds (recorded as a false alarm). The crew doctor ends it otherwise, or the commander when the crew doctor is the one who pressed it.
- **Undo in an emergency.** "I'm responding", "On the way", "On scene" and "In the shelter" can each be taken back one step, on the tablet and the watch. A recorded checklist step can be corrected (the server overwrites it with the new result, who and when; it cannot un-record a step).
- **Demo controls off the screen**: press D, or hold the clock.
- **The watch** has screens now: Alert (opens by itself and vibrates), Home with Get crew doctor (on Sam's watch: who needs the crew doctor), Vitals against the person's own usual range, SOS held for 3 seconds, one-tap check-ins, and career radiation dose with the Earth link.
- **Sound.** Lena's watch plays her alarm (and vibrates on an Android phone) as soon as it is on screen with the heart check-in waiting, up to 3 times, and stops when she answers, when you leave the watch tab, or when she swipes away from the alert; coming back plays it again until she answers. Sam's tablet plays "a warning has been issued" **once**, the first time it is on screen while he is alerted (including when the demo switches to Sam), and never again on that page; his watch does the same. The quiet advisory before that stays silent. Sound can be turned off under Display in the demo controls.
- **Sound with no tap (one-time browser setting).** Chrome blocks sound in a freshly opened tab until it is tapped. Allow it once for this site: open `localhost:5050`, click the icon left of the address, **Site settings**, **Sound: Allow**, then reload. (Safari: Settings, Websites, Auto-Play, localhost, Allow All Auto-Play.) Without it, the sound plays on the first tap instead, or when you reach the page in the same tab after clicking something.
- **Mock AI insight**, under each crew member's indicators (about their own data) and in the crew doctor's view for each person (a doctor version that never uses mood or stress). A live summary of the week, suggested questions ("What could this lead to?", "Is this normal in space?", "What else could explain this?", "What should I check next?") and a box to type a question. Answers are scripted from the person's demo readings and the sources already in the app, each with its source, in the style of evidence-based clinical assistants. Following the team's rule, it gives no diagnosis and no made-up percentages; asked for one, it explains why. Labelled "Mock AI".
- **Canadian content**: the CSA Bio-Monitor shirt as the wearable that takes the readings, the CSA Radi-N/Radi-N2 neutron measurements in the station radiation view, and the ACTIS test for the crew doctor. See below.

## Canadian content and local impact

- **Where the readings come from.** Every crew member has a tablet. Continuous readings (heart tracing, heart rate, sleep) come from a wearable paired with it: a smartwatch, or the Canadian Space Agency's **Bio-Monitor** smart shirt and headband (Carré Technologies, Montreal), in use on the space station by CSA astronaut Joshua Kutryk (Crew-13). Values in the demo are not Bio-Monitor data.
- **Neutrons measured by Canadian detectors.** In the station setting, the neutron part of the dose comes from the CSA's Radi-N and Radi-N2 bubble detectors: 11 week-long sessions from the missions of Robert Thirsk (2009), Chris Hadfield (2012 to 2013) and David Saint-Jacques (2019), released for the 2019 Space Apps Challenge. The original CSA download is offline; the server's copy comes from a 2019 participant's public mirror, so an official copy and its licence should be requested from the CSA before publishing.
- **ACTIS** (Acute Care Testing in Space, CSA, Crew-13) measures D-dimer in about 15 minutes. The crew doctor uses it to rule out a blood clot, another cause of chest pain. The result in the demo is mock.
- **Local impact.** Built for Mars, where the doctor is 14 minutes away, the same care model fits many of Canada's remote and northern fly-in communities: a tablet per patient or household instead of per crew member, the same wearable, a community nurse who responds first instead of a crew doctor who is not a specialist, and telehealth or a medevac with a delay of hours instead of a report to Earth. The CSA's own advisory council draws this link in its Health Beyond report. The Crew-13 experiments themselves do not state a northern-health goal; the link is this app's design.

## What is new compared with the original interface

Everything the original does is here. These are additions:

- **Touch-first layout.** A status bar with the three alert lamps on every view, a dock of large keys along the bottom, and "Get crew doctor" always in reach.
- **Decisions never hide below a scroll.** The crew doctor's four decisions, and "Send now" and "Stop" during a countdown, stay pinned under the evidence.
- **Reasons by tap.** Reasons for a decision or for ending an emergency can be tapped instead of typed.
- **Beat shape.** For the heart rhythm indicator, a schematic of one heartbeat shows what an "ST shift" is: the usual shape against the shape now.
- **Earth link as a signal in flight.** The report to Earth is drawn travelling out, with the earliest possible reply.
- **Stale connection is said in words.** If the tablet cannot reach the server it says so, with the time of the last data. Old data is never shown as current.
- **Light and dark themes, and a Large size** for gloves, vibration or tired eyes.
- **The wall and the watch** (see Pages).
- **Event record** in the crew doctor's view: the server's own log of what happened and when.

The reasons for each design choice, with sources, are in `docs/design-notes.md`.

## Checks that were run

- `npm run check` taps through every action in a real browser (four tablets and a watch) and checks the server's state after each: 67 checks, all passing on 15 November 2026 against `backend` at `b123126`, on Linux with headless Chrome.
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
| `src/insight.ts`, `src/views/Insight.tsx` | The mock AI insight: scripted, evidence-cited answers from a person's readings |
| `src/measures.ts` | Turns the server's per-person measures into indicators, with why each matters and how it is measured |
| `src/store.ts` | Asks the server for the state once a second; sends actions |
| `src/logic.ts`, `src/content.ts` | What each tablet shows, and the words and sources (carried over from the original `static/app.js`) |
| `src/views/` | One file per view: My health, Emergency, Crew overview, Radiation exposure, the rest |
| `src/charts.tsx`, `src/ui.tsx` | Charts and shared controls |
| `src/styles/tokens.css` | Colours, type and sizes, from the team's style guide |
| `scripts/walkthrough.mjs` | The 67-check walk-through |
| `docs/design-notes.md` | Design decisions, sources and what is not verified |

## Credits

- Server, scenarios, radiation model and all content rules: the team's `vitals-atlas` project (Anna Briskina).
- Fonts: Inter and DM Mono, SIL Open Font License 1.1 (`src/assets/fonts/`).
- Icons: Material Symbols by Google, Apache License 2.0 (`src/icons.tsx`, licence in `src/icons-LICENSE.txt`).
- This interface was written with the help of an AI model (Claude, by Anthropic), at Ammar Kashif's direction.
- No NASA insignia or logotype is used. This project is not endorsed by NASA.
