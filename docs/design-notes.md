# Crew Health tablet: design notes

Compiled 2026-11-14 by Claude, at Ammar Kashif's direction. Not yet reviewed by the team.

This file says what the tablet interface does, why each design choice was made, and what has not been verified. It is design guidance, not medical advice. All values in the interface are demo data for a fictional crew.

File paths that start with `docs/` or `reference/` point at the team's design repository (`NasaHackDashboard`), not at this folder.

## 1. What this build is

- A new front end for the team's crew health server (`vitals-atlas-radiation`: `server.py`, `crew/engine.py`, `crew/heart.py`, `radiation/`).
- The server is not changed. The tablet uses the same four endpoints as the original interface: `/api/state`, `/api/action`, `/api/radiation` and `/api/donki/events`.
- All rules stay on the server: the staged heart alert, the countdown, the roster, the checklist, the report to Earth, the radiation projection and the storm replay. The tablet only shows them and sends the same actions.
- Words and sources shown to the crew were carried over from the original `static/app.js`. Where the team has agreed a word, the agreed word is used (section 4).

## 2. What was searched

- The team's files, read on 2026-11-14: `CLAUDE.md`, `docs/project-context.md`, `docs/ux-00-decisions-log.md`, `docs/ux-07-style-guide.md`, `docs/decisions-style-guide.md`, `docs/decisions-build.md`, `docs/next-chat-build.md`, `docs/ux-06d-information-architecture.md` (parts B and E), `docs/touch-target-spacing-research.md` (sections 1 and 2), and the wireframe sheet `docs/wireframes/png/sheet.png`.
- The server's code and its original interface, read in full.
- Web searches on 2026-11-14 for the general interface rules named in section 5 (Fitts's law, Hick's law, the Doherty threshold) and for the NASA fine motor study. Search results were read; the full papers were not opened.

## 3. Same functions as the original interface

Every action the original interface can send is reachable here. Each was exercised by tapping the real interface in a browser and checking the server's state (`scripts/walkthrough.mjs`, 32 checks, all passing on 2026-11-14).

| Server action | Where it is in the tablet |
| --- | --- |
| `demo_start_s2`, `spe_start`, `reset`, `mode` | Demo controls (top right, "Demo tablet"); mission setting also under "Earth link" |
| `quick_check` (yes, not sure, no) | My health, "Possible heart problem" |
| `stop_countdown` | The countdown, for Lena and for the crew doctor |
| `heart_reading` | "Take a Heart reading" (Lena) and "Record Heart reading" (crew doctor) |
| `decide` (escalate, monitor, confirm, override) | Crew overview, the pinned decision bar |
| `send_now` | The crew doctor's countdown |
| `dismiss_advisory`, `set_outcome` | Crew overview, review list |
| `get_doctor` | "Get crew doctor", in the dock on every view |
| `respond`, `record_step`, `stand_down` | Emergency view |
| `spe_end` | My health, the station caution |
| `checkin` | Check-ins, and "Enter now" on an indicator with no entry yet |

Shown as before: the status sentence, alerts, indicators with trend and usual range, the indicator detail, the radiation detail and its charts, the crew doctor's overview, evidence and person record, the example laboratory history, the decision record, the emergency roster, checklist, report to Earth and end dialog, and the record of who has seen a person's data.

Five differences in behaviour, each deliberate:

1. **A reason is asked after choosing Monitor, Confirm or Dismiss**, in a small dialog, instead of being typed before. The reason is still optional and is recorded the same way. Escalate stays one tap and starts the countdown at once. Reason: section 5, row 9.
2. **The decision controls are hidden while the crew-wide emergency is active.** The original showed them, and pressing Escalate again would declare a second emergency over the first. Opinion: this is a fault path, not a feature.
3. **The radiation figures include the storm during a station caution.** The original asked for the storm only during a Moon or Mars emergency. The server already supports it; the request is the same endpoint.
4. **The demo storm list shows every recorded storm**, grouped by year, where the original showed the first 24.
5. **A gap in the server's day-by-day radiation history is shown as a gap.** In the space station setting the server sends 75 days of history on mission day 95. Cause, read in the code: `radiation/model.py` line 165, `past_rates[-k:] = recent[-k:]`, shortens the list when fewer than 30 recent measurements exist (the station file has 10). The chart marks today at day 95, draws days 76 to 95 as a faint dotted stretch, and says so in words under the chart. The server's figures are shown unchanged. A possible fix on the server, not applied here: `k = min(RECENT_DAYS, today, len(recent))`.

## 4. Team rules followed

Settled rules are from `docs/project-context.md` unless another file is named.

| Rule | How the tablet follows it |
| --- | --- |
| Three views: Normal, Emergency, Crew doctor | My health (with Check-ins, Radiation exposure and My data sharing), Emergency, Crew overview |
| Staged alerts | The caution goes to the person and a quiet advisory to the crew doctor. Nobody else sees anything until an emergency is declared. |
| Alert classes are colour, icon and word; red and yellow only in alerts | Emergency is red with an octagon, Caution yellow with a triangle, Advisory blue with a circle, each with its word. Charts, buttons and check-ins use neutral ink. Shapes: `docs/ux-07-style-guide.md` SG-33. |
| Personal baselines | Every indicator shows its value against the person's usual range, with a seven-day trend. |
| Never worded as a diagnosis; the human confirms | The server's wording is shown unchanged ("screening signal, not a diagnosis"). Alerting is the only automatic step. |
| Missing data is never "normal" | "No entry yet" and "Sensor off" are shown in cyan with an icon and a word (`docs/decisions-style-guide.md`, "Cyan look" and "Reversal"). A lost connection to the server is announced as "Stale" with the time of the last data. |
| Privacy | A tag in the emergency band says whose emergency data is shared. My data sharing shows what is shared, what never is, and who viewed what. |
| Works offline; Earth is additive | Fonts and icons are bundled; nothing loads from the internet. The Earth panel says "sent", "earliest possible reply" and "Continue without waiting". |
| No body figure | None is used. |
| Gamification for completion only | The streak counts completed check-ins and says so. |
| Mock content and demo data are labelled | "Mock content" tags on checklist steps and detailed treatment; "Demo data" in the demo controls and on charts. |
| Tablet first (`CLAUDE.md`, primary rules) | The wrist cuff concept shows nothing that the tablet does not also show. |
| No bare letters or abbreviations (`CLAUDE.md`, primary rules) | Durations are written in words. "ECG", "bpm", "mmHg", "mg/dL" and "mSv" are explained where they appear. The laboratory table writes "Days before launch" and "Days after return" in place of the letters L and R. Units after a value are kept as the wireframes show them. |
| Agreed words (`docs/ux-06d-information-architecture.md`, part E) | My health, Possible heart problem, Heart reading, My data sharing, Crew overview, First actions, Detailed treatment, Earth, End emergency, Keep active, Get crew doctor, Monitor, usual range, Real event, False alarm. |
| The emergency view opens by itself; a caution does not (`docs/ux-00-decisions-log.md`, "Step 2D") | An emergency switches every tablet to the Emergency view. A caution raises the lamp in the status bar and, if the person is already in My health, shows the quick check beside the list. |
| "Get crew doctor" reachable from every Normal view (same entry) | It is in the dock on every view. |
| A countdown with "Stop" and "Send now" (`docs/ux-00-decisions-log.md`, "Declaring a crew-wide emergency") | Shown in the largest type, with both buttons in view. |

## 5. Design choices and their basis

| # | Choice | Interface principle | NASA basis | Accessibility check |
| --- | --- | --- | --- | --- |
| 1 | Main actions are at least 56 px high; emergency actions and acknowledgements at least 76 px | Fitts's law: larger targets are faster and more accurate to hit ([Laws of UX](https://lawsofux.com/fittss-law/)). Sizes: `docs/ux-07-style-guide.md` SG-41. | Fine motor skill fell in the first week in orbit and the first month after landing ([Holden et al. 2023, PubMed](https://pubmed.ncbi.nlm.nih.gov/35609944/)). NASA sets no touch target size (SG-41). | WCAG 2.5.8 (24 px) and 2.5.5 (44 px) both met for these controls. Physical size in millimetres not measured. |
| 2 | Buttons with opposite outcomes sit apart with a divider between them ("Send now" and "Stop countdown"; "End emergency" and "Keep active"; Escalate and the other three decisions) | Error prevention; spacing between targets ([Laws of UX, Fitts's law](https://lawsofux.com/fittss-law/)). | `[V2 10070]` 13 mm between push buttons, or a guard, as read in SG-64. | Target spacing, WCAG 2.5.8: met. The 13 mm gap is not met everywhere; where it is not, a divider stands in, as SG-64 allows. |
| 3 | At most three or four choices at a decision point: three quick-check answers, four decisions, one response button | Hick's law: more choices mean slower decisions ([UK Department for Education, Laws of UX](https://accessibility.education.gov.uk/profession-guidance/interaction-design/laws-of-ux)). | `[V2 10113]` no mental computation, as cited in SG-17. | WCAG 3.3.2 labels: each choice names its outcome. |
| 4 | Each quick-check answer and each decision says what happens next | Name the outcome, not "Yes" and "No" (SG-43). | `[V2 10080]`, as cited in SG-43. | WCAG 3.3.2: met. |
| 5 | Taps only. No drag, slide, hold or hover is needed anywhere. Charts are read by tapping or with arrow keys. | SG-42. | Movement accuracy in microgravity, as cited in SG-42. | WCAG 2.5.7 dragging: met. WCAG 2.1.1 keyboard: charts, dialogs and all controls reachable. |
| 6 | Status bar on every view with the time, the three alert lamps and the Earth link | Alerts must not depend on being on the right page (SG-36). | App. F F.4.2 f, as cited in SG-36. | WCAG 1.4.1: each lamp has icon, word and count. |
| 7 | Navigation as a dock of large keys along the bottom edge | SG-37. Bottom placement for reach is a hypothesis (`docs/decisions-build.md`). | App. F F.4.2 e and g, as cited in SG-37. | WCAG 2.4.3 and 3.2.3: same order on every view. The current key is marked by a bar and bolder ink as well as by its background. |
| 8 | The emergency band flashes only until this person acknowledges, at 0.8 cycles a second, between full and a lower intensity; text never switches off | SG-49. | App. F F.5.11 and Table 10.3-1, as cited in SG-49. | WCAG 2.3.1: below three flashes a second. Stops under the reduced-motion setting. |
| 9 | The crew doctor's decision bar stays in view under the evidence. Escalate is one tap; the other three open a short dialog for the reason. | Everything for a critical task on one display (SG-38). A recorded decision gets a second step; an urgent one does not (SG-43). | `[V2 10037]`, `[V2 10080]`, as cited in SG-38 and SG-43. | WCAG 3.3.4 error prevention: supported for recorded decisions. |
| 10 | Reasons can be tapped from a short list as well as typed | Recognition over recall (Nielsen 6, `docs/ux-design-research.md` section 1.1). Opinion: typing is slow on a tablet in an emergency. | None found. | WCAG 3.3.2: the field keeps its label; a tapped reason can be edited. |
| 11 | A scrolling list says "More below" in words, as a strip under the list that never covers content | SG-66. | App. F F.4.2 h, as cited in SG-66. | The strip is a button, so scrolling does not need a swipe. |
| 12 | Every tap changes the control's look at once; the state arrives from the server within about a second | Feedback within 400 ms ([Laws of UX, Doherty threshold](https://lawsofux.com/doherty-threshold/)); SG-44 asks for 0.1 s. | `[V2 10022]`, as cited in SG-44. | Not measured on a tablet. |
| 13 | "Beat shape": a schematic of one heartbeat, usual against now, for the heart rhythm indicator | Opinion: a picture explains "ST shift" to a crew member who is not a doctor. Plain language rule (`CLAUDE.md`). | None. | The same information is in the sentence above it. The figure is labelled as a schematic, not a recorded tracing. Not checked by a clinician. |
| 14 | The report to Earth is drawn as a signal in flight, with the earliest possible reply and "Continue without waiting" | Visibility of system status (Nielsen 1, `docs/ux-design-research.md` section 1.1). | Settled rule "Earth is additive". | The same facts are written as text under the drawing. |
| 15 | "Large" size raises text and every target by 12.5% | Larger targets help with gloves and vibration (`docs/touch-target-spacing-research.md`, rows S16, S17 and R9, secondary or unverified there). | None found. | WCAG 1.4.4 resize text: supported. |
| 16 | Inter for words and DM Mono for numbers, both bundled | SG-22 and SG-23. | App. F F.5.1 b and d, as cited there. | No text is smaller than 16 px (SG type scale minimum). |

## 6. Departures from the team's style guide

These follow the build direction Ammar chose and recorded in `docs/decisions-build.md` ("Dark mission control: bold charts, layered panels, large touch controls"). They are proposals. They do not settle the style-guide track.

| Style guide | This build | Why |
| --- | --- | --- |
| SG-03: light theme by default (not settled) | Dark first; light is one tap away | Ammar's recorded choice. Both themes pass the automated contrast check. |
| SG-34: square corners (not settled; no evidence either way) | Rounded panels (14 px) and controls (12 px) | Ammar's recorded choice. No usability claim is made for the radius. |
| SG-12: primary buttons dark green | Kept | Green is never used as a status. A completed check-in is shown in neutral ink. |
| SG-21: likelihood as a 20-dot strip | Not used | The server reports criteria that are met, not met or not yet known. It reports no likelihood. |
| Wireframe dock: My health, Check-ins, Alerts, Earth | My health, Check-ins, Radiation, My data sharing, plus Crew overview for the crew doctor | Alerts sit at the top of My health and in the status bar lamps. Earth opens from the status bar. Radiation and data sharing each need a full view for their content. Opinion; open to the wireframe track. |
| Sound and vibration (section 11) | Not built | Still under research on the style-guide track. The wrist cuff concept shows a brief shake where a vibration would be. |

## 7. Checks run

- **Functions:** 32 checks, each a real tap followed by a check of the server's state. All pass (2026-11-14, Chrome, 1280 by 800), on the built files in `dist`.
- **Accessibility scan:** axe-core with the WCAG 2.0, 2.1 and 2.2 level A and AA rule sets, on 10 screens in each theme (My health quiet and with a caution, Radiation exposure, Check-ins, My data sharing, demo controls, the evidence view, the emergency view for the lead and for the patient, and the end dialog). Two kinds of fault were found and fixed (a label that did not match its visible text; a scrolling region that could not take focus). The final run found none.
- **Text size:** no text under 16 px on those screens.
- **Launcher:** `run.py` was started from another folder, with this folder next to an `anna/vitals-atlas-radiation` copy in a parent folder whose name has a space, as on the PC (Linux, Python 3). Checked: the tablet page, the script and its content type, the fonts, the four endpoints, `/classic`, and eight requests that try to read files outside `dist` (each returned the tablet page). Not run on Windows.
- **Layouts looked at:** 1280 by 800, 1366 by 1024, 1024 by 768, 800 by 1280 (portrait), and 1920 by 1080 for the wall.

## 8. Not verified

- Nothing was tested on a physical tablet, with gloves, in vibration, or with crew. Sizes are nominal CSS pixels, not measured millimetres.
- No screen reader was used. The automated scan cannot prove WCAG conformance.
- Contrast was checked by the automated scan against WCAG AA (4.5:1). The team's stricter 6:1 target (SG-07) was computed for the two text colours on each of the four surface colours in both themes: the lowest is 6.01 (secondary text on a raised surface, light theme). Text on the alert fills and on the green button is 7.0 or more. Charts and icons were not computed one by one.
- The "Beat shape" schematic was not reviewed by a clinician.
- The general interface rules in section 5 were read from summaries, not from the original papers.
- The wrist cuff is a concept. The team's watch design is a later deliverable (`docs/ux-00-decisions-log.md`, "Devices").
- Devices that inspired the cuff, from web searches on 2026-11-14: the Canadian Space Agency's Bio-Monitor shirt and tablet app ([CSA](https://asc-csa.gc.ca/eng/sciences/astroskin.asp)); NASA's wrist-mounted Electronic Cuff Checklist ([SAE 911529](https://saemobilus.sae.org/content/911529/)); and the Ax-4 demonstration that processed wearable data on board, without ground servers ([Booz Allen](https://www.boozallen.com/insights/fast-tracking-results/how-booz-allen-is-helping-astronauts-sleep-better.html)).
