import { useEffect, useId, useRef, useState } from "react";
import type { LabController, LabViewModel } from "./contracts.js";
import type {
  LiveMonitorAudio,
  LiveMonitorInput,
  LiveMonitorLoad,
  LiveMonitorMode,
  LiveMonitorPorts,
} from "./live-monitor-contracts.js";
import { useLocale } from "./locale.js";
import { canonicalTokens } from "./tokens.js";
import { startTopMonitorLoop } from "./top-monitor-loop.js";
import {
  digitalLevelRatio,
  displayDbfs,
  displayMilliseconds,
  spectrumRange,
  waveformWindowMs,
  waveformDisplayGain,
  writeLogSpectrum,
  writeWaveformEnvelope,
} from "./top-monitor-model.js";

const MODES: readonly LiveMonitorMode[] = ["levels", "spectrum", "waveform", "load"];
const COPY = {
  "zh-TW": {
    output: "模擬輸出",
    scope: "處理耗時",
    region: "即時監測",
    views: "監測檢視",
    channel: "監測聲道",
    modes: { levels: "音量", spectrum: "頻譜", waveform: "波形", load: "負載" },
    enable: "啟用聆聽後顯示實際訊號",
    unavailable: "此環境未提供即時音訊監測",
    paused: "監聽已暫停",
    warmup: "正在準備音訊監測…",
    error: "監測暫不可用；切換檢視可重試",
    muted: "靜音",
    sourceLimit: "聲源最多 6 軌",
    unmeasured: "未量測",
    warming: "準備中",
    voices: "聲源",
    render: "畫面間隔",
    physics: "物理步進",
    acoustic: "最近求解",
    audio: "音訊控制",
    help: {
      levels:
        "數位取樣峰值與 RMS，單位 dBFS，並非聲壓 SPL。Master L/R 位於 limiter 與靜音之後；聲源最多六軌，位於傳播之前。虛擬及待排程聲源沒有原生電平讀值。試聽使用獨立輸出，不計入此監測。",
      spectrum:
        "所選 Master 聲道的原生 Blackman FFT。頻率採對數 Hz 軸，各欄保留頻帶峰值 dBFS，並非整段 RMS。",
      waveform:
        "所選 Master 聲道的實際時域取樣。橫軸為窗口時間 ms，縱軸為數位振幅，圖上明列顯示倍率與真實軸界；每像素保留最小與最大值。",
      load: "單位 ms。畫面間隔是相鄰 RAF 的間隔；物理步進與音訊控制在主執行緒量測，物理步進包含包裝與快照處理；最近求解在聲學 Worker 量測。這些數值不是整機或原生 DSP CPU 使用率。",
    },
  },
  en: {
    output: "Simulation output",
    scope: "Processing timings",
    region: "Live monitoring",
    views: "Monitoring view",
    channel: "Monitor channel",
    modes: { levels: "Levels", spectrum: "Spectrum", waveform: "Waveform", load: "Load" },
    enable: "Enable listening to view the actual signal",
    unavailable: "Live audio monitoring is unavailable",
    paused: "Listening is paused",
    warmup: "Preparing audio monitoring…",
    error: "Monitoring unavailable; select a view to retry",
    muted: "Muted",
    sourceLimit: "Up to 6 source tracks",
    unmeasured: "Unmeasured",
    warming: "Warming",
    voices: "Voices",
    render: "Frame interval",
    physics: "Physics step",
    acoustic: "Last solver",
    audio: "Audio control",
    help: {
      levels:
        "Digital sample peak and RMS in dBFS, not sound pressure SPL. Master L/R are after the limiter and mute; up to six source tracks are before propagation. Virtual and pending voices have no native level observation. Independent preview and audition outputs are not included.",
      spectrum:
        "Native Blackman FFT of the selected Master channel. The horizontal axis is logarithmic Hz; each column retains the band peak in dBFS, not whole-window RMS.",
      waveform:
        "Actual time-domain samples from the selected Master channel. Time window in ms, digital amplitude, with display gain and true axis bounds labeled; each pixel preserves minimum and maximum samples.",
      load: "Measured timings in ms. Frame interval is the time between adjacent RAF callbacks. Physics step and audio control are measured on the main thread; physics includes its wrapper and snapshot processing. Last solver is the latest acoustic Worker computation. These are not whole-system or native DSP CPU percentages.",
    },
  },
} as const;

/** Imperative, bounded visualization; switching views never dispatches a scene or transport command. */
export function TopMonitor({
  controller,
  model,
}: {
  controller: LabController & LiveMonitorPorts;
  model: LabViewModel;
}) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [mode, setMode] = useState<LiveMonitorMode>("levels");
  const [input, setInput] = useState<LiveMonitorInput>("master-left");
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const message = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const summary = useRef<HTMLSpanElement>(null);
  const latestModel = useRef(model);
  latestModel.current = model;
  const descriptionId = useId();
  const helpId = useId();

  useEffect(() => {
    const element = root.current,
      surface = canvas.current;
    if (!element || !surface) return;
    type PaintedState = LiveMonitorAudio["state"] | "warming";
    const clearPainted = () => {
      delete surface.dataset.monitorPaintedMode;
      delete surface.dataset.monitorPaintedInput;
      delete surface.dataset.monitorPaintedState;
    };
    const publishPainted = (state: PaintedState) => {
      if (surface.dataset.monitorPaintedMode !== mode) surface.dataset.monitorPaintedMode = mode;
      if (surface.dataset.monitorPaintedInput !== input)
        surface.dataset.monitorPaintedInput = input;
      if (surface.dataset.monitorPaintedState !== state)
        surface.dataset.monitorPaintedState = state;
    };
    clearPainted();
    const context = surface.getContext("2d");
    if (!context) {
      if (message.current) message.current.textContent = copy.unavailable;
      controller.releaseLiveMonitor?.();
      return;
    }
    const style = getComputedStyle(element);
    const color = {
      text:
        style.getPropertyValue("--color-text-primary").trim() ||
        canonicalTokens.color.textPrimary.$value,
      muted:
        style.getPropertyValue("--color-text-muted").trim() ||
        canonicalTokens.color.textMuted.$value,
      line:
        style.getPropertyValue("--color-border-subtle").trim() ||
        canonicalTokens.color.borderSubtle.$value,
      accent:
        style.getPropertyValue("--color-accent").trim() || canonicalTokens.color.accent.$value,
      success:
        style.getPropertyValue("--color-success").trim() || canonicalTokens.color.success.$value,
      danger:
        style.getPropertyValue("--color-danger").trim() || canonicalTokens.color.danger.$value,
    };
    const font = `${canonicalTokens.typography.secondary.$value} ${canonicalTokens.typography.mono.$value}`;
    const smallFont = `${canonicalTokens.typography.secondary.$value} ${canonicalTokens.typography.sans.$value}`;
    const minimum = new Float32Array(1024),
      maximum = new Float32Array(1024),
      spectrum = new Float32Array(1024);
    const values = new Float64Array(4),
      history = new Float64Array(128 * 4);
    history.fill(NaN);
    const loadLabels = [copy.render, copy.physics, copy.acoustic, copy.audio];
    let width = 1,
      height = 48,
      visible = false,
      historyCount = 0,
      historyHead = 0,
      lastSummary = -Infinity;
    let loop: ReturnType<typeof startTopMonitorLoop> | null = null;
    const setText = (target: HTMLElement | null, text: string) => {
      if (target && target.textContent !== text) target.textContent = text;
    };
    const setMessage = (text: string) => {
      setText(message.current, text);
      if (message.current) message.current.hidden = text.length === 0;
    };
    const measure = () => {
      const rect = surface.getBoundingClientRect();
      visible = rect.width > 0 && rect.height > 0;
      width = Math.max(1, Math.min(1024, Math.round(rect.width)));
      height = Math.max(1, Math.round(rect.height));
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (
        surface.width !== Math.round(width * ratio) ||
        surface.height !== Math.round(height * ratio)
      ) {
        clearPainted();
        surface.width = Math.round(width * ratio);
        surface.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      if (!visible || document.hidden) clearPainted();
      loop?.setVisible(visible && !document.hidden);
    };
    const clear = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.font = font;
      context.textBaseline = "alphabetic";
    };
    const muted = () => {
      context.fillStyle = color.muted;
      context.strokeStyle = color.line;
    };
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const drawLevels = (audio: LiveMonitorAudio) => {
      const count = Math.min(8, audio.tracks.length);
      if (!count) {
        setMessage(copy.warmup);
        return false;
      }
      const cell = width / count,
        base = height - 16,
        top = 14,
        span = Math.max(1, base - top);
      let measured = false;
      for (let index = 0; index < count; index++) {
        const track = audio.tracks[index]!,
          x = index * cell + 4,
          barWidth = Math.max(2, cell - 8);
        const rms = digitalLevelRatio(track.rmsDbfs),
          peak = digitalLevelRatio(track.peakDbfs);
        if (rms !== null || peak !== null) measured = true;
        context.fillStyle = color.line;
        context.fillRect(x, top, barWidth, span);
        if (rms !== null) {
          context.fillStyle =
            track.peakDbfs !== null && track.peakDbfs > 0
              ? color.danger
              : track.kind === "output"
                ? color.success
                : color.accent;
          context.fillRect(x, base - rms * span, barWidth, rms * span);
        }
        if (peak !== null) {
          context.strokeStyle = color.text;
          const y = base - peak * span;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + barWidth, y);
          context.stroke();
        }
        context.fillStyle = color.text;
        context.font = font;
        context.fillText(displayDbfs(track.peakDbfs), x, 11, barWidth);
        const label =
          track.id === "@master/L"
            ? "OUT L"
            : track.id === "@master/R"
              ? "OUT R"
              : track.label.slice(0, Math.max(3, Math.floor(barWidth / 7)));
        context.fillStyle = color.muted;
        context.font = smallFont;
        context.fillText(label, x, height - 2, barWidth);
      }
      if (!measured) setMessage(copy.warmup);
      return measured;
    };
    const drawWaveform = (audio: LiveMonitorAudio) => {
      const samples = audio.waveform,
        duration = samples && waveformWindowMs(samples.length, audio.sampleRateHz);
      const columns = Math.max(1, Math.floor(width - 16));
      if (
        !samples ||
        duration === null ||
        !writeWaveformEnvelope(samples, minimum, maximum, columns)
      ) {
        setMessage(copy.unavailable);
        return false;
      }
      const gain = waveformDisplayGain(samples) ?? 1;
      const top = 3,
        bottom = height - 15,
        middle = (top + bottom) / 2,
        amplitude = (bottom - top) / 2;
      muted();
      context.beginPath();
      context.moveTo(8, middle);
      context.lineTo(width - 8, middle);
      context.stroke();
      for (let index = 0; index < columns; index++) {
        const low = minimum[index]!,
          high = maximum[index]!;
        context.strokeStyle = low < -1 || high > 1 ? color.danger : color.accent;
        context.beginPath();
        context.moveTo(8 + index + 0.5, middle - clamp(high * gain) * amplitude);
        context.lineTo(8 + index + 0.5, middle - clamp(low * gain) * amplitude + 0.25);
        context.stroke();
      }
      context.fillStyle = color.muted;
      context.font = font;
      context.fillText("0 ms", 8, height - 1);
      const end = `${duration.toFixed(1)} ms`;
      context.fillText(end, Math.max(8, width - context.measureText(end).width - 8), height - 1);
      const axis = `±${(1 / gain).toPrecision(2)} · ×${gain}`;
      context.fillText(axis, Math.max(8, width - context.measureText(axis).width - 8), 12);
      return true;
    };
    const drawSpectrum = (audio: LiveMonitorAudio) => {
      const bins = audio.spectrumDbfs,
        columns = Math.max(1, Math.floor(width - 16));
      const range = bins && spectrumRange(audio.sampleRateHz, audio.fftSize, bins.length);
      if (
        !bins ||
        !range ||
        !writeLogSpectrum(bins, audio.sampleRateHz, audio.fftSize, spectrum, columns)
      ) {
        setMessage(copy.unavailable);
        return false;
      }
      const top = 3,
        bottom = height - 15,
        span = Math.max(1, bottom - top);
      muted();
      context.beginPath();
      context.moveTo(8, bottom);
      context.lineTo(width - 8, bottom);
      context.moveTo(8, top + span / 2);
      context.lineTo(width - 8, top + span / 2);
      context.stroke();
      context.strokeStyle = color.accent;
      context.beginPath();
      let connected = false;
      let measured = false;
      for (let index = 0; index < columns; index++) {
        const dbfs = spectrum[index]!;
        if (Number.isNaN(dbfs)) {
          connected = false;
          continue;
        }
        measured = true;
        const y = bottom - Math.max(0, Math.min(1, (dbfs + 100) / 100)) * span;
        // Isolated native bins still draw a pixel; gaps must not erase narrow peaks.
        context.fillStyle = color.accent;
        context.fillRect(8 + index, y, 1, 1);
        if (connected) context.lineTo(8 + index, y);
        else context.moveTo(8 + index, y);
        connected = true;
      }
      context.stroke();
      context.fillStyle = color.muted;
      context.font = font;
      context.fillText(`${Math.round(range.minimumHz)} Hz`, 8, height - 1);
      const end = `${(range.maximumHz / 1000).toFixed(1)}k Hz`;
      context.fillText(end, Math.max(8, width - context.measureText(end).width - 8), height - 1);
      context.fillText("0 / −100 dBFS", Math.max(8, width / 2 - 48), height - 1);
      if (!measured) setMessage(copy.unavailable);
      return measured;
    };
    const drawLoad = (load: LiveMonitorLoad | null, frameInterval: number | null) => {
      values[0] = load?.frameIntervalMs ?? frameInterval ?? NaN;
      values[1] = load?.physicsMs ?? NaN;
      values[2] = load?.acousticMs ?? NaN;
      values[3] = load?.audioControlMs ?? NaN;
      let measured = false;
      for (let index = 0; index < 4; index++) {
        const value = values[index]!;
        if (Number.isFinite(value) && value >= 0) measured = true;
        history[historyHead * 4 + index] = value;
      }
      historyHead = (historyHead + 1) % 128;
      historyCount = Math.min(128, historyCount + 1);
      const cell = width / 4;
      for (let index = 0; index < 4; index++) {
        const x = index * cell + 4,
          value = values[index]!,
          plotWidth = Math.max(1, cell - 8);
        context.fillStyle = color.muted;
        context.font = smallFont;
        context.fillText(loadLabels[index]!, x, 12, plotWidth);
        context.fillStyle = color.text;
        context.font = font;
        context.fillText(`${displayMilliseconds(value)} ms`, x, 28, plotWidth);
        let maximumMs = 16.7;
        for (let point = 0; point < historyCount; point++) {
          const item = history[point * 4 + index]!;
          if (Number.isFinite(item)) maximumMs = Math.max(maximumMs, item);
        }
        context.strokeStyle = index === 0 ? color.success : color.accent;
        context.beginPath();
        let connected = false;
        for (let point = 0; point < historyCount; point++) {
          const offset = (historyHead - historyCount + point + 128) % 128,
            item = history[offset * 4 + index]!;
          if (!Number.isFinite(item) || item < 0) {
            connected = false;
            continue;
          }
          const px = x + (point / 127) * plotWidth,
            py = height - 2 - (item / maximumMs) * 12;
          if (connected) context.lineTo(px, py);
          else context.moveTo(px, py);
          connected = true;
        }
        context.stroke();
      }
      return measured;
    };
    measure();
    loop = startTopMonitorLoop({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (handle) => window.cancelAnimationFrame(handle),
      isVisible: () => visible && !document.hidden,
      release: () => {
        clearPainted();
        controller.releaseLiveMonitor?.();
      },
      onError: () => {
        clear();
        setMessage(copy.error);
        setText(readout.current, "—");
        setText(summary.current, copy.error);
        if (visible && !document.hidden) publishPainted("error");
        else clearPainted();
      },
      sample: (frameInterval) => {
        const frame = controller.readLiveMonitor?.(mode, input) ?? null;
        clear();
        setMessage("");
        const audio = frame?.audio;
        let paintedState: PaintedState;
        if (mode === "load")
          paintedState = drawLoad(frame?.load ?? null, frameInterval) ? "active" : "unavailable";
        else if (!audio || audio.state !== "active" || audio.reason === "ANALYSER_WARMUP") {
          paintedState =
            audio?.reason === "ANALYSER_WARMUP"
              ? "warming"
              : (audio?.state ??
                (latestModel.current.monitor.state === "blocked" ? "blocked" : "unavailable"));
          setMessage(
            paintedState === "warming"
              ? copy.warmup
              : paintedState === "paused"
                ? copy.paused
                : paintedState === "error"
                  ? copy.error
                  : paintedState === "blocked"
                    ? copy.enable
                    : copy.unavailable,
          );
        } else if (mode === "levels") paintedState = drawLevels(audio) ? "active" : "warming";
        else if (mode === "waveform") paintedState = drawWaveform(audio) ? "active" : "unavailable";
        else paintedState = drawSpectrum(audio) ? "active" : "unavailable";
        const now = performance.now();
        if (now - lastSummary >= 1000) {
          lastSummary = now;
          if (mode === "load") {
            setText(
              readout.current,
              `${copy.voices} ${frame?.load?.activeVoices ?? latestModel.current.monitor.activeVoices}/${frame?.load?.voiceLimit ?? latestModel.current.monitor.voiceLimit}`,
            );
            setText(
              summary.current,
              `${copy.render}: ${displayMilliseconds(values[0]!)} ms. ${copy.physics}: ${displayMilliseconds(values[1]!)} ms. ${copy.acoustic}: ${displayMilliseconds(values[2]!)} ms. ${copy.audio}: ${displayMilliseconds(values[3]!)} ms. ${copy.help.load}`,
            );
          } else {
            let peak: number | null = null,
              measured = 0;
            let text: string = copy.help[mode];
            if (audio) {
              for (let index = 0; index < Math.min(8, audio.tracks.length); index++) {
                const track = audio.tracks[index]!;
                if (track.id === (input === "master-left" ? "@master/L" : "@master/R"))
                  peak = track.peakDbfs;
                if (track.kind === "source" && track.rmsDbfs !== null) measured++;
                text += ` ${track.label.slice(0, 96)}: ${displayDbfs(track.peakDbfs)} dBFS peak, ${displayDbfs(track.rmsDbfs)} dBFS RMS.`;
              }
              const unmeasured =
                (audio.unmeasuredVirtualVoices ?? 0) +
                (audio.unmeasuredPendingVoices ?? 0) +
                (audio.unmeasuredNativeVoices ?? 0);
              text += ` ${copy.sourceLimit}; ${measured}.`;
              if (unmeasured) text += ` ${copy.unmeasured}: ${unmeasured}.`;
              if (audio.warmingSourceVoices)
                text += ` ${copy.warming}: ${audio.warmingSourceVoices}.`;
            }
            setText(
              readout.current,
              audio?.state === "active"
                ? latestModel.current.monitor.muted
                  ? `${copy.muted} · dBFS`
                  : `${input === "master-left" ? "L" : "R"} ${displayDbfs(peak)} dBFS`
                : "dBFS",
            );
            setText(summary.current, text);
          }
        }
        publishPainted(paintedState);
      },
    });
    const visibility = () => {
      if (document.hidden) clearPainted();
      loop?.setVisible(visible && !document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(surface);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      loop?.stop();
      clearPainted();
    };
  }, [controller, copy, input, mode, retry]);

  return (
    <section ref={root} className="top-monitor" aria-label={copy.region} data-monitor-mode={mode}>
      <div className="top-monitor-toolbar">
        <div className="top-monitor-views" role="group" aria-label={copy.views}>
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setRetry((current) => current + 1);
              }}
            >
              {copy.modes[value]}
            </button>
          ))}
        </div>
        {(mode === "spectrum" || mode === "waveform") && (
          <label className="top-monitor-channel">
            <span className="top-monitor-accessible">{copy.channel}</span>
            <select
              aria-label={copy.channel}
              value={input}
              onChange={(event) => setInput(event.target.value as LiveMonitorInput)}
            >
              <option value="master-left">L</option>
              <option value="master-right">R</option>
            </select>
          </label>
        )}
        <output
          ref={readout}
          className="top-monitor-readout"
          aria-live="off"
          title={copy.help[mode]}
        >
          {mode === "load" ? "ms" : "dBFS"}
        </output>
      </div>
      <div className="top-monitor-visual">
        <canvas
          ref={canvas}
          role="img"
          tabIndex={0}
          aria-label={`${copy.modes[mode]}${mode === "spectrum" || mode === "waveform" ? ` · Master ${input === "master-left" ? "L" : "R"}` : ""}`}
          aria-describedby={`${descriptionId} ${helpId}`}
        />
        <span ref={message} className="top-monitor-message">
          {mode === "load" ? "" : model.monitor.state === "blocked" ? copy.enable : copy.warmup}
        </span>
      </div>
      <div className="top-monitor-caption">
        <span title={mode === "load" ? copy.help.load : copy.help.levels}>
          {mode === "load" ? copy.scope : copy.output}
        </span>
        <span>
          {mode === "levels"
            ? copy.sourceLimit
            : mode === "load"
              ? "ms"
              : `Master ${input === "master-left" ? "L" : "R"}`}
        </span>
      </div>
      <span id={descriptionId} ref={summary} className="top-monitor-accessible">
        {copy.help[mode]}
      </span>
      <span id={helpId} className="top-monitor-accessible">
        {copy.help[mode]}
      </span>
    </section>
  );
}
