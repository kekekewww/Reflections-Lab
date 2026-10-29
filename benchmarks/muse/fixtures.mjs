// Hand-authored trusted controls. These are not generated model responses.
export const fixtures = [
  {
    id: "typescript-component",
    category: "TypeScript component logic",
    objective: "實作具 disabled/loading 狀態、HTML escaping 的 TypeScript 按鈕字串元件。",
    constraints: ["輸出 aria-busy 與 disabled", "label 不可成為 HTML", "loading 時文字顯示處理中"],
    acceptance: ["正常狀態可操作", "loading 狀態鎖定", "特殊字元安全編碼"],
    reference_source: `export interface Props { label: string; loading?: boolean; disabled?: boolean; }
export function button(p: Props): string {
 const escape = (s: string) => s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]!));
 return '<button aria-busy="' + Boolean(p.loading) + '"' + (p.loading || p.disabled ? ' disabled' : '') + '>' + (p.loading ? '處理中' : escape(p.label)) + '</button>';
}`,
    broken_source: `export function button(p: {label: string}): string { return '<button>' + p.label + '</button>'; }`,
  },
  {
    id: "physics-impulse",
    category: "Physics interaction contract",
    objective: "依速度差與質量算有限 impulse，限制最大向量長度。單位 kg、m/s、N·s。",
    constraints: [
      "不改變輸入",
      "質量與上限必須有限且正",
      "拒絕非有限速度",
      "中間運算溢位須明確失敗",
    ],
    acceptance: ["質量乘速度差", "限制 impulse magnitude", "無效參數及數值溢位明確失敗"],
    reference_source: `export function impulse(v: [number, number, number], mass: number, max: number): number[] {
 if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(max) || max <= 0 || v.some(x => !Number.isFinite(x))) throw new Error('invalid input');
 const out = v.map(x => x * mass), length = Math.hypot(...out);
 if (!out.every(Number.isFinite) || !Number.isFinite(length)) throw new Error('numeric range exceeded');
 const scale = length > max ? max / length : 1;
 return out.map(x => x * scale);
}`,
    broken_source: `export function impulse(v: number[], mass: number, max: number): number[] { return v.map(x => x * mass); }`,
  },
  {
    id: "acoustic-floor-reflection",
    category: "Geometry / acoustic mathematics",
    objective: "用 y=0 平面 image source 解二維一階反射的交點、總長與傳播延遲。",
    constraints: [
      "SI m、s",
      "source/listener 必須在地板上方",
      "聲速必須有限正數",
      "不混入音訊播放延遲",
      "中間運算或結果溢位須明確失敗",
    ],
    acceptance: ["對稱垂直路徑解析值", "斜向 3-4-5 解析值", "無效幾何與數值溢位拒絕"],
    reference_source: `export function reflect(sx: number, sy: number, lx: number, ly: number, c: number): {x: number; length: number; delay: number} {
 if (![sx, sy, lx, ly, c].every(Number.isFinite) || sy <= 0 || ly <= 0 || c <= 0) throw new Error('invalid input');
 const x = sx + (lx - sx) * sy / (sy + ly), length = Math.hypot(lx - sx, sy + ly), delay = length / c;
 if (![x,length,delay].every(Number.isFinite)) throw new Error('numeric range exceeded');
 return {x, length, delay};
}`,
    broken_source: `export function reflect(sx: number, sy: number, lx: number, ly: number, c: number) { const length = Math.hypot(lx-sx,ly-sy); return {x:(sx+lx)/2,length,delay:length/c}; }`,
  },
  {
    id: "bugfix-smoothing",
    category: "Bug fix / regression",
    objective: "修正插值 alpha 超出 [0,1] 造成 overshoot；非有限輸入明確拒絕。",
    constraints: [
      "保留 [0,1] 內原行為",
      "alpha clamp",
      "拒絕 NaN/Infinity",
      "中間運算或結果溢位須明確失敗",
    ],
    acceptance: ["正常插值", "上下界 regression", "非有限輸入與數值溢位拒絕"],
    reference_source: `export function smooth(current: number, target: number, alpha: number): number {
 if (![current,target,alpha].every(Number.isFinite)) throw new Error('invalid input');
 const result = current + (target-current) * Math.max(0,Math.min(1,alpha));
 if (!Number.isFinite(result)) throw new Error('numeric range exceeded');
 return result;
}`,
    broken_source: `export function smooth(current: number, target: number, alpha: number): number { return current + (target-current)*alpha; }`,
  },
];
