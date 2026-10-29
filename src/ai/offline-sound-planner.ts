import type {
  BehaviorBinding,
  SoundBehaviorOperation,
  SoundBehaviorProfile,
  SoundBehaviorProposal,
  SoundBehaviorRule,
  SoundGenerator,
  SoundTrigger,
} from "../../schemas/sound-behavior/types.js";
import { AgentError } from "./types.js";
import type { PlannerProvenance } from "./types.js";
import type { SoundHostState } from "./sound-host.js";
import { assertBoundedJson } from "./validation.js";

export interface OfflineSoundPlannerOptions {
  selectedObjectId?: string;
  assetLabels?: Record<string, string>;
}
export interface OfflineSoundPlan {
  proposal: SoundBehaviorProposal;
  assumptions: string[];
  warnings: string[];
  summary: string;
  provenance: PlannerProvenance;
}
const OFFLINE: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};
function key(text: string): string {
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16);
}
/** Deliberately small local intent parser, never labelled as a Meta model response. */
export class OfflineSoundPlanner {
  readonly provenance = structuredClone(OFFLINE);
  private sequence = 0;
  plan(
    prompt: string,
    state: SoundHostState,
    options: OfflineSoundPlannerOptions = {},
  ): OfflineSoundPlan {
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000)
      throw new AgentError("INPUT_LIMIT", "聲音要求必須為1–4000字。");
    if (
      /shell|powershell|\bcmd(?:\.exe)?\b|repository|\brepo\b|檔案系統|(?:讀取|刪除|修改|寫入).{0,12}(?:檔案|目錄)|(?:提高|增加|修改).{0,8}(?:預算|額度)|(?:change|raise|increase).{0,8}(?:budget|quota)|忽略.{0,8}(?:規則|政策|指令)|ignore.{0,20}(?:rules|instructions|policy)|https?:\/\/|javascript|eval\s*\(|process\./i.test(
        prompt,
      )
    )
      throw new AgentError("POLICY_DENIED", "聲音提案沒有OS、repository、帳務或政策修改權限。");
    if (!/聲|音|sound|audio|tone|oscillator|sine|piano|synth|behavior|profile/i.test(prompt))
      throw new AgentError(
        "CAPABILITY_UNSUPPORTED",
        "離線解析器未辨識聲音行為要求；請使用Inspector設定。",
      );
    assertBoundedJson(state, 1024 * 1024);
    if (
      options.selectedObjectId &&
      !state.context.objects.some((item) => item.objectId === options.selectedObjectId)
    )
      throw new AgentError("UNKNOWN_OBJECT", "所選物件已不存在，請重新選取。");
    const object =
      state.context.objects.find((item) => prompt.includes(item.objectId)) ??
      state.context.objects.find((item) => item.objectId === options.selectedObjectId) ??
      state.context.objects[0];
    if (!object)
      throw new AgentError("UNKNOWN_OBJECT", "請先建立並選取場景物件，再設定Sound Behavior。");
    const fingerprint = key(
      `${prompt}:${object.objectId}:${state.sceneRevision}:${state.document.revision}:${++this.sequence}`,
    );
    const proposalId = `sound.plan-${fingerprint}`;
    const warnings: string[] = [];
    const assumptions = [
      "本機確定性聲音提案，不是Meta模型輸出。",
      `目標物件：${object.objectId}，generation ${object.generation}。`,
      "音量與音高為創意設定；不代表量測聲壓或物件振動。",
    ];
    if (!options.selectedObjectId && !prompt.includes(object.objectId))
      assumptions.push("未指定物件，預覽選用現有registry的第一個物件；套用前請確認。");
    const latched =
      /投擲|throw/i.test(prompt) &&
      /(?:撞擊|碰撞|impact).{0,12}(?:停止|stop)|(?:停止|stop).{0,12}(?:撞擊|碰撞|impact)/i.test(
        prompt,
      );
    let trigger: SoundTrigger;
    if (latched) trigger = { kind: "discrete", type: "OnThrow" };
    else if (/滾動|rolling/i.test(prompt)) trigger = { kind: "continuous", type: "WhileRolling" };
    else if (/滑動|摩擦|sliding/i.test(prompt))
      trigger = { kind: "continuous", type: "WhileSliding" };
    else if (/飛行|airborne/i.test(prompt)) trigger = { kind: "continuous", type: "WhileAirborne" };
    else if (/抓取期間|抓著|held/i.test(prompt))
      trigger = { kind: "continuous", type: "WhileHeld" };
    else if (/抓取|抓起|grab/i.test(prompt)) trigger = { kind: "discrete", type: "OnGrab" };
    else if (/投擲|throw/i.test(prompt)) trigger = { kind: "discrete", type: "OnThrow" };
    else if (/彈跳|bounce/i.test(prompt)) trigger = { kind: "discrete", type: "OnBounce" };
    else if (/碰撞|撞擊|impact/i.test(prompt)) trigger = { kind: "discrete", type: "OnImpact" };
    else if (/旋轉|spinning/i.test(prompt)) trigger = { kind: "continuous", type: "WhileSpinning" };
    else if (/移動|moving/i.test(prompt)) trigger = { kind: "continuous", type: "WhileMoving" };
    else trigger = { kind: "continuous", type: "AlwaysOn" };
    const isContact = ["OnImpact", "OnBounce", "WhileRolling", "WhileSliding"].includes(
      trigger.type,
    );
    const looping = trigger.kind === "continuous" || latched;
    const wantsPiano = /鋼琴|piano/i.test(prompt);
    const asset = state.context.assetRegistry.find((item) => {
      if (
        item.availability !== "READY" ||
        item.rightsStatus !== "APPROVED" ||
        !item.durationSeconds ||
        item.durationSeconds <= 0
      )
        return false;
      const label = options.assetLabels?.[item.assetId] ?? "";
      return (
        prompt.includes(item.assetId) ||
        Boolean(label && prompt.toLowerCase().includes(label.toLowerCase())) ||
        (wantsPiano && /鋼琴|piano/i.test(label + item.assetId))
      );
    });
    let generator: SoundGenerator;
    if (asset)
      generator = {
        kind: "sample",
        asset: { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256 },
        loop: looping,
        startOffsetSeconds: 0,
      };
    else {
      generator = {
        kind: "oscillator",
        waveform: /電子|合成|electronic|synth/i.test(prompt) ? "triangle" : "sine",
        frequencyHz: wantsPiano ? 261.625565 : /低頻|低音|low/i.test(prompt) ? 110 : 440,
      };
      if (wantsPiano)
        warnings.push(
          "Registry沒有可用且權利已確認的鋼琴音檔；此預覽使用C4合成sine示範，並非鋼琴錄音。",
        );
      else warnings.push("此提案使用明示的基本合成器，不捏造錄音素材或真實材質振動。");
    }
    const existingBinding = state.document.bindings.find(
      (binding) => binding.objectId === object.objectId,
    );
    const existingProfile = existingBinding
      ? state.document.profiles.find((profile) => profile.profileId === existingBinding.profileId)
      : undefined;
    const profileId = existingProfile?.profileId ?? `sound.profile-${fingerprint}`;
    const existingRule = existingProfile?.rules.find((rule) => rule.trigger.type === trigger.type);
    const ruleId = existingRule?.ruleId ?? `sound.rule-${fingerprint}`;
    const rule: SoundBehaviorRule = {
      ruleId,
      enabled: !/停用|關閉|disable/i.test(prompt),
      trigger,
      conditions: [],
      generator,
      emitter: isContact
        ? { attachment: "contact", aggregation: "impulseWeighted" }
        : { attachment: "object", offsetMetres: [0, 0, 0] },
      gainLinear: /小聲|降低音量|quiet/i.test(prompt) ? 0.1 : 0.25,
      pitchSemitones: 0,
      fadeInSeconds: 0.01,
      fadeOutSeconds: 0.08,
      cooldownSeconds: trigger.kind === "discrete" ? 0.08 : 0,
      priority: isContact ? 70 : 50,
      voiceLimit: trigger.kind === "discrete" ? 4 : 1,
      layerGroup: "sound.layer-main",
      mappings: [],
    };
    if (latched)
      rule.lifecycle = {
        mode: "latched",
        stopOn: ["OnImpact"],
        retriggerPolicy: "restart",
        maxDurationSeconds: 10,
      };
    else if (trigger.kind === "discrete" && generator.kind === "oscillator")
      rule.oneShotDurationSeconds = 0.3;
    if (/依.{0,6}速度|速度.{0,6}音量|speed.{0,16}gain/i.test(prompt))
      rule.mappings.push({
        mappingId: `sound.mapping-${fingerprint}`,
        input:
          isContact && trigger.kind === "discrete"
            ? "closingSpeedMetresPerSecond"
            : "sourceSpeedMetresPerSecond",
        target: "gainLinear",
        inputMin: 0,
        inputMax: 10,
        outputMin: 0.05,
        outputMax: 0.5,
        curve: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: "linear",
        clamp: true,
        smoothingSeconds: 0.02,
      });
    const profile: SoundBehaviorProfile = existingProfile
      ? {
          ...structuredClone(existingProfile),
          revision: existingProfile.revision + 1,
          presetKind: "creative",
          rules: existingRule
            ? existingProfile.rules.map((item) =>
                item.ruleId === existingRule.ruleId ? rule : structuredClone(item),
              )
            : [...structuredClone(existingProfile.rules), rule],
        }
      : {
          profileId,
          revision: 1,
          name: wantsPiano ? "創意C4聲音（來源請見提案）" : "離線創意聲音設定",
          presetKind: "creative",
          rules: [rule],
          materialPairOverrides: [],
        };
    const operations: SoundBehaviorOperation[] = [];
    if (existingProfile) {
      operations.push({
        type: "ReplaceProfile",
        profileId,
        expectedProfileRevision: existingProfile.revision,
        profile,
      });
      const shared = state.document.bindings.filter((binding) => binding.profileId === profileId);
      for (const binding of shared) {
        operations.push({ type: "RemoveBinding", bindingId: binding.bindingId });
        operations.push({
          type: "AssignBinding",
          binding: { ...structuredClone(binding), profileRevision: profile.revision },
        });
      }
      if (shared.length > 1)
        warnings.push(
          `此Profile由${shared.length}個Binding共用；預覽會明示全部升版綁定，請確認影響。`,
        );
    } else {
      operations.push({ type: "CreateProfile", profile });
      const binding: BehaviorBinding = {
        bindingId: `sound.binding-${fingerprint}`,
        objectId: object.objectId,
        objectGeneration: object.generation,
        profileId,
        profileRevision: profile.revision,
        enabled: true,
        overrides: [],
      };
      operations.push({ type: "AssignBinding", binding });
    }
    if (operations.length > 32)
      throw new AgentError(
        "BUDGET_EXCEEDED",
        "共用Profile變更超過單包32操作，請在Inspector分批設定。",
      );
    const proposal: SoundBehaviorProposal = {
      schemaVersion: "1.0.0",
      proposalId,
      sceneId: state.sceneId,
      expectedSceneRevision: state.sceneRevision,
      expectedBehaviorRevision: state.document.revision,
      operations,
    };
    assumptions.push(
      `Trigger：${trigger.type}${latched ? "；OnImpact停止／最長10秒的有界latch" : ""}。`,
    );
    return {
      proposal,
      assumptions,
      warnings,
      summary: `本機Sound提案：${object.objectId} → ${trigger.type}；等待預覽與套用。`,
      provenance: structuredClone(OFFLINE),
    };
  }
}
