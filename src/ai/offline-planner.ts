import { AgentError } from "./types.js";
import type {
  AgentPlan,
  PlannerContext,
  PlannerProvenance,
  ToolName,
  ToolRequest,
} from "./types.js";
import { assertBoundedJson, validateToolRequest } from "./validation.js";

const OFFLINE: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};
function fingerprint(text: string): string {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value.toString(16);
}
export class OfflinePlanner {
  readonly provenance = structuredClone(OFFLINE);
  private sequence = 0;
  plan(prompt: string, context: PlannerContext): AgentPlan {
    assertBoundedJson(context, 256 * 1024);
    if (typeof prompt !== "string" || prompt.trim().length < 1 || prompt.length > 4000)
      throw new AgentError("INPUT_LIMIT", "請輸入1–4000字的指令。");
    if (!context.materials.length) throw new AgentError("UNKNOWN_ID", "材質registry尚未提供。");
    const id = `plan.${context.scene.sceneRevision}-${fingerprint(prompt)}-${++this.sequence}`;
    const transactionId = `${id}.transaction`;
    const requests: ToolRequest[] = [];
    const assumptions = [
      "此為本機確定性指令示範，不是Meta模型輸出。",
      "未指定尺寸／位置使用可在預覽修改的系統預設。",
    ];
    const warnings: string[] = [];
    if (/shell|terminal|repository|執行程式|系統指令|金鑰|api.?key|提高預算|忽略規則/i.test(prompt))
      return {
        planId: id,
        requests: [],
        assumptions,
        warnings: ["這項要求超出場景／實驗工具權限；不會執行OS、程式或變更權限。"],
        summary: "要求超出允許工具範圍，場景未變更。",
        provenance: structuredClone(OFFLINE),
      };
    const materialMatch = context.materials.find(
      (material) =>
        prompt.toLowerCase().includes(material.id.toLowerCase()) || prompt.includes(material.label),
    );
    const preferred = context.materials.find((material) =>
      /metal|金屬/.test(material.id + material.label),
    );
    const material = materialMatch ?? preferred ?? context.materials[0]!;
    if (!materialMatch)
      assumptions.push(`材質使用現有registry：${material.label}（${material.id}）。`);
    const request = (tool: ToolName, args: Record<string, unknown>, mutation = true): void => {
      requests.push(
        validateToolRequest({
          schemaVersion: "1.0.0",
          requestId: `${id}.request-${requests.length + 1}`,
          tool,
          sceneId: context.scene.sceneId,
          expectedSceneRevision: context.scene.sceneRevision,
          transactionId: mutation ? transactionId : null,
          arguments: args,
        }),
      );
    };
    const noGravity = /無重力|沒有重力|no\s*gravity|zero\s*gravity/i.test(prompt);
    const fixed = /固定|fixed/i.test(prompt);
    const wantsObject = /建立|新增|加入|create|add/i.test(prompt);
    const selected = context.scene.objects.find((object) => object.id === context.selectedObjectId);
    const requestedSignal = context.signals.find(
      (signal) =>
        prompt.toLowerCase().includes(signal.id.toLowerCase()) || prompt.includes(signal.label),
    );
    const signal = requestedSignal ?? context.signals[0];
    if (wantsObject) {
      const chinese: Record<string, number> = {
        一: 1,
        兩: 2,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
      };
      const countMatch = prompt.match(
        /([1-9]\d?|[一兩二三四五六七八九十])\s*(?:顆|個|球|balls?|objects?)/i,
      );
      const count = countMatch ? Number(countMatch[1]) || chinese[countMatch[1]!] || 1 : 1;
      if (count > 8)
        throw new AgentError("POLICY_DENIED", "離線示範每次最多建立8個物件，請分批預覽。");
      const shape = /方塊|箱|牆|box|wall/i.test(prompt)
        ? "box"
        : /膠囊|capsule/i.test(prompt)
          ? "capsule"
          : "sphere";
      const dims =
        shape === "box" ? [1, 1, 1] : shape === "capsule" ? [0.5, 1, 0.5] : [0.5, 0.5, 0.5];
      for (let index = 0; index < count; index++) {
        const objectId = `${id}.object-${index + 1}`;
        request("AddObject", {
          objectId,
          label: `離線提案物件 ${index + 1}`,
          shape,
          dimensionsM: dims,
          positionM: [(index - (count - 1) / 2) * 1.2, 2, 0],
          orientationQuaternion: [0, 0, 0, 1],
          materialId: material.id,
          mode: noGravity ? "dynamicNoGravity" : fixed ? "fixed" : "dynamicGravity",
          massKg: 1,
        });
        if (/發聲|聲音|音效|sound|tone|sine/i.test(prompt) && signal)
          request("ConfigureSoundSource", {
            sourceId: `${id}.source-${index + 1}`,
            objectId,
            signalId: signal.id,
            mode: /撞擊|碰撞|impact/i.test(prompt) ? "impact" : "continuous",
            gainDbfs: -18,
            referenceFrequencyHz: signal.frequencyHz ?? 440,
          });
      }
    } else if (selected && (noGravity || fixed || /重力|dynamic/i.test(prompt))) {
      request("SetRigidBodyMode", {
        objectId: selected.id,
        mode: noGravity ? "dynamicNoGravity" : fixed ? "fixed" : "dynamicGravity",
        velocityPolicy: "zero",
      });
    } else if (selected && materialMatch) {
      request("SetMaterial", {
        objectId: selected.id,
        materialId: materialMatch.id,
        materialRegistryRevision: context.materialRegistryRevision,
        scope: "acoustic",
      });
    } else if (selected && /發聲|聲音|音效|sound|tone|sine/i.test(prompt) && signal) {
      request("ConfigureSoundSource", {
        sourceId: `${id}.source-1`,
        objectId: selected.id,
        signalId: signal.id,
        mode: /撞擊|碰撞|impact/i.test(prompt) ? "impact" : "continuous",
        gainDbfs: -18,
        referenceFrequencyHz: signal.frequencyHz ?? 440,
      });
    } else if (/實驗|執行|模擬|run|simulate/i.test(prompt)) {
      request(
        "RunSimulation",
        {
          backendId: "custom-web",
          durationS: 3,
          timeStepS: 1 / 60,
          seed: context.scene.seed,
          replayTraceId: null,
          maxReflectionOrder: 1,
          sampleRateHz: 48000,
        },
        false,
      );
    } else {
      warnings.push(
        "離線指令示範尚未辨識這項要求；請使用Inspector，或輸入「新增一顆無重力發聲球」。",
      );
    }
    if (/投擲|抓取|滾動|throw|grab|rolling/i.test(prompt))
      warnings.push(
        "離線解析器只提出明示的物件／聲源設定；互動trigger需在Sound Behavior Inspector確認，不把速度當Throw。",
      );
    if (/鋼琴|piano|音檔|錄音/i.test(prompt) && !requestedSignal)
      warnings.push("Registry沒有精確匹配的音檔；不會捏造或下載。可用聲源明示為系統示範訊號。");
    if (!signal && /發聲|聲音|音效|sound/i.test(prompt))
      warnings.push("尚無授權訊號，提案只建立物件，不假裝已設定音效。");
    return {
      planId: id,
      requests,
      assumptions,
      warnings,
      summary: requests.length
        ? `本機離線提案：${requests.length}個受限操作，等待預覽與套用。`
        : "尚未產生可套用操作。",
      provenance: structuredClone(OFFLINE),
    };
  }
}
