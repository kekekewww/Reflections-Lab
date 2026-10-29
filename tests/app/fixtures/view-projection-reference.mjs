// Frozen full publication reference before authoring/event projection caches.
// Original src/app/runtime.ts SHA256: 2c68f35628cf86db713bfb1845fa48a4bd91503e3c17764b1a9423b1290f9b46
// TypeScript syntax erased only; all publication fields and notifications retained.
import { DEFAULT_MATERIALS } from "../../../src/app/defaults.js";
const clone = (value) => structuredClone(value);
export function originalPublish() {
  if (this.disposed) return;
  const interaction = this.interaction?.snapshot(),
    record = this.recorder?.getView();
  const first = this.solutions.values().next().value;
  const acousticFrames = this.replayFrame
    ? this.recordedAcousticFrames
    : [...this.solutions.values()].map((solution) => solution.frame);
  const firstFrame = acousticFrames[0];
  const audio = this.audio?.getTelemetry();
  const state = this.behavior.snapshot().state;
  const displayingReplay = Boolean(this.replayFrame || record?.recording.state === "replaying");
  const displayScene = displayingReplay
    ? (this.recorder.getArtifact()?.configuration.sceneSnapshot ?? this.scene)
    : this.scene;
  const recordedSnapshot = this.replayFrame?.behaviorSnapshot;
  const recordedInput =
    recordedSnapshot && typeof recordedSnapshot === "object" && "inputFrame" in recordedSnapshot
      ? recordedSnapshot.inputFrame
      : undefined;
  const recordedObjects =
    recordedInput &&
    typeof recordedInput === "object" &&
    "objects" in recordedInput &&
    Array.isArray(recordedInput.objects)
      ? recordedInput.objects
      : [];
  const objects = displayScene.objects.map((object) => {
    const pose = displayingReplay
      ? undefined
      : this.latest.poses.find((body) => body.objectId === object.id);
    const recordedPose = this.replayFrame?.poses.find((body) => body.objectId === object.id);
    const savedObject = recordedObjects.find(
      (body) =>
        body !== null &&
        typeof body === "object" &&
        "objectId" in body &&
        body.objectId === object.id,
    );
    const savedState =
      savedObject?.states && typeof savedObject.states === "object"
        ? savedObject.states
        : undefined;
    return {
      ...clone(object),
      name:
        this.editorMetadata?.objectLabels.find((entry) => entry.objectId === object.id)?.label ??
        object.id,
      ...(recordedPose
        ? {
            positionM: [...recordedPose.positionM],
            orientationQuaternion: [...recordedPose.orientationQuaternion],
            ...(recordedPose.linearVelocityMps
              ? { velocityMps: [...recordedPose.linearVelocityMps] }
              : {}),
            ...(recordedPose.angularVelocityRadps
              ? { angularVelocityRadps: [...recordedPose.angularVelocityRadps] }
              : {}),
            ...(typeof recordedPose.sleeping === "boolean"
              ? { sleeping: recordedPose.sleeping }
              : typeof savedState?.sleeping === "boolean"
                ? { sleeping: savedState.sleeping }
                : {}),
            ...(typeof savedState?.held === "boolean" ? { held: savedState.held } : {}),
          }
        : {}),
      ...(pose
        ? {
            velocityMps: pose.linearVelocityMetresPerSecond,
            angularVelocityRadps: pose.angularVelocityRadiansPerSecond,
            held: pose.held,
            sleeping: pose.sleeping,
          }
        : {}),
    };
  });
  this.view = {
    projectId: this.project.projectId,
    ...(this.lastBehaviorEdit ? { lastBehaviorEdit: clone(this.lastBehaviorEdit) } : {}),
    projectName: this.project.name,
    sceneRevision: displayScene.sceneRevision,
    workspace: this.workspace,
    simulationState:
      this.replayFrame || record?.recording.state === "replaying"
        ? this.replayPaused
          ? "paused"
          : "running"
        : this.world.paused
          ? this.latest.tick === 0
            ? "ready"
            : "paused"
          : "running",
    interactionMode: interaction?.mode ?? "editor",
    alternativeInput: interaction?.alternativeInput ?? false,
    tick: this.replayFrame?.tick ?? this.latest.tick,
    simTimeSeconds: this.replayFrame
      ? this.replayFrame.tick / 60
      : this.latest.simulationTimeSeconds,
    runId: this.runId,
    objects,
    listener: this.replayFrame
      ? {
          ...this.scene.listener,
          ...clone(this.replayFrame.listener),
          positionM: [...this.replayFrame.listener.positionM],
          orientationQuaternion: [...this.replayFrame.listener.orientationQuaternion],
          attachment: "independent",
        }
      : this.listener(),
    selectedObjectId: this.selected || null,
    selectedPathId: this.selectedPath,
    selectedEventId: this.selectedEvent,
    preview: this.staticPreview.getView(),
    paths: acousticFrames.flatMap((frame) =>
      frame.paths.map((path) => ({
        id: path.id,
        kind: path.order === 0 ? "direct" : "reflection",
        points: path.verticesM,
        distanceM: path.lengthM,
        delaySeconds: path.absoluteDelayS,
        gainLinear: path.bandGains[0] ?? 0,
        energyBands: path.bandGains.map((gain) => gain * gain),
        surfaceIds: path.surfaceIds,
        sourceId: path.sourceId,
        stale:
          frame.stale ||
          (this.replayFrame
            ? frame.poseTick !== this.replayFrame.tick
            : frame.sceneRevision !== this.scene.sceneRevision ||
              frame.poseTick !== this.latest.tick),
      })),
    ),
    events: clone(
      displayingReplay
        ? this.replayEvents
        : [...this.eventLog, ...this.nativeAdmissionDiagnostics.events()]
            .sort((left, right) => left.tick - right.tick)
            .slice(-512),
    ),
    assets: this.projectAssets
      .filter(
        (asset) =>
          asset.storage === "externalFile" || asset.generator?.algorithm.startsWith("builtin-"),
      )
      .map((asset) => {
        const decoded = this.assets.find(
          (value) =>
            value.assetId === asset.assetId &&
            value.revision === asset.revision &&
            value.sha256 === asset.sha256,
        );
        return {
          id: asset.assetId,
          name: asset.name,
          provenance: `${asset.storage} · ${asset.rights.license}`,
          ...(decoded?.durationSeconds === undefined
            ? {}
            : { durationSeconds: decoded.durationSeconds }),
          status:
            decoded?.availability === "READY" && decoded.rightsStatus === "APPROVED"
              ? "ready"
              : "pending",
        };
      }),
    behaviors: this.document.bindings.map((binding) => {
      const profile = this.document.profiles.find((value) => value.profileId === binding.profileId);
      return {
        objectId: binding.objectId,
        bindingId: binding.bindingId,
        bindingEnabled: binding.enabled,
        documentRevision: this.document.revision,
        profileId: profile.profileId,
        revision: profile.revision,
        presetKind: profile.presetKind,
        rules: profile.rules.map((rule) => ({
          id: rule.ruleId,
          trigger: rule.trigger.type,
          enabled:
            binding.enabled &&
            (binding.overrides.find((override) => override.ruleId === rule.ruleId)?.enabled ??
              rule.enabled),
          ...(rule.generator.kind === "sample" ? { assetId: rule.generator.asset.assetId } : {}),
          generator: rule.generator.kind,
          gainLinear:
            binding.overrides.find((override) => override.ruleId === rule.ruleId)?.gainLinear ??
            rule.gainLinear,
          pitchSemitones:
            binding.overrides.find((override) => override.ruleId === rule.ruleId)?.pitchSemitones ??
            rule.pitchSemitones,
          cooldownSeconds: rule.cooldownSeconds,
          priority: rule.priority,
          mappings: clone(rule.mappings),
          baseValues: {
            enabled: rule.enabled,
            gainLinear: rule.gainLinear,
            pitchSemitones: rule.pitchSemitones,
          },
          bindingOverride: clone(
            binding.overrides.find((value) => value.ruleId === rule.ruleId) ?? null,
          ),
          mapping:
            rule.mappings[0]?.input === "sourceSpeedMetresPerSecond"
              ? "speed"
              : rule.mappings.length
                ? "impact"
                : "none",
          active:
            state.bindings
              .find((value) => value.bindingId === binding.bindingId)
              ?.activeRuleIds.includes(rule.ruleId) ?? false,
          ...(!displayingReplay
            ? this.nativeAdmissionDiagnostics.ruleView(binding.bindingId, rule.ruleId)
            : {}),
          ...(!displayingReplay
            ? this.behaviorDiagnostics.ruleView(
                binding.bindingId,
                rule.ruleId,
                !binding.enabled
                  ? "BINDING_DISABLED"
                  : !(
                        binding.overrides.find((override) => override.ruleId === rule.ruleId)
                          ?.enabled ?? rule.enabled
                      )
                    ? "RULE_DISABLED"
                    : undefined,
              )
            : {}),
        })),
      };
    }),
    monitor: {
      lateReverb: { ...this.reverbSettings },
      state: !audio ? "blocked" : audio.lastError ? "error" : audio.muted ? "muted" : "audible",
      muted: audio?.muted ?? true,
      gainLinear: audio?.monitorGain ?? 0.18,
      mode: audio?.monitorMode ?? "simulated",
      activeVoices: audio?.activeVoices ?? 0,
      voiceLimit: audio?.budget.maxVoices ?? 16,
    },
    recording: record?.recording ?? {
      state: "idle",
      eventCount: 0,
      durationSeconds: 0,
      canReplay: false,
    },
    ai: {
      ...(this.agent?.getView() ?? {
        mode: "offline",
        status: "idle",
        message: "離線工具模式；沒有Meta模型呼叫。",
        canApply: false,
      }),
      selectedProvider: this.agentProvider,
      providerStatus: clone(this.providerStatus),
    },
    comparison: record?.comparison ?? {
      hasA: false,
      hasB: false,
      status: "先錄製同一物理軌跡",
      metrics: [],
    },
    acoustic: {
      backend: "Custom Web Geometric Core",
      model: "Numerical approximation · 一階有限面／零相位幅度",
      revision: firstFrame?.sceneRevision ?? null,
      state: this.acoustics.busy
        ? "pending"
        : acousticFrames.some(
              (frame) =>
                frame.stale ||
                frame.poseTick !== (this.replayFrame?.tick ?? this.latest.tick) ||
                (!this.replayFrame && frame.sceneRevision !== this.scene.sceneRevision),
            )
          ? "stale"
          : firstFrame
            ? "ready"
            : "unsupported",
      ...(this.atmosphere.medium === "air" &&
      (first?.diagnostics.speedOfSoundMps ?? this.atmosphere.speedOfSoundMps) !== undefined
        ? {
            speedOfSoundMps: first?.diagnostics.speedOfSoundMps ?? this.atmosphere.speedOfSoundMps,
          }
        : {}),
      ...(this.atmosphere.temperatureC !== undefined
        ? { temperatureC: this.atmosphere.temperatureC }
        : {}),
      medium: this.atmosphere.medium,
      metrics: [
        {
          label: "直達延遲",
          value: firstFrame?.directDelayS ?? null,
          unit: "s",
          reason: this.atmosphere.medium === "vacuum" ? "真空沒有空氣傳播" : "幾何距離/c",
        },
        { label: "RT60", value: null, unit: "s", reason: "未產生完整IR，無可擬合衰減" },
      ],
    },
    materialOptions: DEFAULT_MATERIALS.map((material) => ({
      id: material.id,
      label: material.label,
      dataClass: material.dataClass,
    })),
    pauseReason: this.pauseReason,
    notice: this.notice,
    error: this.error,
    canUndo: this.undoStack.length > 0,
    canRedo: this.redoStack.length > 0,
    ...(interaction?.ghost
      ? {
          placementGhost: {
            ...clone(interaction.ghost.draft),
            valid: interaction.ghost.valid,
            reason: interaction.ghost.reason,
            stage: "preview",
          },
        }
      : interaction?.staged
        ? {
            placementGhost: {
              ...clone(
                this.scene.objects.find((object) => object.id === interaction.staged.objectId),
              ),
              valid: interaction.staged.geometryAcknowledged,
              reason: "Staged；確認後才啟用物理",
              stage: "staged",
            },
          }
        : {}),
  };
  for (const listener of this.subscribers) listener();
}
