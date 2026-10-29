// SYNTHETIC independent fixture literals. No production imports; never observed browser evidence.
const clone = (value) => structuredClone(value);
function bits(number) { const a = new ArrayBuffer(8), v = new DataView(a); v.setFloat64(0, number, false); return [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function binding(id, ordinal, requestHandle, rawRafMs, observedNowMs) {
  const row = { collectionId: id, ordinal, representedByOrdinal: ordinal, callbackOrdinal: ordinal,
    requestHandle, rawRafMs, observedNowMs, rawRafBits: bits(rawRafMs), observedNowBits: bits(observedNowMs) };
  row.markName = `rlab-v3.observe.${id}.${ordinal}.${requestHandle}.${row.rawRafBits}.${row.observedNowBits}`;
  return row;
}
export function baseV3Fixture() {
  const id = 'synthetic-v3-A', frames = [binding(id, 1, 41, 10, 11), binding(id, 2, 42, 20, 21)];
  const mark = (name, ts, callTime) => ({ name, ts, ph: 'I', cat: 'blink.user_timing', pid: 7, tid: 9,
    args: { data: { navigationId: 'navigation-A', callTime } } });
  const beginMarkName = `reflection-profile.begin.${id}`, endMarkName = `reflection-profile.end.${id}`;
  return { ui: { startedAtPerformanceMs: 0, sampleMilliseconds: 30, droppedSamples: 0,
    collectionWindow: { schemaVersion: '3.0.0', collectionId: id, beginMarkName, endMarkName,
      beginPerformanceMs: 0, endPerformanceMs: 30 },
    frame: frames.map((row) => ({ collectionId: id, timestamp: row.rawRafMs,
      callbackObservedAtPerformanceMs: row.observedNowMs, callbacks: 1 })),
    v3Proof: { method: 'native-raf-calltime-v3', schemaVersion: '3.0.0', collectionId: id,
      state: 'CLOSED', closed: true, markLifetime: 'RETAIN_THROUGH_TRACE_CLOSE', frames,
      callbacks: frames.map((row) => ({ ...row })), reasons: [],
      caps: { rawFrames: 90000, proofs: 90000, callbacks: 360000, pendingHandles: 8192,
        marks: 90000, markNameCharacters: 192, markNameBytes: 18874368 },
      counters: { callbacksObserved: 2, representativeFrames: 2, additionalCallbacks: 0,
        registrationsObserved: 2, cancellationsObserved: 0, precollectionRegistrations: 0,
        precollectionCancellations: 0, precollectionPendingAtBegin: 0,
        droppedProofs: 0, droppedCallbacks: 0, capHits: 0, samplesAfterClose: 0,
        emittedMarks: 2, markNameBytes: frames.reduce((n, f) => n + f.markName.length, 0), clearedMarks: 0, pendingAtClose: 0 } } },
    context: { traceDataLoss: false, traceStreamClosed: true,
      documentBefore: { id: 'document-A', loaderId: 'loader-A', url: 'http://synthetic.invalid/' },
      documentAfter: { id: 'document-A', loaderId: 'loader-A', url: 'http://synthetic.invalid/' } },
    events: [ { name: 'thread_name', ph: 'M', pid: 7, tid: 9, args: { name: 'CrRendererMain' } },
      mark(beginMarkName, 1000, 1007), mark(endMarkName, 31000, 31007),
      ...frames.map((row, i) => mark(row.markName, i ? 21000 : 11000, i ? 21000 : 11000)),
      ...frames.map((row, i) => ({ name: 'FireAnimationFrame', ph: 'X', cat: 'devtools.timeline',
        pid: 7, tid: 9, ts: i ? 20000 : 10000, dur: 1500, args: { data: { id: row.requestHandle, frame: 'document-A' } } })),
      ...[[-1000, 3000], [5000, 16000], [9000, 23000], [29000, 35000]].map(([ts, stop]) =>
        ({ name: 'RunTask', ph: 'X', cat: 'toplevel', pid: 7, tid: 9, ts, dur: stop - ts })) ] };
}
export function rebindV3Frame(data, index, rawRafMs, observedNowMs) {
  const proof = data.ui.v3Proof, prior = proof.frames[index];
  const next = binding(proof.collectionId, index + 1, prior.requestHandle, rawRafMs, observedNowMs);
  data.events.find((event) => event.name === prior.markName).name = next.markName;
  proof.frames[index] = next; proof.callbacks[index] = { ...next };
  data.ui.frame[index].timestamp = rawRafMs;
  data.ui.frame[index].callbackObservedAtPerformanceMs = observedNowMs;
  proof.counters.markNameBytes = proof.frames.reduce((n, frame) => n + frame.markName.length, 0);
}
export function negativeV3Cases() {
  const cases = [];
  const add = (name, mutate, expectedReason) => { const data = baseV3Fixture(); mutate(data); cases.push({ name, data, expectedReason }); };
  const task = (data) => data.events.find((event) => event.name === 'RunTask');
  const fire = (data) => data.events.find((event) => event.name === 'FireAnimationFrame');
  const mark = (data) => data.events.find((event) => event.name.startsWith('rlab-v3.observe.'));
  for (const [label, mutation] of [ ['wrong-category', (e) => { e.cat = 'v8'; }],
    ['malformed-category', (e) => { e.cat = null; }], ['unsupported-phase', (e) => { e.ph = 'B'; }],
    ['negative-duration', (e) => { e.dur = -1; }], ['nonfinite-ts', (e) => { e.ts = Infinity; }],
    ['missing-duration', (e) => { delete e.dur; }], ['overflow-end', (e) => { e.ts = 1e308; e.dur = 1e308; }],
    ['string-duration', (e) => { e.dur = '1'; }], ['null-duration', (e) => { e.dur = null; }] ])
    add(`valid-task-plus-${label}`, (d) => { const bad = clone(task(d)); mutation(bad); d.events.push(bad); }, 'RENDERER_TASK_SCHEMA_OR_CATEGORY');
  add('outside-window-malformed-task-not-hidden', (d) => { const bad = clone(task(d)); bad.ts = -1e12; bad.dur = -1; d.events.push(bad); }, 'RENDERER_TASK_SCHEMA_OR_CATEGORY');
  add('unknown-task-thread-not-excluded', (d) => { const bad = clone(task(d)); delete bad.tid; d.events.push(bad); }, 'UNKNOWN_TASK_IDENTITY');
  add('null-event', (d) => { d.events.push(null); }, 'EVENT_OBJECT_SCHEMA');
  add('event-name-null', (d) => { d.events.push({ name: null }); }, 'EVENT_NAME_SCHEMA_OR_CAP');
  add('event-name-cap', (d) => { d.events.push({ name: 'x'.repeat(513) }); }, 'EVENT_NAME_SCHEMA_OR_CAP');
  add('unknown-method', (d) => { d.ui.v3Proof.schemaVersion = '2.0.0'; }, 'METHOD_SCHEMA');
  add('null-proof', (d) => { d.ui.v3Proof = null; }, 'METHOD_SCHEMA');
  add('raw-array-type', (d) => { d.ui.frame = {}; }, 'RAW_ARRAY_OR_COUNTER_SCHEMA');
  add('null-raw-row', (d) => { d.ui.frame[0] = null; }, 'RAW_ROW_SCHEMA');
  add('raw-timestamp-string-coercion', (d) => { d.ui.frame[0].timestamp = '10'; }, 'EXACT_BITS_OR_NAME_BINDING');
  add('observed-now-string-coercion', (d) => { d.ui.frame[0].callbackObservedAtPerformanceMs = '11'; }, 'EXACT_BITS_OR_NAME_BINDING');
  add('unknown-trace-loss', (d) => { delete d.context.traceDataLoss; }, 'TRACE_LOSS_OR_UNKNOWN_CLOSE');
  add('trace-loss', (d) => { d.context.traceDataLoss = true; }, 'TRACE_LOSS_OR_UNKNOWN_CLOSE');
  add('unclosed-trace', (d) => { d.context.traceStreamClosed = false; }, 'TRACE_LOSS_OR_UNKNOWN_CLOSE');
  add('navigation-loader-swap', (d) => { d.context.documentAfter.loaderId = 'other'; }, 'DOCUMENT_CHANGED_OR_UNKNOWN');
  add('document-id-type', (d) => { d.context.documentBefore.id = 7; }, 'DOCUMENT_CHANGED_OR_UNKNOWN');
  add('document-url-cap', (d) => { d.context.documentBefore.url = 'x'.repeat(8193); }, 'DOCUMENT_CHANGED_OR_UNKNOWN');
  add('missing-renderer-metadata', (d) => { d.events.shift(); }, 'MISSING_OR_CONFLICTING_RENDERER_MAIN');
  add('conflicting-renderer-metadata', (d) => { const e = clone(d.events[0]); e.args.name = 'Other'; d.events.push(e); }, 'MISSING_OR_CONFLICTING_RENDERER_MAIN');
  add('missing-physical-calltime', (d) => { delete mark(d).args.data.callTime; }, 'OBSERVATION_MARK_SCHEMA_OR_IDENTITY');
  add('mark-ts-not-physical-fallback', (d) => { mark(d).args.data.callTime = 19000; }, 'PHYSICAL_CALLTIME_OR_FIRE_OUTSIDE_NATIVE_WINDOW');
  add('physical-calltime-one-us-before-fire', (d) => { mark(d).args.data.callTime = fire(d).ts - 1; }, 'PHYSICAL_CALLTIME_OR_FIRE_OUTSIDE_NATIVE_WINDOW');
  add('physical-calltime-one-us-after-fire', (d) => { mark(d).args.data.callTime = fire(d).ts + fire(d).dur + 1; }, 'PHYSICAL_CALLTIME_OR_FIRE_OUTSIDE_NATIVE_WINDOW');
  add('wrong-fire-category', (d) => { fire(d).cat = 'toplevel'; }, 'FIRE_SCHEMA_CATEGORY_OR_DOCUMENT');
  add('wrong-fire-document', (d) => { fire(d).args.data.frame = 'other'; }, 'FIRE_SCHEMA_CATEGORY_OR_DOCUMENT');
  add('duplicate-fire', (d) => { d.events.push(clone(fire(d))); }, 'PROOF_MARK_OR_FIRE_MULTIPLICITY');
  add('valid-fire-plus-unknown-identity', (d) => { const e = clone(fire(d)); delete e.tid; d.events.push(e); }, 'UNKNOWN_CALLBACK_EVENT_IDENTITY');
  add('duplicate-proof-mark', (d) => { d.events.push(clone(mark(d))); }, 'PROOF_MARK_OR_FIRE_MULTIPLICITY');
  add('foreign-mark', (d) => { const e = clone(mark(d)); e.name += '-foreign'; d.events.push(e); }, 'UNKNOWN_OR_FOREIGN_PROOF');
  add('wrong-raw-bits', (d) => { d.ui.v3Proof.frames[0].rawRafBits = '0000000000000000'; }, 'EXACT_BITS_OR_NAME_BINDING');
  add('wrong-observed-bits', (d) => { d.ui.v3Proof.frames[0].observedNowBits = '0000000000000000'; }, 'EXACT_BITS_OR_NAME_BINDING');
  add('raw-after-final-window', (d) => { rebindV3Frame(d, 1, 31, 21); }, 'RAW_ORDER_OR_WINDOW');
  add('string-callback-group-ordinal', (d) => { d.ui.v3Proof.callbacks[0].representedByOrdinal = '1'; }, 'CALLBACK_ACCOUNTING');
  add('raw-raf-group-count', (d) => { d.ui.frame[0].callbacks = 2; }, 'RAW_RAF_GROUP_COUNT');
  for (const key of ['droppedProofs', 'droppedCallbacks', 'capHits', 'samplesAfterClose', 'clearedMarks'])
    add(`collector-${key}`, (d) => { d.ui.v3Proof.counters[key] = 1; }, 'CAP_DROP_CLOSE_OR_UNQUALIFIED_CLEAR');
  add('missing-counter', (d) => { delete d.ui.v3Proof.counters.droppedProofs; }, 'COUNTER_SCHEMA');
  add('unsupported-expanded-caps', (d) => { d.ui.v3Proof.caps.proofs++; }, 'UNSUPPORTED_COLLECTION_CAPS');
  add('not-closed', (d) => { d.ui.v3Proof.closed = false; }, 'COLLECTION_LIFECYCLE_OR_LOSS');
  add('missing-present-request-category', (d) => { const e = clone(fire(d)); e.name = 'RequestAnimationFrame'; e.ph = 'I'; e.ts = 5000; delete e.cat; d.events.push(e); }, 'MALFORMED_PRESENT_REQUEST');
  return cases;
}
