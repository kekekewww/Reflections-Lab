# Reflection Lab

Hear a room while you design it. Reflection Lab is a browser-based 3D room with real-time physics that traces how sound reflects off its surfaces. Describe a room in plain words and Muse, Meta's model, builds it: you get a preview, nothing changes until you press Apply, and the surfaces it adds change the sound.

It's for sound designers, game audio teams and architects who want to try a space early. The acoustics are a real-time approximation, not a measurement.

[Traditional Chinese README](README.zh-TW.md)

This repository is a public source snapshot. Its [note](docs/00-project/PUBLIC_SNAPSHOT_20261104.md) explains what's included.

## What you need

- **Node 22.17.0 and npm 11.4.2.** These exact versions are pinned in `package.json`.
- **A desktop Chromium browser,** such as Chrome. This is what the project was tested in.
- **Headphones,** so you can hear the direction of a sound.
- **A Meta Model API key,** only for the Muse features. Everything else runs without one.

## Run it without a key

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Meta requests are off in this mode and nothing is spent. The agent panel only offers offline tools, which are not a language model. Run only one Reflection Lab server at a time, because this and the Muse launcher both use port 8787.

## Run it with Muse

Put your key in a file outside the repository, then run:

```powershell
npm ci
npm run build
npm run demo:live -- --key-file "<path to the server-only key file>"
```

Open http://127.0.0.1:4173. Press Ctrl+C in the terminal to stop.

- **Your key** stays on the local server and never reaches the browser.
- **Spending** only happens when someone submits an instruction with Meta Model API selected. A typical proposal costs a few cents at list price.
- **The budget record** is `research/v1/meta-live-budget-20261104-limits.json`. The launcher stops at US$5 or 200 requests, and that count includes the project's earlier use.

## First steps

1. Set **Interface language** to English in the top bar.
2. Click **Enable listening**. Start with your device volume low.
3. Press **Start simulation**. The ball drops, the speaker plays a tone, and the lines in the room show the sound's paths.
4. Move the camera: right-drag to orbit, middle-drag to pan, and scroll to zoom.

The room is open at one end. If a wall blocks your view, orbit until you can look in through the open end.

## Build a room with Muse

Open the **Meta experiment agent** tab and choose **Meta Model API**. Press **Pause** before each instruction. Paste an instruction, press **Generate action preview**, and wait. Most take under a minute. Check the preview, then press **Apply actions**.

These four worked in our rehearsals, in this order:

**1. Build a recital room**

```text
Turn this room into a small recital room: a raised wooden stage across the back wall, a grand-piano-sized box on the stage, and twelve chairs in three rows facing the stage.
```

**2. Add to it.** Afterwards, press **Reset** and **Start simulation**, then open the **Acoustic paths** tab to find reflections off the new wall panels.

```text
Now make it feel like a real concert space: add three slim metal columns, floor to ceiling height, along each side wall, evenly spaced from the stage to the open end of the room. Add two soft wall panels at ear height on each side wall, between the columns. Add a 4-step wooden staircase leading up to the left end of the stage. Don't change anything that's already here.
```

**3. Change a sound.** Afterwards, press **Reset** and **Start simulation** to hear the ball's next impact.

```text
Raise the pitch of the ball's impact sound by 7 semitones.
```

**4. Move a sound around you.** Afterwards, press **Resume simulation**, open the **Motion** tab and press **Run**. Don't press Reset first.

```text
Move the listener to the middle of the room at ear height, then move the speaker in a slow circle around the listener at 1.5 m height, radius 2 m, over 8 seconds, ending where it started.
```

To take back a proposal, press **Undo last AI apply** straight after Apply, before you start or reset the simulation.

## Walk around in first person

Press **Enter first person** and click the view.

| Input | Action |
| --- | --- |
| W, A, S, D | Move |
| Shift | Sprint |
| Mouse | Look around |
| Left click | Grab the object you're aiming at, then left click again to throw it |
| Right button | Hold to preview a new object, release to place it. While holding an object, put it down |
| Mouse wheel | Change the distance of a held object or preview |
| R | Rotate a held object or preview |
| L | Open the object library |
| Enter | Pause or resume |
| Esc | Release the mouse |

Leaving first person resets the camera, so orbit back into the room afterwards.

## Draw a path by hand

Only objects with sound can have a path.

- **In the editor:** select the object and press **T**. Click surfaces to add points, click a point to select it, then drag it. **Delete** removes the selected point. Press **T** or **Esc** to finish.
- **In first person:** aim at the object, hold **Ctrl** and press the left mouse button, then drag through the room and release. Press **Enter** or click to start the take.

Press **Shift+T** to show the path curves in the view.

## What the tabs do

| Tab | Use it to |
| --- | --- |
| Events & recording | See collisions and sound decisions, and record or replay a take |
| Acoustic paths | List the direct path and reflections reaching the listener |
| Experiment comparison | Compare two takes |
| Meta experiment agent | Give Muse instructions, or use the offline tools |
| Motion | Run, edit and remove object paths |
| Audio export | Capture and render audio files |
| Performance | Check timing and audio dropouts |
| Zones | Add zones that trigger sound rules |

The [user guide](docs/11-v1/USER_GUIDE.en.md) covers the rest of the app. Its agent section was written before the multi-step builder, so use this page for Muse.

## How Muse fits in

1. Muse Spark 1.3 gets your instruction, the current scene and a set of tools. It can create a scene, add, move, resize and remove objects, set materials and physics modes, configure sound sources, move the listener and write paths.
2. The server tries the proposal on a copy of the scene, using the app's real scene rules, physics and motion code. If a step fails, Muse gets the error and tries again, up to three rounds.
3. The browser checks the proposal again and shows a preview. Nothing changes until you press Apply.

Sound rule changes, like prompt 3, go through a separate planner. Full results are in the [scene builder record](docs/00-project/MUSE_SCENE_BUILDER_20261104.md).

## Known limits

- **Undo** only works straight after Apply, and it only goes back one proposal.
- **Reset after a Muse path** greys out Run until you press **Rebind to current scene**.
- **Recording** stalled in both of our tries with a Muse path in a 34-object scene. Screen-record large scenes instead.
- **Proposal size** is capped at 32 steps. Very long paths can run out of model output.
- **Sound stops above 256 acoustic surfaces per source.** A box counts as 6 and a sphere or capsule as 1. Muse sees this limit, and the app refuses proposals that go over it.
- **Paths don't avoid objects.** The app refuses a path that runs through something.
- **Scenes use simple shapes:** boxes, spheres and capsules.
- **A path on the ball is silent.** Put the path on the speaker to hear it move.
- **"Acoustics stale" or "Acoustics pending"** shows while things move. It means the screen shows the last finished calculation.
- **Nobody has formally listened to the Muse-built scenes yet,** and this is not a complete first version. Full performance and listening checks are still open.

## Run the checks

```powershell
npm ci
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run check
npm run benchmark
```

`npm run check` takes about 10 minutes. GitHub's browser job currently fails on 5 older tests, so the commit shows a red X. We haven't investigated all of them, and they're listed in the [validation record](artifacts/public-snapshot-20261104/verification.json).

## Project layout

| Folder | Contents |
| --- | --- |
| `src` | The web app: UI, physics, acoustics, audio and motion |
| `server` | Local API server and Meta Model API integration |
| `tests`, `benchmarks` | Automated tests and reference benchmarks |
| `schemas` | Data and AI tool contracts |
| `scripts` | Launchers, setup and validation tools |
| `docs` | Architecture, design and validation documents, with English copies in `docs/en` |
| `knowledge` | Project notes and task records |
| `research` | Sources, formulas and evidence records |

## Licence

The project has no root licence yet, so no reuse rights are granted. Third-party licences are listed in the [licence register](docs/01-compliance/LICENSE_REGISTER.md).
