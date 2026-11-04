import test from "node:test";
import assert from "node:assert/strict";
import { formatMessage } from "./locale-model.js";

const HAN = /\p{Script=Han}/u;
// Exactly what the scene adapter and Motion workspace write into a preview.
const lines: [string, string][] = [
  ["新增 chair.row1-01：box／fixed", "Add chair.row1-01: box, fixed"],
  ["移動 ball 到 [2, 1.5, 0]", "Move ball to [2, 1.5, 0]"],
  ["調整 stage.01 尺寸為 5.8×0.3×3 m", "Resize stage.01 to 5.8×0.3×3 m"],
  ["移除 ball", "Remove ball"],
  [
    "移除 speaker；一併移除聲源 source.speaker",
    "Remove speaker, with its sound sources source.speaker",
  ],
  ["移除 ball；一併移除路徑 trajectory.ball", "Remove ball, with its paths trajectory.ball"],
  [
    "移除 ball；一併移除聲源 source.ball；一併移除路徑 trajectory.ball",
    "Remove ball, with its sound sources source.ball and paths trajectory.ball",
  ],
  ["變更 wall.back 的both材質為 material.soft", "Set wall.back material (both) to material.soft"],
  ["將 ball 設為 kinematic（速度歸零）", "Set ball to kinematic, with velocity zero"],
  [
    "設定 speaker 聲源 source.speaker：220 Hz sine／continuous；非量測振動聲",
    "Set sound source source.speaker on speaker: 220 Hz sine, continuous. This isn't measured vibration sound.",
  ],
  [
    "建立固定六面房間 14×9×24 m；material.wood",
    "Create a six-sided room, 14×9×24 m, material.wood",
  ],
  [
    "建立固定六面房間 14×9×24 m；material.wood；一併移除路徑 trajectory.ball",
    "Create a six-sided room, 14×9×24 m, material.wood, and remove the paths trajectory.ball",
  ],
  [
    "移動正式Listener；編輯camera保持獨立。",
    "Move the listener. The editor camera stays separate.",
  ],
  [
    "此操作變更房間表面 floor，會影響聲學與物理；套用前請檢查。",
    "This changes the room surface floor, which affects acoustics and physics. Check before applying.",
  ],
  [
    "ball 已有路徑，起點不再符合新位置；需要新的路徑才能播放。",
    "ball already has a path, and it no longer starts at the new position. It needs a new path before it can play.",
  ],
  ["Motion trajectory.ball: 33 samples / 8 s", "Path trajectory.ball: 33 points over 8 s"],
  [
    "Motion is authored only; starting it requires an explicit local run action.",
    "The path is saved but not playing. Press play in the Motion tab to run it.",
  ],
  [
    "Meta提出受限工具，尚待本地預覽與人員套用。",
    "Muse's proposal is ready below. Nothing changes until you apply it.",
  ],
  [
    "Meta未提出可驗證操作，場景未變更。",
    "Muse didn't propose any changes, so the scene is unchanged.",
  ],
  [
    "Muse正在規劃提案，通常需要10–60秒；場景尚未變更。",
    "Muse is working on a proposal. This usually takes 10–60 seconds, and nothing has changed yet.",
  ],
  [
    "PROPOSAL_TOO_LONG：Muse的提案過長而被截斷，沒有可用內容；請縮小要求或分次提出。",
    "Muse's proposal was too long and got cut off, so none of it can be used. Ask for less, or split it into steps. [PROPOSAL_TOO_LONG]",
  ],
];

for (const [raw, english] of lines)
  test(`preview line reads properly in English: ${raw.slice(0, 24)}`, () => {
    const result = formatMessage("en", raw);
    assert.equal(result, english);
    assert.doesNotMatch(result, HAN);
    assert.equal(formatMessage("zh-TW", raw), raw);
  });

test("the acoustic limit reads properly in English", () => {
  assert.equal(
    formatMessage(
      "en",
      "ACOUSTIC_BUDGET：這個提案會讓場景有 259 個聲學面，超過上限 256，聲音會因此停止；每個方塊算 6 面，球體與膠囊算 1 面。請減少物件。",
    ),
    "This proposal would give the scene 259 acoustic surfaces, over the limit of 256, and the sound would stop. Each box counts as 6 and each sphere or capsule as 1. Use fewer objects. [ACOUSTIC_BUDGET]",
  );
});

test("a rejected proposal keeps Muse's reason in the English message", () => {
  const result = formatMessage(
    "en",
    "PROPOSAL_REJECTED：Muse修正後仍未通過驗證：The limit is 32 calls per list.",
  );
  assert.equal(
    result,
    "Muse's corrected proposal still failed validation: Original technical detail: The limit is 32 calls per list. [PROPOSAL_REJECTED]",
  );
});
