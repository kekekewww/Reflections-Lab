import type { AudioDiagnosticsSnapshot } from "../audio/diagnostics.js";
import { memoView } from "./view-stability.js";
import { HelpTip } from "./HelpTip.js";
import { Badge } from "./components.js";
import {
  formatDiagnosticValue,
  presentAudioDiagnostics,
} from "./audio-diagnostics-presentation.js";
import { useLocale } from "./locale.js";

const text = {
  "zh-TW": {
    title: "音訊效能觀測",
    scope: "控制執行緒觀測",
    scopeHelp:
      "這些是 JavaScript 控制更新與瀏覽器輸出計數，不是 DSP callback CPU、PCM 連續性、實體聽測或聲壓校準。p95 只描述最近保留的最多 128 筆樣本。",
    empty: "啟用聆聽後顯示觀測資料。",
    enable: "啟用成本觀測",
    retainedOnly: "觀測已停用；顯示保留資料",
    late: "延後起音／起音總數",
    lateHelp: "超過原訂起音時間 1 ms 的次數；不含聲學傳播延遲與裝置輸出延遲。",
    frames: "接受／拒絕的音訊影格",
    frameHelp: "音訊引擎消費影格的分類；求解器送達統計另列，兩者計數單位不同。",
    frameP95: "影格消費 p95",
    routeP95: "路由控制 p95",
    listenerP95: "Listener 控制 p95",
    nativeEvents: "本視窗輸出中斷",
    nativeDuration: "本視窗中斷時間",
    nativeLatency: "裝置輸出延遲",
    nativeWindow: "觀測視窗",
    nativeTitle: "瀏覽器原生輸出",
    nativeHelp:
      "原生計數只比較同一 AudioContext 內相鄰觀測。瀏覽器未提供、首次取樣或計數重置時不以零代替。",
    NOT_OBSERVED: "尚無原生輸出觀測",
    UNSUPPORTED: "瀏覽器未提供輸出計數",
    WARMUP: "等待下一筆原生計數",
    AVAILABLE: "原生計數可用",
    COUNTER_RESET: "原生計數已重置，等待新視窗",
    details: "更新成本與分項計數",
    metric: "觀測項目",
    value: "數值",
    onsetP95: "起音延後 p95",
    deliveryCount: "求解器送達批次",
    deliveryP95: "送達處理 p95",
    deliveryMissing: "未接入送達觀測",
    shapeBuilds: "IR 頻率形狀建立",
    shapeReuses: "IR 頻率形狀重用",
    scalarUpdates: "純量增益更新／略過",
    delayUpdates: "延遲更新／略過",
    directionUpdates: "方向更新／略過",
    retained: "保留樣本",
    context: "AudioContext 世代",
  },
  en: {
    title: "Audio performance observations",
    scope: "Control-thread observations",
    scopeHelp:
      "These are JavaScript control updates and browser output counters, not DSP callback CPU, PCM continuity, device hearing or calibrated SPL. p95 describes only the most recent retained samples, up to 128.",
    empty: "Enable listening to show observations.",
    enable: "Enable cost observations",
    retainedOnly: "Observations disabled; showing retained data",
    late: "Late onsets / total onsets",
    lateHelp:
      "Onsets more than 1 ms later than requested, excluding propagation and device output latency.",
    frames: "Accepted / rejected audio frames",
    frameHelp:
      "Audio-engine frame consumers. Solver delivery is listed separately and uses different counting units.",
    frameP95: "Frame-consumer p95",
    routeP95: "Route-control p95",
    listenerP95: "Listener-control p95",
    nativeEvents: "Output underruns in window",
    nativeDuration: "Underrun duration in window",
    nativeLatency: "Device output latency",
    nativeWindow: "Observation window",
    nativeTitle: "Native browser output",
    nativeHelp:
      "Native counters compare adjacent observations in one AudioContext. Missing support, the first sample or a counter reset is not reported as zero.",
    NOT_OBSERVED: "No native output observation",
    UNSUPPORTED: "Browser output counters unavailable",
    WARMUP: "Waiting for the next native sample",
    AVAILABLE: "Native counters available",
    COUNTER_RESET: "Native counters reset; waiting for a new window",
    details: "Update costs and counters",
    metric: "Observation",
    value: "Value",
    onsetP95: "Onset-lateness p95",
    deliveryCount: "Solver-delivery batches",
    deliveryP95: "Delivery-processing p95",
    deliveryMissing: "Delivery observation not connected",
    shapeBuilds: "IR frequency-shape builds",
    shapeReuses: "IR frequency-shape reuses",
    scalarUpdates: "Scalar-gain updates / skips",
    delayUpdates: "Delay updates / skips",
    directionUpdates: "Direction updates / skips",
    retained: "Retained samples",
    context: "AudioContext generation",
  },
} as const;

function PerformancePanelView({
  diagnostics,
  onEnabledChange,
}: {
  diagnostics: AudioDiagnosticsSnapshot | null;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = text[locale];
  const view = presentAudioDiagnostics(diagnostics);
  const number = (value: number | null | undefined, digits = 2) =>
    formatDiagnosticValue(value, locale, digits);
  const milliseconds = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : `${number(value)} ms`;
  const pair = (left: number | null | undefined, right: number | null | undefined) =>
    `${number(left, 0)} / ${number(right, 0)}`;
  const rows = [
    [copy.onsetP95, milliseconds(view.onsetLatenessP95Ms)],
    [copy.listenerP95, milliseconds(view.listenerControlP95Ms)],
    [copy.deliveryCount, number(view.deliveryBatches, 0)],
    [copy.deliveryP95, milliseconds(view.deliveryP95Ms)],
    [copy.shapeBuilds, number(view.shapeBuilds, 0)],
    [copy.shapeReuses, number(view.shapeReuses, 0)],
    [
      copy.scalarUpdates,
      pair(
        diagnostics?.controlOperations.scalarGainUpdates,
        diagnostics?.controlOperations.scalarGainSkips,
      ),
    ],
    [
      copy.delayUpdates,
      pair(diagnostics?.controlOperations.delayUpdates, diagnostics?.controlOperations.delaySkips),
    ],
    [
      copy.directionUpdates,
      pair(
        diagnostics?.controlOperations.directionUpdates,
        diagnostics?.controlOperations.directionSkips,
      ),
    ],
    [
      copy.retained,
      diagnostics
        ? pair(diagnostics.timings.frameConsumer.retained, diagnostics.sampleCapacity)
        : "—",
    ],
    [copy.context, diagnostics ? number(diagnostics.nativeOutput.contextGeneration, 0) : "—"],
  ];
  return (
    <section className="dock-panel pipeline-panel pipeline-diagnostics" aria-label={copy.title}>
      <div className="panel-heading">
        <h3>{copy.title}</h3>
        <HelpTip topic={copy.scope} content={copy.scopeHelp}>
          <span tabIndex={0}>
            <Badge>{copy.scope}</Badge>
          </span>
        </HelpTip>
      </div>
      {!view.observed && <p className="field-help">{copy.empty}</p>}
      {onEnabledChange && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={view.enabled ?? false}
            disabled={!view.observed}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          {copy.enable}
        </label>
      )}
      {view.enabled === false && (
        <p className="field-help" role="status">
          {copy.retainedOnly}
        </p>
      )}
      <dl className="pipeline-diagnostics-grid">
        <div className="pipeline-diagnostic-card">
          <dt>
            {copy.late} <HelpTip topic={copy.late} content={copy.lateHelp} />
          </dt>
          <dd>{pair(view.lateOnsets, view.onsetCount)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>
            {copy.frames} <HelpTip topic={copy.frames} content={copy.frameHelp} />
          </dt>
          <dd>{pair(view.acceptedFrames, view.rejectedFrames)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>{copy.frameP95}</dt>
          <dd>{milliseconds(view.frameConsumerP95Ms)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>{copy.routeP95}</dt>
          <dd>{milliseconds(view.routeControlP95Ms)}</dd>
        </div>
      </dl>
      <div className="panel-heading">
        <h4>{copy.nativeTitle}</h4>
        <HelpTip topic={copy.nativeTitle} content={copy.nativeHelp} />
        <Badge kind={view.nativeStatus === "AVAILABLE" ? "success" : "neutral"}>
          {copy[view.nativeStatus]}
        </Badge>
      </div>
      <dl className="pipeline-diagnostics-grid">
        <div className="pipeline-diagnostic-card">
          <dt>{copy.nativeEvents}</dt>
          <dd>{number(view.nativeUnderrunEvents, 0)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>{copy.nativeDuration}</dt>
          <dd>{milliseconds(view.nativeUnderrunMs)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>{copy.nativeWindow}</dt>
          <dd>{milliseconds(view.nativeWindowMs)}</dd>
        </div>
        <div className="pipeline-diagnostic-card">
          <dt>{copy.nativeLatency}</dt>
          <dd>{milliseconds(view.nativeOutputLatencyMs)}</dd>
        </div>
      </dl>
      <details className="pipeline-evidence">
        <summary>{copy.details}</summary>
        {diagnostics?.delivery.status === "NOT_OBSERVED" && (
          <p className="field-help">{copy.deliveryMissing}</p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{copy.metric}</th>
              <th scope="col">{copy.value}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export const PerformancePanel = memoView(PerformancePanelView);
