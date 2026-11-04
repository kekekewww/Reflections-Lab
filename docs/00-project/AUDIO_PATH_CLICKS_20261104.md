# Audio clicks on path changes: cause, fix and limits (2026-11-04)

## Report

The user reported crackles during plain Start, heard when the visible sound paths recalculated, and noticed that reverb changed them. Earlier checks in the same session wrongly described plain play as clean, because they barely exercised movement.

Evidence: [final comparison](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5b8003ad50406dfbfeae0415da5bbbb03d4832fb) and [raw results and harness](archive://uncommitted-local/artifacts/v1/audio-path-clicks-20261104/). Every run recorded the app's output just before the audio device, in a throwaway Brave profile on an RTX 4070, from an offline e2e build. Most setups ran two or three times for about 10 seconds each, so these are small samples.

"Click" below means a short broadband burst more than 50 dB below the tone level, and "louder" means more than 40 dB below it. These are signal measurements, not listening results.

## Causes

| Cause                                                                                                                                                   | Evidence                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A retired path was disconnected about 25 ms after its 20 ms fade. The likely reason is that the native HRTF panner still outputs after its input stops. | Keeping route nodes 100 ms longer took ball-scene clicks from 4-7 to 0 per 10 s, at the same rate of path changes. Stereo panning also gave 0. |
| Each path update moved the HRTF panner's direction over only 20 ms.                                                                                     | With a moving source, freezing direction or using stereo panning gave 0 clicks, while freezing delay or gain did not.                          |
| Reverb adds one extra route that follows the earliest path.                                                                                             | Path changes per second rose from about 1.0 to 1.6. Freezing direction removed the clicks with reverb too, so reverb is not a separate source. |

The app's output buffer is not the cause. The three app presets made no clear difference, and a 170 ms buffer roughly doubled the clicks with no dropouts. Compute load in the solver is not the cause of the clicks: with direction frozen, the same update work gave none.

The audio thread does have a limit. Direction ramps of 100 ms brought far more output dropouts than 20 ms or 40 ms, which is why 100 ms was rejected. The browser did not report render capacity, so the load itself was not measured.

## Fix

- `src/audio/engine.ts`: a retired route stays connected for its 20 ms fade plus 100 ms, in live and offline rendering.
- `src/audio/routes.ts`: path direction and listener position change over 40 ms. They must match, because a panner sits at listener position plus direction.
- Listener turning stays at 20 ms. Longer values brought dropouts without clearly fewer clicks.

Retired routes count toward the path budget for longer, so a very busy scene could reach the 96-path limit sooner. This was not exercised.

## Result

Old build against the fixed build, three interleaved runs each, about 10 s per run, on the same machine:

| Scene                          | Clicks        | Louder clicks | Worst level vs tone | Dropouts |
| ------------------------------ | ------------- | ------------- | ------------------- | -------- |
| Ball moving, old               | 3, 2, 2       | 2, 1, 1       | -25.6 dB            | 0, 0, 0  |
| Ball moving, fixed             | 0, 0, 1       | 0, 0, 0       | -44.5 dB            | 0, 0, 0  |
| Ball moving with reverb, old   | 3, 1, 6       | 3, 1, 4       | -23.9 dB            | 0, 0, 6  |
| Ball moving with reverb, fixed | 1, 2, 2       | 0, 0, 0       | -40.8 dB            | 24, 0, 0 |
| Speaker moving, old            | 22, 29, 25    | 5, 8, 3       | -27.5 dB            | 0, 0, 0  |
| Speaker moving, fixed          | 18, 19, 20    | 0, 1, 0       | -39.6 dB            | 6, 0, 0  |
| Turning, old                   | 167, 157, 26  | 5, 9, 6       | -33.9 dB            | 0, 0, 0  |
| Turning, fixed                 | 170, 105, 132 | 4, 11, 3      | -35.1 dB            | 0, 0, 0  |

## Listening result and decision

The first fix alone did not satisfy the user: it still crackled by ear. Comparing pages in the user's normal Brave:

- With stereo panning on every path, the crackle was gone by ear. This identifies the browser's native HRTF panner as the source.
- With HRTF on the direct path only, it still crackled but was much better, and the user accepted that for the MVP.

The live app therefore uses HRTF on direct paths only. Reflections and the reverb send use stereo panning. A path's model is fixed when its route is created. While the direct path is blocked, the sound uses stereo rather than moving HRTF to a reflection, because changing the model on a live panner would reset its state. Exports and static previews still use HRTF on every path, and clicks there were not measured.

Two runs per setup, about 10 s each, interleaved, on the fixes above:

| Scene                   | Measure  | HRTF on all paths | HRTF on direct path | Stereo |
| ----------------------- | -------- | ----------------- | ------------------- | ------ |
| Speaker moving          | Clicks   | 12, 20            | 8, 2                | 0, 0   |
| Speaker moving          | Dropouts | 3, 19             | 0, 0                | 0, 0   |
| Turning                 | Clicks   | 65, 118           | 74, 115             | 0, 0   |
| Turning                 | Dropouts | 1, 0              | 0, 0                | 0, 0   |
| Ball moving with reverb | Clicks   | 1, 0              | 0, 2                | 0, 0   |
| Ball moving with reverb | Dropouts | 10, 5             | 0, 0                | 1, 1   |

Direct-path HRTF had no dropouts in these 6 runs, which suggests HRTF panner count was loading the audio thread. Render capacity was not reported, so the load itself was not measured.

Captures from the user's own session on this version ran at 60 frames per second with reverb off and the ball as the only moving object. A 30 s capture had 234 clicks, 27 louder clicks and 1 dropout, with path changes about twice a second. That many clicks resembles the turning results above, so the crackle that remains is most likely the direct path's HRTF panner while the listener moves or turns. The session's actions were not recorded, and only one crackle was marked, so this is an inference.

## Next options

Holding panners at fixed directions and crossfading between them, or an own HRTF engine, could remove the remaining clicks. Neither was built. Frozen direction gave no clicks with a moving source, but crossfading is untested.

## Limits

- Turning in first person is not fixed. Clicks remain with HRTF on the direct path, and no tested ramp removed them. Only stereo did.
- Front/back and height cues now come from the direct path only, and are absent while it is blocked. Nobody has tested how well direction can be judged.
- Volume dips of about 4-5 dB for up to about 30 ms around path changes remain. The one fade test was invalid because other route nodes still disconnected early.
- One fixed run with reverb had 24 dropouts and one fixed run with a moving speaker had 6. Old runs also had occasional dropouts, so a side effect is not ruled out at this sample size.
- A few runs on both builds went fully silent for a moment. This was not investigated.
- Measurements ran at 60 Hz. A 240 Hz browser window was not tested.
