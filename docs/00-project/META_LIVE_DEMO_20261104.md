# Meta Model API live demo: approval, result and limits (2026-11-04)

## Approval

On 2026-11-04 the user confirmed that the hackathon demo must show Meta AI and approved a new budget of up to US$1 for a live rehearsal and filming through the product UI. The user named the server-only key file in the project root. This page stores no key, hash of a key or Authorization value. The key file is ignored by Git and is read only by the local server.

The earlier US$1 approval of 2026-10-27 is used up and its ledger is unchanged. This approval has its own ledger, `research/v1/meta-live-budget-20261104.json`, capped at US$1 and 12 requests. The budget does not extend to other accounts, deployment or publication. Reaching the cap needs a new approval from the user; the ledger must not be reset.

## Result

Evidence: [summary](../../research/v1/meta-live-ui-20261104/summary.json), [proposal screenshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0b7a154b6b957691c452b290306b1893102ce710), [second take screenshot](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/41630bf7d96be6b53c0c4d0748cd5f4e811ab1d1), [model list proof](../../research/v1/meta-catalog-20261104-demo.json).

| Item | Result |
| --- | --- |
| Model | `muse-spark-1.3`, Standard mode (content is not used for training), `reasoning_effort: minimal`, no retries |
| Route | App screen, then local server, then Meta Model API; the browser never calls Meta directly |
| Prompt | "Raise the pitch of the ball's impact sound" |
| Reply time | 6.7 s in the passing run |
| Proposal | `RemoveBinding` plus `AssignBinding` with `pitchSemitones` on `rule.impact`; checked by the local Host; nothing changes until Apply |
| Motion across the two takes | Poses identical through tick 112; physics events identical apart from per-run IDs |
| Sound across the two takes | All 4 ball impact voices start on the same ticks with the same gain, pitch 0 before and +7 semitones after; the speaker is unchanged |
| Requests so far | 3, estimated US$0.0256 from reported tokens and the published rates |

The first request was refused by the local Host (`DUPLICATE_ID`) because Muse's instructions did not state the remove-then-assign rule; nothing was applied. The instruction was fixed; the Host rule was not relaxed. The second request produced a valid proposal, but the rehearsal script stopped before reading the applied result. The third request passed the whole flow.

## Limits

- This is real-request evidence in headless Chrome with software WebGL. No person has listened to it, and no real GPU browser or audio device was used.
- The model chooses its own value: the same prompt gave +12 and then +7 semitones. State the value in the prompt when a fixed result matters.
- At the time of this rehearsal, only sound behavior proposals had been verified through the UI. The statement here that Muse cannot write paths was wrong: it could always propose Motion panel paths. Scene proposals are now verified in the [scene builder record](MUSE_SCENE_BUILDER_20261104.md). Meta-planned simulation runs through the UI remain unverified.
- Actual billing and remaining credit are unknown; the cost above is an estimate.
- Recording paused 20 times across the two short takes under software WebGL and continued with the product's Resume. Real-time performance on a real GPU is not measured here.

## Start the live app

```powershell
npm run build
npm run demo:live -- --key-file "<path to the server-only key file>"
```

This launcher now uses the US$5 budget and multi-step builder described in the [scene builder record](MUSE_SCENE_BUILDER_20261104.md).

Then open `http://127.0.0.1:4173`. The agent server accepts requests only from its listed local addresses, and this is one of them. A request is sent only when someone submits an instruction with "Meta Model API" selected. Press Ctrl+C to stop both servers.
