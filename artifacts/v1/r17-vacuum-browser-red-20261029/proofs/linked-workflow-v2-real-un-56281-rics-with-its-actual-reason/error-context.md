# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: linked-workflow-v2.spec.ts >> real unavailable propagation preserves path identity and null metrics with its actual reason
- Location: tests\browser\linked-workflow-v2.spec.ts:166:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "unavailable"
Received: "ready"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to main workspace" [ref=e4] [cursor=pointer]:
    - /url: "#main-workspace"
  - generic [ref=e5]:
    - banner [ref=e6]:
      - generic [ref=e12]:
        - text: REFLECTION
        - generic [ref=e13]: LAB
      - generic [ref=e14]:
        - strong [ref=e15]: 聲音行為實驗
        - generic [ref=e16]: Scene rev 0 · Local project
      - navigation "Workspace" [ref=e17]:
        - button "01 Build scene" [ref=e18] [cursor=pointer]:
          - generic [ref=e19]: "01"
          - text: Build scene
        - button "02 Interactive experiment" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: "02"
          - text: Interactive experiment
        - button "03 Inspect & compare" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: "03"
          - text: Inspect & compare
      - generic [ref=e24]:
        - generic [ref=e25]: 介面語言 / Interface language
        - combobox "介面語言 / Interface language" [ref=e26]:
          - option "繁體中文"
          - option "English" [selected]
      - generic [ref=e27]:
        - button "Save project" [ref=e28] [cursor=pointer]
        - button "Export project" [ref=e31] [cursor=pointer]
        - button "Load locally saved project" [ref=e34] [cursor=pointer]
        - button "Import project JSON" [ref=e37] [cursor=pointer]
    - generic "Simulation controls" [ref=e40]:
      - generic [ref=e41]:
        - button "Start simulation" [ref=e42] [cursor=pointer]
        - button "Reset" [ref=e45] [cursor=pointer]
        - button "Undo scene command" [disabled] [ref=e49]
        - button "Redo scene command" [disabled] [ref=e52]
      - generic [ref=e55]:
        - generic [ref=e56]: Ready
        - generic [ref=e57]: 0.00 s
        - generic [ref=e58]: tick 0
      - generic [ref=e59]:
        - button "Scene" [pressed] [ref=e60] [cursor=pointer]
        - button "Inspector" [pressed] [ref=e63] [cursor=pointer]
    - status [ref=e66]:
      - generic [ref=e69]: "Authoring edit: paused and cleared previous sounds."
    - main [ref=e70]:
      - complementary "Scene and assets" [ref=e71]:
        - generic [ref=e72]:
          - heading "Scene" [level=2] [ref=e73]
          - generic [ref=e74]: 6 objects
        - textbox "Search scene objects" [ref=e79]:
          - /placeholder: Search objects or IDs
        - generic [ref=e80]:
          - generic [ref=e81]: Object library
          - generic [ref=e82]: PRIMITIVES
        - generic [ref=e83]:
          - button "Box +" [ref=e84] [cursor=pointer]:
            - generic [ref=e87]: Box
            - generic [ref=e88]: +
          - button "Sphere +" [ref=e89] [cursor=pointer]:
            - generic [ref=e93]: Sphere
            - generic [ref=e94]: +
          - button "Capsule +" [ref=e95] [cursor=pointer]:
            - generic [ref=e98]: Capsule
            - generic [ref=e99]: +
        - generic [ref=e100]: Scene objects
        - list "Scene object list" [ref=e104]:
          - listitem [ref=e105]:
            - button "floor Fixed" [ref=e106] [cursor=pointer]:
              - generic "floor" [ref=e111]
              - generic "fixed" [ref=e112]: Fixed
          - listitem [ref=e113]:
            - button "wall.back Fixed" [ref=e114] [cursor=pointer]:
              - generic "wall.back" [ref=e119]
              - generic "fixed" [ref=e120]: Fixed
          - listitem [ref=e121]:
            - button "wall.left Fixed" [ref=e122] [cursor=pointer]:
              - generic "wall.left" [ref=e127]
              - generic "fixed" [ref=e128]: Fixed
          - listitem [ref=e129]:
            - button "wall.right Fixed" [ref=e130] [cursor=pointer]:
              - generic "wall.right" [ref=e135]
              - generic "fixed" [ref=e136]: Fixed
          - listitem [ref=e137]:
            - button "ball Dynamic" [pressed] [ref=e138] [cursor=pointer]:
              - generic "ball" [ref=e144]
              - generic "dynamicGravity" [ref=e145]: Dynamic
          - listitem [ref=e146]:
            - button "speaker Fixed" [ref=e147] [cursor=pointer]:
              - generic "speaker" [ref=e152]
              - generic "fixed" [ref=e153]: Fixed
        - button "Listener / Environment listener.main Independent position" [ref=e154] [cursor=pointer]:
          - generic [ref=e157]:
            - text: Listener / Environment
            - generic [ref=e158]: listener.main
          - generic [ref=e159]: Independent position
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: Sound assets
            - generic [ref=e163]: "0"
          - generic [ref=e164]: No assets yet. Import your own audio files.
          - list
          - group [ref=e165]:
            - generic "Import audio" [ref=e166] [cursor=pointer]
        - generic [ref=e167]: "Scene units: SI · +Y upGravity and the propagation medium are configured separately"
      - separator "Resize scene panel" [ref=e171]
      - region "3D scene" [ref=e173]:
        - generic [ref=e174]:
          - generic [ref=e175]:
            - generic [ref=e176]: VIEWPORT
            - strong [ref=e177]: Scene observation
          - generic [ref=e178]:
            - button "Frame selection" [ref=e179] [cursor=pointer]
            - button "Enter first person" [ref=e180] [cursor=pointer]
        - generic [ref=e181]:
          - generic "3D scene. Alt plus left mouse button to orbit, middle mouse button to pan, and wheel to zoom. The object list and numeric controls are also available." [ref=e184]
          - generic:
            - generic: Ready
            - generic: tick 0 · 0.00 s
            - generic: "Authoring edit: paused and cleared previous sounds."
          - generic:
            - generic: Acoustics pending
            - generic: Scene r0 · Acoustic r0
          - generic "Coordinate convention":
            - text: Y↑
            - generic: −Z forward
            - generic: SI · m
        - generic [ref=e185]:
          - generic [ref=e186]:
            - generic [ref=e187]: ● Listener / Direct
            - generic [ref=e188]: ◇ Reflection
            - generic [ref=e189]: Solver-provided paths · 0/0
          - generic [ref=e190]:
            - checkbox "Blocked candidates (not sent to audio)" [ref=e191]
            - text: Blocked candidates (not sent to audio)
      - separator "Resize inspector" [ref=e192]
      - complementary "Property inspector" [ref=e194]:
        - generic [ref=e195]:
          - heading "Inspector" [level=2] [ref=e196]
          - generic [ref=e197]: sphere
        - generic [ref=e203]:
          - heading "ball" [level=2] [ref=e204]
          - code [ref=e205]: ball
        - generic [ref=e206]:
          - button "Duplicate" [ref=e207] [cursor=pointer]
          - button "Delete" [ref=e211] [cursor=pointer]
        - generic [ref=e214]:
          - generic [ref=e215]:
            - heading "Transform" [level=3] [ref=e216]
            - generic [ref=e217]: Authored settings
          - group "Position m" [ref=e218]:
            - generic [ref=e219]:
              - text: Position
              - generic [ref=e220]: m
            - generic [ref=e221]:
              - generic [ref=e222]:
                - generic [ref=e223]: X
                - spinbutton "X" [ref=e224]: "-0.8"
              - generic [ref=e225]:
                - generic [ref=e226]: "Y"
                - spinbutton "Y" [ref=e227]: "2"
              - generic [ref=e228]:
                - generic [ref=e229]: Z
                - spinbutton "Z" [ref=e230]: "0"
          - group "Dimensions m" [ref=e231]:
            - generic [ref=e232]:
              - text: Dimensions
              - generic [ref=e233]: m
            - generic [ref=e234]:
              - generic [ref=e235]:
                - generic [ref=e236]: X
                - spinbutton "X" [ref=e237]: "0.5"
              - generic [ref=e238]:
                - generic [ref=e239]: "Y"
                - spinbutton "Y" [ref=e240]: "0.5"
              - generic [ref=e241]:
                - generic [ref=e242]: Z
                - spinbutton "Z" [ref=e243]: "0.5"
          - group "Rotation deg · XYZ" [ref=e244]:
            - generic [ref=e245]:
              - text: Rotation
              - generic [ref=e246]: deg · XYZ
            - generic [ref=e247]:
              - generic [ref=e248]:
                - generic [ref=e249]: Rotation X
                - spinbutton "Rotation X" [ref=e250]: "0"
              - generic [ref=e251]:
                - generic [ref=e252]: Rotation Y
                - spinbutton "Rotation Y" [ref=e253]: "0"
              - generic [ref=e254]:
                - generic [ref=e255]: Rotation Z
                - spinbutton "Rotation Z" [ref=e256]: "0"
          - group [ref=e257]:
            - generic "Details" [ref=e258] [cursor=pointer]
        - generic [ref=e259]:
          - heading "Rigid body physics" [level=3] [ref=e261]
          - generic [ref=e262]:
            - generic [ref=e263]: Body mode
            - combobox "Rigid body mode" [ref=e264]:
              - option "Dynamic · gravity enabled" [selected]
              - option "Dynamic · no gravity"
              - option "Fixed · immovable"
              - option "Kinematic · prescribed motion"
          - generic [ref=e265]:
            - generic [ref=e266]:
              - generic [ref=e267]:
                - text: Mass
                - generic [ref=e268]: kg
              - spinbutton "Mass kg" [ref=e269]: "1"
            - generic [ref=e270]:
              - generic [ref=e271]: Friction coefficient
              - spinbutton "Friction coefficient" [ref=e272]: "0.4"
          - generic [ref=e273]:
            - generic [ref=e274]: Restitution coefficient
            - spinbutton "Restitution coefficient" [ref=e275]: "0.55"
          - generic [ref=e276]:
            - generic [ref=e277]: Speed
            - code [ref=e278]: 0.000 m/s
          - group [ref=e279]:
            - generic "Details" [ref=e280] [cursor=pointer]
        - generic [ref=e281]:
          - generic [ref=e282]:
            - heading "Acoustic material" [level=3] [ref=e283]
            - generic [ref=e284]: Synthetic
          - generic [ref=e285]:
            - generic [ref=e286]: Surface material
            - combobox "Acoustic material" [ref=e287]:
              - option "Hard surface · Synthetic · Synthetic"
              - option "Absorptive surface · Synthetic · Synthetic"
              - option "Wood example · Synthetic · Synthetic"
              - option "Metal example · Synthetic · Synthetic" [selected]
          - generic [ref=e288]:
            - generic [ref=e289]: Acoustic role
            - combobox "Acoustic role" [ref=e290]:
              - option "Exclude from geometric acoustics"
              - option "Static reflecting surface"
              - option "Dynamic occluder" [selected]
              - option "Dynamic reflector (subject to backend support)"
        - generic [ref=e291]:
          - generic [ref=e292]:
            - heading "Sound behaviors" [level=3] [ref=e293]
            - generic [ref=e294]: 3 rules
          - paragraph [ref=e295]: Author sound content freely; every scene source still uses the shared acoustic propagation chain.
          - generic [ref=e296]:
            - generic [ref=e297]: Classification
            - combobox "Classification" [ref=e298]:
              - option "Creative · creative category" [selected]
              - option "Physical-inspired · material-inspired category"
              - option "Hybrid · hybrid category"
              - option "Procedural · procedural category"
          - group [ref=e299]:
            - generic "Details" [ref=e300] [cursor=pointer]
          - generic [ref=e301]:
            - article "Sound behavior rule.impact" [ref=e302]:
              - generic [ref=e303]:
                - generic [ref=e304]:
                  - checkbox "On impact" [checked] [ref=e305]
                  - strong [ref=e306]: On impact
                - button "Delete behavior rule.impact" [ref=e307] [cursor=pointer]
              - generic [ref=e310]:
                - code [ref=e311]: rule.impact
                - generic [ref=e312]: Waiting for trigger
              - button "Preview scene acoustics" [ref=e314] [cursor=pointer]
              - generic [ref=e317]:
                - generic [ref=e318]: Trigger
                - combobox "Trigger" [ref=e319]:
                  - option "Always on · AlwaysOn"
                  - option "While moving · WhileMoving"
                  - option "While airborne · WhileAirborne"
                  - option "While rolling · WhileRolling"
                  - option "While sliding · WhileSliding"
                  - option "While spinning · WhileSpinning"
                  - option "While held · WhileHeld"
                  - option "On grab · OnGrab"
                  - option "On release · OnRelease"
                  - option "On throw · OnThrow"
                  - option "On drop · OnDrop"
                  - option "On impact · OnImpact" [selected]
                  - option "On bounce · OnBounce (unsupported)" [disabled]
                  - option "On start moving · OnStartMoving"
                  - option "On stop moving · OnStopMoving"
                  - option "On enter zone · OnEnterZone (unsupported)" [disabled]
                  - option "On exit zone · OnExitZone (unsupported)" [disabled]
                  - option "On sleep · OnSleep"
                  - option "On wake · OnWake"
              - generic [ref=e320]:
                - generic [ref=e321]: Sound asset
                - combobox "Sound asset" [ref=e322]:
                  - option "Procedural sound · Oscillator" [selected]
              - generic [ref=e323]:
                - generic [ref=e324]:
                  - generic [ref=e325]:
                    - text: Volume
                    - generic [ref=e326]: linear
                  - spinbutton "Volume linear" [ref=e327]: "0.06309573444801933"
                - generic [ref=e328]:
                  - generic [ref=e329]:
                    - text: Pitch
                    - generic [ref=e330]: semitones
                  - spinbutton "Pitch semitones" [ref=e331]: "0"
              - generic [ref=e332]:
                - generic [ref=e333]:
                  - generic [ref=e334]:
                    - text: Cooldown
                    - generic [ref=e335]: s
                  - spinbutton "Cooldown s" [ref=e336]: "0.08"
                - paragraph [ref=e337]: Edit the control curve point by point below. This does not change the physics or propagation model.
              - region "Parameter mapping curve editor" [ref=e338]:
                - paragraph [ref=e339]: Authored control curves, not acoustic measurements. Point-table x/y values are normalized to 0–1; the first point has x=0, the last has x=1, and x must increase strictly. Each output can have one mapping.
                - article "Parameter mapping mapping.impact-gain" [ref=e340]:
                  - generic [ref=e341]:
                    - code [ref=e342]: mapping.impact-gain
                    - button "Remove mapping" [ref=e343] [cursor=pointer]
                  - generic [ref=e344]:
                    - generic [ref=e345]:
                      - generic [ref=e346]: Input metric · m/s
                      - combobox "Mapping input metric" [ref=e347]:
                        - option "Source speed · m/s"
                        - option "Angular speed · rad/s"
                        - option "Normal impulse · N·s"
                        - option "Closing speed · m/s" [selected]
                        - option "Tangent speed · m/s"
                        - option "Slip speed · m/s"
                        - option "Contact support force · N"
                    - generic [ref=e348]:
                      - generic [ref=e349]: Output parameter · linear
                      - combobox "Mapping output parameter" [ref=e350]:
                        - option "Gain · linear" [selected]
                        - option "Pitch · semitones"
                        - option "Filter cutoff frequency · Hz"
                  - generic [ref=e351]:
                    - generic [ref=e352]:
                      - generic [ref=e353]: Input minimum · m/s
                      - spinbutton "Mapping input minimum" [ref=e354]: "0"
                    - generic [ref=e355]:
                      - generic [ref=e356]: Input maximum · m/s
                      - spinbutton "Mapping input maximum" [ref=e357]: "10"
                  - generic [ref=e358]:
                    - generic [ref=e359]:
                      - generic [ref=e360]: Output minimum · linear
                      - spinbutton "Mapping output minimum" [ref=e361]: "0.025"
                    - generic [ref=e362]:
                      - generic [ref=e363]: Output maximum · linear
                      - spinbutton "Mapping output maximum" [ref=e364]: "0.25"
                  - generic [ref=e365]:
                    - generic [ref=e366]:
                      - generic [ref=e367]: Interpolation
                      - combobox "Mapping interpolation" [ref=e368]:
                        - option "Linear" [selected]
                        - option "Step"
                    - generic [ref=e369]:
                      - generic [ref=e370]: Parameter smoothing · s
                      - spinbutton "Mapping smoothing time in seconds" [ref=e371]: "0.015"
                  - paragraph [ref=e372]: Clamping is always enabled. Smoothing affects sound parameters; it does not change physics results or sound propagation time. Available metrics are validated for the trigger when applied; missing values are not treated as 0.
                  - img "Authored parameter mapping curve; not an acoustic measurement or sound path. Linear interpolation." [ref=e373]:
                    - 'generic "1: input 0 m/s → output 0.025 linear" [ref=e376]'
                    - 'generic "2: input 10 m/s → output 0.25 linear" [ref=e377]'
                  - paragraph [ref=e378]:
                    - status "Curve midpoint preview" [ref=e379]: 5 m/s → 0.1375 linear
                    - text: (Curve midpoint preview, before smoothing; not a simulation result)
                  - paragraph [ref=e380]: "Input: Closing speed 0–10 m/s; output: Gain 0.025–0.25 linear."
                  - table [ref=e381]:
                    - caption [ref=e382]: Curve control points · normalized x/y [0, 1]
                    - rowgroup [ref=e383]:
                      - row [ref=e384]:
                        - columnheader "Point" [ref=e385]
                        - columnheader "x" [ref=e386]
                        - columnheader "y" [ref=e387]
                        - columnheader "Actions" [ref=e388]
                    - rowgroup [ref=e389]:
                      - row [ref=e390]:
                        - rowheader "1" [ref=e391]
                        - cell [ref=e392]:
                          - spinbutton "Curve point 1 x" [ref=e393]: "0"
                        - cell [ref=e394]:
                          - spinbutton "Curve point 1 y" [ref=e395]: "0"
                        - cell [ref=e396]:
                          - button "Remove curve point 1" [disabled] [ref=e397]: Remove
                      - row [ref=e398]:
                        - rowheader "2" [ref=e399]
                        - cell [ref=e400]:
                          - spinbutton "Curve point 2 x" [ref=e401]: "1"
                        - cell [ref=e402]:
                          - spinbutton "Curve point 2 y" [ref=e403]: "1"
                        - cell [ref=e404]:
                          - button "Remove curve point 2" [disabled] [ref=e405]: Remove
                  - button "Add curve point" [ref=e406] [cursor=pointer]
                - button "Add parameter mapping" [ref=e407] [cursor=pointer]
                - paragraph [ref=e408]: 1/8 mappings; output parameters must be unique. All changes remain drafts until applied.
            - region "Object overrides for rule.impact" [ref=e409]:
              - group [ref=e410]:
                - generic "Object overrides Inherited" [ref=e411]:
                  - text: Object overrides
                  - generic [ref=e412]: Inherited
          - generic [ref=e413]:
            - article "Sound behavior rule.grab" [ref=e414]:
              - generic [ref=e415]:
                - generic [ref=e416]:
                  - checkbox "On grab" [checked] [ref=e417]
                  - strong [ref=e418]: On grab
                - button "Delete behavior rule.grab" [ref=e419] [cursor=pointer]
              - generic [ref=e422]:
                - code [ref=e423]: rule.grab
                - generic [ref=e424]: Waiting for trigger
              - button "Preview scene acoustics" [ref=e426] [cursor=pointer]
              - generic [ref=e429]:
                - generic [ref=e430]: Trigger
                - combobox "Trigger" [ref=e431]:
                  - option "Always on · AlwaysOn"
                  - option "While moving · WhileMoving"
                  - option "While airborne · WhileAirborne"
                  - option "While rolling · WhileRolling"
                  - option "While sliding · WhileSliding"
                  - option "While spinning · WhileSpinning"
                  - option "While held · WhileHeld"
                  - option "On grab · OnGrab" [selected]
                  - option "On release · OnRelease"
                  - option "On throw · OnThrow"
                  - option "On drop · OnDrop"
                  - option "On impact · OnImpact"
                  - option "On bounce · OnBounce (unsupported)" [disabled]
                  - option "On start moving · OnStartMoving"
                  - option "On stop moving · OnStopMoving"
                  - option "On enter zone · OnEnterZone (unsupported)" [disabled]
                  - option "On exit zone · OnExitZone (unsupported)" [disabled]
                  - option "On sleep · OnSleep"
                  - option "On wake · OnWake"
              - generic [ref=e432]:
                - generic [ref=e433]: Sound asset
                - combobox "Sound asset" [ref=e434]:
                  - option "Procedural sound · Oscillator" [selected]
              - generic [ref=e435]:
                - generic [ref=e436]:
                  - generic [ref=e437]:
                    - text: Volume
                    - generic [ref=e438]: linear
                  - spinbutton "Volume linear" [ref=e439]: "0.06309573444801933"
                - generic [ref=e440]:
                  - generic [ref=e441]:
                    - text: Pitch
                    - generic [ref=e442]: semitones
                  - spinbutton "Pitch semitones" [ref=e443]: "0"
              - generic [ref=e444]:
                - generic [ref=e445]:
                  - generic [ref=e446]:
                    - text: Cooldown
                    - generic [ref=e447]: s
                  - spinbutton "Cooldown s" [ref=e448]: "0.08"
                - paragraph [ref=e449]: Edit the control curve point by point below. This does not change the physics or propagation model.
              - region "Parameter mapping curve editor" [ref=e450]:
                - paragraph [ref=e451]: Authored control curves, not acoustic measurements. Point-table x/y values are normalized to 0–1; the first point has x=0, the last has x=1, and x must increase strictly. Each output can have one mapping.
                - button "Add parameter mapping" [ref=e452] [cursor=pointer]
                - paragraph [ref=e453]: 0/8 mappings; output parameters must be unique. All changes remain drafts until applied.
            - region "Object overrides for rule.grab" [ref=e454]:
              - group [ref=e455]:
                - generic "Object overrides Inherited" [ref=e456]:
                  - text: Object overrides
                  - generic [ref=e457]: Inherited
          - generic [ref=e458]:
            - article "Sound behavior rule.throw" [ref=e459]:
              - generic [ref=e460]:
                - generic [ref=e461]:
                  - checkbox "On throw" [checked] [ref=e462]
                  - strong [ref=e463]: On throw
                - button "Delete behavior rule.throw" [ref=e464] [cursor=pointer]
              - generic [ref=e467]:
                - code [ref=e468]: rule.throw
                - generic [ref=e469]: Waiting for trigger
              - button "Preview scene acoustics" [ref=e471] [cursor=pointer]
              - generic [ref=e474]:
                - generic [ref=e475]: Trigger
                - combobox "Trigger" [ref=e476]:
                  - option "Always on · AlwaysOn"
                  - option "While moving · WhileMoving"
                  - option "While airborne · WhileAirborne"
                  - option "While rolling · WhileRolling"
                  - option "While sliding · WhileSliding"
                  - option "While spinning · WhileSpinning"
                  - option "While held · WhileHeld"
                  - option "On grab · OnGrab"
                  - option "On release · OnRelease"
                  - option "On throw · OnThrow" [selected]
                  - option "On drop · OnDrop"
                  - option "On impact · OnImpact"
                  - option "On bounce · OnBounce (unsupported)" [disabled]
                  - option "On start moving · OnStartMoving"
                  - option "On stop moving · OnStopMoving"
                  - option "On enter zone · OnEnterZone (unsupported)" [disabled]
                  - option "On exit zone · OnExitZone (unsupported)" [disabled]
                  - option "On sleep · OnSleep"
                  - option "On wake · OnWake"
              - generic [ref=e477]:
                - generic [ref=e478]: Sound asset
                - combobox "Sound asset" [ref=e479]:
                  - option "Procedural sound · Oscillator" [selected]
              - generic [ref=e480]:
                - generic [ref=e481]:
                  - generic [ref=e482]:
                    - text: Volume
                    - generic [ref=e483]: linear
                  - spinbutton "Volume linear" [ref=e484]: "0.06309573444801933"
                - generic [ref=e485]:
                  - generic [ref=e486]:
                    - text: Pitch
                    - generic [ref=e487]: semitones
                  - spinbutton "Pitch semitones" [ref=e488]: "0"
              - generic [ref=e489]:
                - generic [ref=e490]:
                  - generic [ref=e491]:
                    - text: Cooldown
                    - generic [ref=e492]: s
                  - spinbutton "Cooldown s" [ref=e493]: "0.08"
                - paragraph [ref=e494]: Edit the control curve point by point below. This does not change the physics or propagation model.
              - region "Parameter mapping curve editor" [ref=e495]:
                - paragraph [ref=e496]: Authored control curves, not acoustic measurements. Point-table x/y values are normalized to 0–1; the first point has x=0, the last has x=1, and x must increase strictly. Each output can have one mapping.
                - button "Add parameter mapping" [ref=e497] [cursor=pointer]
                - paragraph [ref=e498]: 0/8 mappings; output parameters must be unique. All changes remain drafts until applied.
            - region "Object overrides for rule.throw" [ref=e499]:
              - group [ref=e500]:
                - generic "Object overrides Inherited" [ref=e501]:
                  - text: Object overrides
                  - generic [ref=e502]: Inherited
          - generic [ref=e503]:
            - generic [ref=e504]: New behavior trigger
            - combobox "New behavior trigger" [ref=e505]:
              - option "Always on"
              - option "While moving"
              - option "While airborne"
              - option "While rolling"
              - option "While sliding"
              - option "While spinning"
              - option "While held"
              - option "On grab"
              - option "On release"
              - option "On throw"
              - option "On drop"
              - option "On impact" [selected]
              - option "On bounce (unsupported)" [disabled]
              - option "On start moving"
              - option "On stop moving"
              - option "On enter zone (unsupported)" [disabled]
              - option "On exit zone (unsupported)" [disabled]
              - option "On sleep"
              - option "On wake"
            - button "Add" [ref=e506] [cursor=pointer]
          - group [ref=e509]:
            - generic "Details" [ref=e510] [cursor=pointer]
    - region "Experiment and analysis panel" [ref=e511]:
      - generic [ref=e512]:
        - tablist "Experiment analysis" [ref=e513]:
          - tab "Events & recording 0" [ref=e514] [cursor=pointer]:
            - text: Events & recording
            - generic [ref=e515]: "0"
          - tab "Acoustic paths 0" [selected] [ref=e516] [cursor=pointer]:
            - text: Acoustic paths
            - generic [ref=e517]: "0"
          - tab "Experiment comparison" [ref=e518] [cursor=pointer]
          - tab "Meta experiment agent" [ref=e519] [cursor=pointer]
        - button "Collapse experiment panel" [expanded] [ref=e520] [cursor=pointer]: ⌄
      - tabpanel "Acoustic paths 0" [ref=e522]:
        - generic [ref=e523]:
          - generic [ref=e524]:
            - generic [ref=e525]: Waiting for solver
            - generic [ref=e526]: Custom Web Geometric Core · acoustic rev 0 / scene rev 0
          - generic [ref=e527]:
            - strong [ref=e528]: No paths to display yet
            - paragraph [ref=e529]: A valid source, Listener and solver results with individual paths are required. This panel does not generate illustrative rays or substitute measurements.
          - generic [ref=e530]:
            - generic [ref=e531]:
              - term [ref=e532]: Direct-path delay
              - definition [ref=e533]: — Not provided
              - paragraph [ref=e534]: There is no airborne propagation in a vacuum.
            - generic [ref=e535]:
              - term [ref=e536]: "Original technical detail: RT60"
              - definition [ref=e537]: — Not provided
              - paragraph [ref=e538]: No complete IR was generated, so no decay can be fitted.
  - contentinfo "Audio monitoring and backend status" [ref=e539]:
    - generic [ref=e540]:
      - button "Enable listening" [pressed] [ref=e541] [cursor=pointer]
      - generic [ref=e545]:
        - generic [ref=e546]: Monitor
        - slider "Monitor gain" [ref=e547]: "0.18"
        - status [ref=e548]: 18%
    - group "Monitor routing" [ref=e549]:
      - button "Simulated" [pressed] [ref=e550] [cursor=pointer]
      - button "Raw reference" [ref=e551] [cursor=pointer]
    - status [ref=e552]: Acoustic update pending
    - group [ref=e553]:
      - generic "Monitor details" [ref=e554] [cursor=pointer]
    - group [ref=e555]:
      - generic "Synthetic late reverb" [ref=e556] [cursor=pointer]
```

# Test source

```ts
  79  | test("actual solver paths link table and canvas by stable ID and disclose units provenance and unavailable metrics", async ({
  80  |   page,
  81  | }, info) => {
  82  |   await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
  83  |   await expect.poll(async () => (await snapshot(page)).paths.length).toBeGreaterThan(1);
  84  |   const before = await snapshot(page);
  85  |   const path = before.paths.find((path) => path.kind === "reflection")!;
  86  |   expect(path).toBeTruthy();
  87  |   await page.locator(".path-table").getByRole("button", { name: path.id, exact: true }).click();
  88  |   await expect.poll(async () => (await snapshot(page)).selectedPathId).toBe(path.id);
  89  |   const detail = page.getByRole("complementary", { name: "Selected path details", exact: true });
  90  |   await expect(detail).toContainText(path.id);
  91  |   await expect(detail).toContainText(path.sourceId!);
  92  |   await expect(detail).toContainText("Numerical approximation");
  93  |   await expect(detail).toContainText("device latency");
  94  |   await expect(page.locator(".path-table")).toContainText("Distance m");
  95  |   await expect(page.locator(".path-table")).toContainText("Propagation delay ms");
  96  |   await expect(page.locator(".paths-panel .dock-toolbar")).toContainText(
  97  |     `acoustic rev ${before.acoustic.revision} / scene rev ${before.sceneRevision}`,
  98  |   );
  99  |   await expect(page.locator(".metric-card").filter({ hasText: "RT60" })).toContainText(
  100 |     "Not provided",
  101 |   );
  102 |   // Projection uses the documented actual default camera, measured canvas bounds and real solver vertices.
  103 |   // The click is delivered to the canvas through Playwright. No R3F/DOM/selection handler is invoked directly.
  104 |   const bounds = await page.locator("canvas").boundingBox();
  105 |   const camera = new PerspectiveCamera(50, bounds!.width / bounds!.height, 0.05, 250);
  106 |   camera.position.set(8, 6, 10);
  107 |   camera.lookAt(0, 1, 0);
  108 |   camera.updateMatrixWorld();
  109 |   const candidates = before.paths
  110 |     .flatMap((candidate) =>
  111 |       candidate.points.slice(1).flatMap((point, i) =>
  112 |         [0.35, 0.5, 0.65].map((fraction) => {
  113 |           const start = new Vector3(...candidate.points[i]!);
  114 |           const projected = start.lerp(new Vector3(...point), fraction).project(camera);
  115 |           return {
  116 |             id: candidate.id,
  117 |             x: bounds!.x + ((projected.x + 1) * bounds!.width) / 2,
  118 |             y: bounds!.y + ((1 - projected.y) * bounds!.height) / 2,
  119 |             z: projected.z,
  120 |           };
  121 |         }),
  122 |       ),
  123 |     )
  124 |     .filter(
  125 |       (point) =>
  126 |         point.id !== path.id &&
  127 |         point.z > -1 &&
  128 |         point.z < 1 &&
  129 |         point.x > bounds!.x + 30 &&
  130 |         point.x < bounds!.x + bounds!.width - 30 &&
  131 |         point.y > bounds!.y + 30 &&
  132 |         point.y < bounds!.y + bounds!.height - 30,
  133 |     );
  134 |   let picked: (typeof candidates)[number] | undefined;
  135 |   // Occlusion is allowed. A successful real hit must identify the exact line clicked; no fallback runtime command.
  136 |   for (const candidate of candidates.slice(0, 30)) {
  137 |     await page.locator(".path-table").getByRole("button", { name: path.id, exact: true }).click();
  138 |     await expect.poll(async () => (await snapshot(page)).selectedPathId).toBe(path.id);
  139 |     await page.mouse.click(candidate.x, candidate.y);
  140 |     const actual = (await snapshot(page)).selectedPathId;
  141 |     if (actual === candidate.id) {
  142 |       picked = candidate;
  143 |       break;
  144 |     }
  145 |   }
  146 |   expect(
  147 |     picked,
  148 |     "At least one visible real solver line must be selectable in the actual canvas",
  149 |   ).toBeTruthy();
  150 |   await expect(detail).toContainText(picked!.id);
  151 |   await expect(page.locator(".path-table tr.is-selected")).toContainText(picked!.id);
  152 |   const after = await snapshot(page);
  153 |   expect(after.paths).toEqual(before.paths);
  154 |   expect(after.listener).toEqual(before.listener);
  155 |   await attach(info, "actual-solver-table-canvas.json", {
  156 |     before,
  157 |     after,
  158 |     picked,
  159 |     attempted: candidates.slice(0, 30),
  160 |     scope:
  161 |       "Real numerical solver data and real mouse picking; no physics/acoustic accuracy or screenshot visual review claim",
  162 |   });
  163 |   await page.screenshot({ path: info.outputPath("path-linked.png") });
  164 | });
  165 | 
  166 | test("real unavailable propagation preserves path identity and null metrics with its actual reason", async ({
  167 |   page,
  168 | }, info) => {
  169 |   await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
  170 |   await expect.poll(async () => (await snapshot(page)).paths.length).toBeGreaterThan(0);
  171 |   const before = await snapshot(page);
  172 |   const selected = before.paths[0]!;
  173 |   await page.locator(".path-table").getByRole("button", { name: selected.id, exact: true }).click();
  174 |   // Genuine public atmosphere command runs the actual solver under its unsupported vacuum condition.
  175 |   await page.evaluate(() =>
  176 |     window.__reflectionLab!.dispatch({ type: "setAtmosphere", medium: "vacuum" }),
  177 |   );
  178 |   await expect(page.locator(".path-table")).toHaveCount(0);
> 179 |   expect((await snapshot(page)).acoustic.state).toBe("unavailable");
      |                                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  180 |   await expect(page.locator(".paths-panel")).toContainText(/vacuum/i);
  181 |   await expect(page.locator(".paths-panel")).not.toContainText("No paths to display yet");
  182 |   await expect(page.locator(".evidence-tag")).not.toContainText("Computed");
  183 |   await expect(
  184 |     page.getByRole("complementary", { name: "Selected path details", exact: true }),
  185 |   ).toHaveCount(0);
  186 |   const after = await snapshot(page);
  187 |   expect(after.paths).toEqual([]);
  188 |   expect(after.selectedPathId).toBe(selected.id);
  189 |   for (const metric of after.acoustic.metrics) expect(metric.value).toBeNull();
  190 |   const cards = page.locator(".paths-panel .metric-card");
  191 |   await expect(cards).toHaveCount(after.acoustic.metrics.length);
  192 |   for (let i = 0; i < after.acoustic.metrics.length; i++)
  193 |     await expect(cards.nth(i)).toContainText("Not provided");
  194 |   await attach(info, "actual-empty-vacuum-frame.json", {
  195 |     before,
  196 |     after,
  197 |     limits:
  198 |       "No stale-worker injection; missing pinned-path explanation and unavailable-vs-empty/capability distinction require Root adjudication. Numeric zero is not produced by this fixture.",
  199 |   });
  200 |   await page.screenshot({ path: info.outputPath("empty-vacuum.png") });
  201 | });
  202 | 
  203 | test("real event selection survives filtering and newest-first insertion without changing its stable ID", async ({
  204 |   page,
  205 | }, info) => {
  206 |   await page.getByRole("tab", { name: /^Events/ }).click();
  207 |   const setup = await page.evaluate(async () => {
  208 |     const app = window.__reflectionLab!;
  209 |     await app.dispatch({ type: "run" });
  210 |     for (let i = 0; i < 120; i++) app.advance(1 / 60);
  211 |     await app.dispatch({ type: "pause" });
  212 |     return app.getSnapshot();
  213 |   });
  214 |   const event = setup.events.find(
  215 |     (event) => event.type === "OnImpact" && event.decision?.action === "start",
  216 |   )!;
  217 |   expect(event).toBeTruthy();
  218 |   const filter = page.getByRole("searchbox", { name: "Filter events", exact: true });
  219 |   await filter.fill("OnImpact");
  220 |   const targetRow = page
  221 |     .locator(".event-table tbody tr")
  222 |     .filter({ hasText: event.ruleId! })
  223 |     .filter({ has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^${event.tick}$`) }) });
  224 |   await expect(targetRow).toHaveCount(1);
  225 |   await targetRow.getByRole("button", { name: event.type, exact: true }).click();
  226 |   const detail = page.getByRole("complementary", { name: "Selected event details", exact: true });
  227 |   await expect(detail).toContainText(event.id);
  228 |   await expect(detail).toContainText(event.objectId!);
  229 |   await filter.fill("this-filter-matches-no-runtime-events");
  230 |   await expect(page.locator(".event-table tbody tr")).toHaveCount(0);
  231 |   // The zero-match view hides its detail panel; filtering must retain the exact runtime selection.
  232 |   expect((await snapshot(page)).selectedEventId).toBe(event.id);
  233 |   await filter.fill("");
  234 |   await expect(detail).toContainText(event.id);
  235 |   const appended = await page.evaluate(async () => {
  236 |     const app = window.__reflectionLab!;
  237 |     // The original ball has settled by now. A legal author command raises it for a second real drop,
  238 |     // yielding new Rapier contacts instead of assuming an idle settled body keeps emitting events.
  239 |     await app.dispatch({
  240 |       type: "patchObject",
  241 |       objectId: "ball",
  242 |       patch: { positionM: [-0.8, 4, 0] },
  243 |     });
  244 |     await app.dispatch({ type: "run" });
  245 |     for (let i = 0; i < 150; i++) app.advance(1 / 60);
  246 |     await app.dispatch({ type: "pause" });
  247 |     return app.getSnapshot();
  248 |   });
  249 |   expect(appended.events.length).toBeGreaterThan(setup.events.length);
  250 |   expect(appended.selectedEventId).toBe(event.id);
  251 |   const retained = appended.events.find((value) => value.id === event.id)!;
  252 |   expect(retained).toEqual(event);
  253 |   await expect(detail).toContainText(event.id);
  254 |   await expect(targetRow).toHaveClass("is-selected");
  255 |   await expect(targetRow.getByRole("button")).toHaveAttribute("aria-current", "true");
  256 |   await attach(info, "actual-event-newest-first-identity.json", {
  257 |     setup,
  258 |     event,
  259 |     appended,
  260 |     limits:
  261 |       "Exercises actual newest-first event ordering and filtering. No arbitrary user sorting control exists, and canvas marker visual inspection is separate.",
  262 |   });
  263 |   await page.screenshot({ path: info.outputPath("event-linked.png") });
  264 | });
  265 | 
  266 | test("actual rule authoring adds legal trigger edits gain pitch and classification with atomic version Apply and Undo", async ({
  267 |   page,
  268 | }, info) => {
  269 |   await objectButton(page, "ball").click();
  270 |   const read = async () =>
  271 |     page.evaluate(() => {
  272 |       const app = window.__reflectionLab!;
  273 |       return {
  274 |         view: app.getSnapshot(),
  275 |         document: app.getBehaviorDocument(),
  276 |         scene: app.getSceneDocument(),
  277 |       };
  278 |     });
  279 |   const before = await read();
```