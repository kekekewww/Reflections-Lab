/** Control-graph recorder only. This does not emulate DSP or browser rendering. */
export interface Automation {
  method: string;
  value?: number;
  time: number;
  duration?: number;
}

export class FakeAudioParam {
  readonly automation: Automation[] = [];
  defaultValue: number;
  minValue = -Infinity;
  maxValue = Infinity;
  automationRate: AutomationRate = "a-rate";
  constructor(public value = 0) {
    this.defaultValue = value;
  }
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.automation.push({ method: "setValueAtTime", value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.automation.push({ method: "linearRampToValueAtTime", value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.automation.push({ method: "exponentialRampToValueAtTime", value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, duration: number) {
    this.value = value;
    this.automation.push({ method: "setTargetAtTime", value, time, duration });
    return this;
  }
  setValueCurveAtTime(values: Float32Array, time: number, duration: number) {
    this.value = values[values.length - 1] ?? 0;
    this.automation.push({ method: "setValueCurveAtTime", value: this.value, time, duration });
    return this;
  }
  cancelScheduledValues(time: number) {
    this.automation.push({ method: "cancelScheduledValues", time });
    return this;
  }
  cancelAndHoldAtTime(time: number) {
    this.automation.push({ method: "cancelAndHoldAtTime", time });
    return this;
  }
}

let nodeSequence = 0;
export class FakeNode {
  readonly id = ++nodeSequence;
  readonly connections: FakeNode[] = [];
  channelCount = 2;
  channelCountMode: ChannelCountMode = "max";
  channelInterpretation: ChannelInterpretation = "speakers";
  constructor(
    readonly kind: string,
    readonly context: FakeAudioContext,
  ) {}
  connect(destination: FakeNode) {
    this.connections.push(destination);
    return destination;
  }
  disconnect(destination?: FakeNode) {
    if (destination) {
      const index = this.connections.indexOf(destination);
      if (index >= 0) this.connections.splice(index, 1);
    } else this.connections.length = 0;
  }
  addEventListener() {}
  removeEventListener() {}
}

export class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam(1);
}
export class FakeDelayNode extends FakeNode {
  readonly delayTime = new FakeAudioParam(0);
}
export class FakeBiquadNode extends FakeNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new FakeAudioParam(350);
  readonly detune = new FakeAudioParam(0);
  readonly Q = new FakeAudioParam(1);
  readonly gain = new FakeAudioParam(0);
  getFrequencyResponse(frequencies: Float32Array, magnitude: Float32Array, phase: Float32Array) {
    magnitude.fill(1, 0, frequencies.length);
    phase.fill(0, 0, frequencies.length);
  }
}
export class FakePannerNode extends FakeNode {
  panningModel: PanningModelType = "equalpower";
  distanceModel: DistanceModelType = "inverse";
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  coneInnerAngle = 360;
  coneOuterAngle = 360;
  coneOuterGain = 0;
  readonly positionX = new FakeAudioParam();
  readonly positionY = new FakeAudioParam();
  readonly positionZ = new FakeAudioParam();
  readonly orientationX = new FakeAudioParam(1);
  readonly orientationY = new FakeAudioParam();
  readonly orientationZ = new FakeAudioParam();
  setPosition(x: number, y: number, z: number) {
    this.positionX.value = x;
    this.positionY.value = y;
    this.positionZ.value = z;
  }
  setOrientation(x: number, y: number, z: number) {
    this.orientationX.value = x;
    this.orientationY.value = y;
    this.orientationZ.value = z;
  }
}
export class FakeSourceNode extends FakeNode {
  buffer: FakeAudioBuffer | AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam(440);
  readonly detune = new FakeAudioParam(0);
  readonly playbackRate = new FakeAudioParam(1);
  readonly starts: { when: number; offset?: number; duration?: number }[] = [];
  readonly stops: number[] = [];
  onended: ((event: Event) => void) | null = null;
  start(when = 0, offset?: number, duration?: number) {
    if (this.starts.length) throw new Error("AudioScheduledSourceNode cannot be started twice");
    this.starts.push({
      when,
      ...(offset === undefined ? {} : { offset }),
      ...(duration === undefined ? {} : { duration }),
    });
  }
  stop(when = 0) {
    this.stops.push(when);
  }
  finish() {
    this.onended?.(new Event("ended"));
  }
  setPeriodicWave() {}
}
export class FakeConvolverNode extends FakeNode {
  buffer: AudioBuffer | null = null;
  normalize = true;
}
export class FakeCompressorNode extends FakeNode {
  readonly threshold = new FakeAudioParam(-24);
  readonly knee = new FakeAudioParam(30);
  readonly ratio = new FakeAudioParam(12);
  readonly attack = new FakeAudioParam(0.003);
  readonly release = new FakeAudioParam(0.25);
  reduction = 0;
}
export class FakeAnalyserNode extends FakeNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
  smoothingTimeConstant = 0.8;
  getFloatTimeDomainData(values: Float32Array) {
    values.fill(0);
  }
  getByteTimeDomainData(values: Uint8Array) {
    values.fill(128);
  }
}

export class FakeAudioBuffer {
  readonly channels: Float32Array[];
  readonly duration: number;
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    this.duration = length / sampleRate;
  }
  getChannelData(channel: number) {
    const value = this.channels[channel];
    if (!value) throw Error("Invalid channel");
    return value;
  }
  copyToChannel(values: Float32Array, channel: number, start = 0) {
    this.getChannelData(channel).set(values, start);
  }
  copyFromChannel(values: Float32Array, channel: number, start = 0) {
    values.set(this.getChannelData(channel).subarray(start, start + values.length));
  }
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: AudioContextState = "running";
  readonly baseLatency = 0.005;
  readonly outputLatency = 0.01;
  readonly nodes: FakeNode[] = [];
  readonly destination = this.record(new FakeNode("destination", this));
  readonly listener = {
    positionX: new FakeAudioParam(),
    positionY: new FakeAudioParam(),
    positionZ: new FakeAudioParam(),
    forwardX: new FakeAudioParam(),
    forwardY: new FakeAudioParam(),
    forwardZ: new FakeAudioParam(-1),
    upX: new FakeAudioParam(),
    upY: new FakeAudioParam(1),
    upZ: new FakeAudioParam(),
  };
  private record<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.record(new FakeGainNode("gain", this));
  }
  createDelay() {
    return this.record(new FakeDelayNode("delay", this));
  }
  createBiquadFilter() {
    return this.record(new FakeBiquadNode("biquad", this));
  }
  createPanner() {
    return this.record(new FakePannerNode("panner", this));
  }
  createBufferSource() {
    return this.record(new FakeSourceNode("buffer-source", this));
  }
  createOscillator() {
    return this.record(new FakeSourceNode("oscillator", this));
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    return { real, imag } as unknown as PeriodicWave;
  }
  createConvolver() {
    return this.record(new FakeConvolverNode("convolver", this));
  }
  createDynamicsCompressor() {
    return this.record(new FakeCompressorNode("compressor", this));
  }
  createAnalyser() {
    return this.record(new FakeAnalyserNode("analyser", this));
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new FakeAudioBuffer(channels, length, sampleRate);
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
  asContext(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
  sources() {
    return this.nodes.filter((node): node is FakeSourceNode => node instanceof FakeSourceNode);
  }
  panners() {
    return this.nodes.filter((node): node is FakePannerNode => node instanceof FakePannerNode);
  }
  delays() {
    return this.nodes.filter((node): node is FakeDelayNode => node instanceof FakeDelayNode);
  }
}

export function pathsToDestination(source: FakeNode, destination: FakeNode): FakeNode[][] {
  const paths: FakeNode[][] = [];
  const walk = (node: FakeNode, path: FakeNode[]) => {
    if (path.includes(node)) throw new Error("Cycle in recorded graph");
    const next = [...path, node];
    if (node === destination) {
      paths.push(next);
      return;
    }
    for (const connection of node.connections) walk(connection, next);
  };
  walk(source, []);
  return paths;
}
