# Muse multi-step scene builder: approval, results and limits (2026-11-04)

## Approval

On 2026-11-04 the user said they have about US$100 to try and approved a separate US$5 budget: "Yes, US$5". The approval covers limit testing, a multi-step scene builder and an experiment loop if time allows. Going beyond US$5 needs a new approval. [Authorization record](../../research/v1/meta-limits-authorization-20261104.json); [ledger](../../research/v1/meta-live-budget-20261104-limits.json). The earlier ledger, `research/v1/meta-live-budget-20261104.json`, is unchanged.

The model is `muse-spark-1.3` in Standard mode, so content isn't used for training. Prices were re-checked on 2026-11-04: US$1.25 per million input tokens and US$4.25 per million output tokens, with reasoning billed as output.

Costs on this page are estimates from reported tokens at list price. The Meta account is the record of real spend. The ledger holds 103 requests at about US$2.82, of which 8 were wasted by errors in a test script.

## What changed

- **One instruction, one proposal.** Muse can return up to 32 scene changes in one response. The app validates them together and shows one preview, one Apply and one Undo.
- **Muse corrects itself.** Before answering, the server runs the real Host and Motion rules against the submitted scene. If a list fails, Muse sees why and gets up to 3 rounds in total. The browser's Host validates again before any preview, and nothing changes until a person presses Apply.
- **Editing.** Muse can now move, resize and remove objects, not only add them. Removing an object also removes its sound sources, sound bindings and paths, and Undo restores them.
- **Budget.** One named authorization may use up to US$5, 200 requests, 16,000 completion tokens and 128,000 input bytes. Every other authorization keeps the earlier limits, and an existing ledger still refuses changed settings. Under this authorization, a finished request counts its token estimate rather than its worst-case reservation.
- **Paths that can't play.** A path whose first sample isn't where its object is now fails at preview, where Muse can correct it. Before, it passed preview and then refused to start.
- **Bugs this work exposed and fixed:**
  - Live requests stopped 120 seconds after the first one, until the page was reloaded.
  - After any earlier scene edit, Muse's next path was rejected with `REVISION_CONFLICT`.
  - Applied and cancelled proposals used up the Host's tool allowance and preview capacity.
  - Requests that mentioned a sound word could go to the sound planner, even when they asked to edit the scene.
  - Preview lines appeared in Chinese in the English interface.

The earlier statement that Muse can't write paths was wrong: it could always propose Motion panel paths. It still can't write the curves drawn with the T key.

## Bench results

Evidence: [runs](../../artifacts/v1/muse-limits-20261104/) and [drawings of 12 scenes](../../artifacts/v1/muse-limits-20261104/plans.html). The bench ran real requests through the real `LabRuntime`, Host and Motion hooks in Node: 56 runs and 63 requests, about US$1.71.

| Task | Result |
| --- | --- |
| Recital room: stage, piano, 12 chairs | 14 objects, none outside the room, overlapping or unsupported |
| Table with four legs and a lamp on top | 7 parts; every contact checked by hand |
| 8-step staircase | No gaps, and every step reaches the floor |
| 5 by 5 column grid | No spacing error |
| Arc of 10 chairs facing the speaker | Radius and facing exact; 2 overlaps reported, probably because the scorer uses axis-aligned bounds on rotated boxes |
| 2 m circle | Radius exact; the path started |
| Figure-eight plus a second path | Both paths started; the shape was checked in a drawing, not measured |
| Edit an existing room | Correct at all three thinking levels |
| 40 chairs requested | Built 32 and usually said so |
| Concert hall from scratch | Room first, then a stage and 3 to 5 rows of seats in a second instruction |
| Traditional Chinese request | Built the room and replied in Chinese |
| Velvet curtains and a cello recording | Said neither exists and used the closest thing, without inventing assets |

Medium thinking was the best value: a typical build took 7 to 45 seconds and cost US$0.01 to US$0.04. Minimal thinking was less reliable: one run proposed 1 of 6 steps while describing all of them. High thinking was slower and sometimes used up the token limit.

## Real app results

Evidence: [first pass](../../artifacts/v1/muse-limits-20261104/app-test/results.json) and [second pass](../../artifacts/v1/muse-limits-20261104/app-test-2/results.json), with screenshots. These ran the production build in Brave, with no person listening.

| Check | Result |
| --- | --- |
| Build, edit and Undo | 14 changes took the scene from 6 to 20 objects; an edit took it to 16; Undo returned it to 20 |
| Path through the Motion panel | Ran and played in the 20-object room |
| Apply while a path plays | Works: the run stops and the path stays |
| Requests past two minutes | Still accepted |
| Muse's notes | Shown in the panel |
| Browser errors | None |

**The acoustic limit.** The second pass added 25 box columns to the recital room, which made 259 acoustic surfaces. The solver refuses a scene above 256, so all sound stopped, with a red error and no acoustic paths. Its frame and dropout numbers looked good only because there was no audio to process, and they aren't reported here. Muse could propose this with nothing to warn it, so the Host now rejects such a proposal at preview, and Muse is told the current count and the limit.

The [third pass](../../artifacts/v1/muse-limits-20261104/app-test-3/results.json) asked for the same 25 columns again. Muse built them as capsules, which count as 1 surface each instead of 6, and the scene stayed at 134 surfaces with sound playing. Its first list reused an ID, so the server sent the error back and it corrected itself, which took 100 seconds in total.

Running the simulation for 10 seconds in those scenes, with the output level read to confirm sound was playing:

| Scene | Acoustic surfaces | Frames per second | 95th percentile frame | Worst frame | Output level | Acoustic paths | "Acoustics pending" shown | Dropouts seen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default room, 6 objects | 25 | 58 | 17 ms | 134 ms | -40.4 dBFS | 5 | 5 of 20 samples | 1 |
| Recital room, 20 objects | 109 | 60 | 17 ms | 50 ms | -40.8 dBFS | 4 | 11 of 20 samples | 1 |
| With 25 capsule columns, 45 objects | 134 | 60 | 17 ms | 17 ms | -42.9 dBFS | 8 | 7 of 20 samples | 1 |

Each scene was run once, in that order, and dropouts were read from a counter sampled every half second, so a short dropout could be missed. The samples count "pending" only: the 45-object screenshot shows "Acoustics stale", and how often that appears wasn't measured. These numbers aren't clearly worse in the bigger scenes, but they don't show how the scenes sound, and no scene near 256 surfaces was run live.

The solver itself has headroom. On saved scenes of up to 222 surfaces it used under a third of its visibility-test budget and took 2 to 3 ms per solve in Node, so the 256 limit might be raised later. That hasn't been tried.

## Limits

- **256 acoustic surfaces.** A box counts as 6, and a sphere or capsule as 1. The default room uses 25, which leaves room for about 38 more boxes. Muse's proposals are checked; adding objects by hand in the editor is not, and the error stays on screen until dismissed even after the sound returns.
- **Long outputs get cut off.** Three objects with 64-point paths used up the 16,000 tokens in both runs and produced nothing, wasting about US$0.07 each. One chair arc at high thinking did the same.
- **A passing proposal can be incomplete.** The app checks that a list is valid, not that it does everything asked.
- **32 changes per proposal.** Bigger builds need several instructions.
- **Undo goes back one proposal.** After undoing the latest proposal, the one before it can't be undone from the agent panel.
- **Paths don't avoid objects.** A circle through the 25-column grid stopped with `KINEMATIC_BLOCKED`. The block is correct physics, but Muse doesn't check for it.
- **Paths and Rebase.** After an acoustic or manual edit, an existing path needs "Rebind to current scene" before it plays. This is deliberate, because A/B reprocessing compares the path registry byte for byte. It may also block an experiment run with a moving object.
- **Scene and sound are separate planners.** One instruction can't yet change both the scene and sound behavior rules.
- **Blocks only.** Boxes, spheres and capsules; 4 materials; one tone signal in the scene tools.
- **Not tested:** listening to Muse-built scenes, judging direction by ear, and audio with many moving objects.

## Demo rehearsal in the real app

On 2026-11-04 the [video script](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f675bd19b195faa9e7e8f5d7fe46ccc0e8b889d5) was rehearsed in Brave on the real GPU, with the requests billed to this budget. Evidence is in [the rehearsal folder](../../artifacts/v1/muse-limits-20261104/demo-rehearsal/): `d1`, `d2` and `d3` are the full passes, and `d3` follows the final order.

| Prompt | Worked | Wait | Result |
| --- | --- | --- | --- |
| Recital room | 6 of 6 | 32–43 s | 14 new objects |
| Concert space, final wording | 4 of 4 | 39–59 s | 14 new objects, no overlaps in the 3 runs checked |
| Ball impact pitch +7 semitones | 3 of 3 | 9–16 s | Two sound actions, applied |
| Listener to the middle, speaker circling it | 1 of 1 | 38 s | Output level swung between about -28 and -34 dBFS, with 3–5 paths |

Reflections off the wall panels Muse added appeared in the Acoustic paths list in all 3 full passes.

Problems found. None is fixed, and their causes have not been investigated:

- **AI Undo only works straight after Apply.** It took the scene from 34 back to 20 objects when pressed at once. After Start or Reset it refused with `REVISION_CONFLICT`, and the English interface showed a line of Chinese in the error.
- **Reset after a Muse path disables Run.** "Rebind to current scene" brings it back. Run works without either step when pressed straight after Apply and Resume.
- **Recording stalls in a 34-object scene.** With a Muse path applied, one take paused on a full evaluation queue at 3.8 s, and another stayed at 0.6 s after Resume.
- **A path on the ball makes no sound of its own**, so the level does not change. A path on the speaker does change it.
- **Moving the camera before the first Apply did not last**, and leaving first person resets the camera.

Not tested: anyone listening to these scenes, grabbing or throwing the ball in first person in this flow, and more than one run of the speaker circle.

## Start the live app

```powershell
npm run build
node scripts/demo-live.mjs --key-file "<path to the server-only key file>"
```

Then open `http://127.0.0.1:4173`. A request is sent only when someone submits an instruction with "Meta Model API" selected. Press Ctrl+C to stop both servers.
