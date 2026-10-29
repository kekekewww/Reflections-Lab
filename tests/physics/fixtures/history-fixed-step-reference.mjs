// Frozen original fixedStep from physics-world.ts SHA256 75e53957731099ab5fdf9b45760dce7a65814774070cdb9d2210e37555d51b64.
// Only TypeScript annotations/assertions were erased; logic and original full PRE projection are retained.
// Frozen75e539 pre-history fixedStep; TypeScript syntax erasure only when SOURCEGO permits preparation of durable fixture.
import { vector, stableHash } from "../../../src/physics/math.js";
const zero = [0, 0, 0];
export function originalFixedStep() {
  const before = this.poses();
  this.previous = before;
  this.controlGrip();
  this.player?.step(this.playerInput, this.fixedDtSeconds);
  const pre = new Map();
  for (const [id, r] of this.records)
    pre.set(id, {
      center: vector(r.body.worldCom()),
      velocity: vector(r.body.linvel()),
      angular: vector(r.body.angvel()),
    });
  this.world.step(this.queue);
  this.tickValue++;
  this.queue.drainCollisionEvents((ha, hb, started) => {
    const ia = this.colliderIds.get(ha),
      ib = this.colliderIds.get(hb);
    if (!ia || !ib) return;
    const [a, b] = [ia, ib].sort();
    const key = `pair-${stableHash(a + "|" + b)}`;
    if (started) {
      const n = (this.pairEpisodes.get(key) ?? 0) + 1;
      this.pairEpisodes.set(key, n);
      const pair = {
        a,
        b,
        episodeId: `${key}.e${n}`,
        onsetTick: this.tick,
        lastImpactTick: -1000000,
        contact: null,
      };
      this.pairs.set(key, pair);
      this.enqueue({
        type: "ContactBegin",
        objectId: a,
        otherObjectId: b,
        source: "physics",
        accepted: true,
      });
    } else {
      const pair = this.pairs.get(key);
      if (pair)
        this.enqueue({
          type: "ContactEnd",
          objectId: pair.a,
          otherObjectId: pair.b,
          source: "physics",
          accepted: true,
        });
      this.pairs.delete(key);
    }
  });
  this.queue.drainContactForceEvents(() => {
    /* Force events are distinct from contactImpulse; consume bounded engine queue. */
  });
  // A mode edit invalidates audible episodes but may leave the same physical
  // support contact alive. Recover its state without inventing a new impact.
  for (const [id, r] of this.records)
    if (r.enabled)
      this.world.contactPairsWith(r.collider, (collider) => {
        const other = this.colliderIds.get(collider.handle);
        if (!other || other === id) return;
        const [a, b] = [id, other].sort(),
          key = `pair-${stableHash(a + "|" + b)}`;
        if (!this.pairs.has(key)) {
          const n = (this.pairEpisodes.get(key) ?? 0) + 1;
          this.pairEpisodes.set(key, n);
          this.pairs.set(key, {
            a,
            b,
            episodeId: `${key}.e${n}`,
            onsetTick: -1,
            lastImpactTick: this.lastImpactByPair.get(key) ?? -1000000,
            contact: null,
          });
        }
      });
  for (const [key, pair] of this.pairs) this.samplePair(key, pair, pre);
  const old = new Map(before.map((p) => [p.objectId, p]));
  for (const pose of this.poses(true)) {
    const prior = old.get(pose.objectId);
    if (!prior) continue;
    if (pose.moving !== prior.moving)
      this.enqueue({
        type: pose.moving ? "OnStartMoving" : "OnStopMoving",
        objectId: pose.objectId,
        source: "state",
        accepted: true,
      });
    if (pose.sleeping !== prior.sleeping)
      this.enqueue({
        type: pose.sleeping ? "OnSleep" : "OnWake",
        objectId: pose.objectId,
        source: "state",
        accepted: true,
      });
  }
  const pending = this.pending;
  this.pending = [];
  this.events = pending.map((event, sequence) => {
    const r = this.records.get(event.objectId);
    return {
      ...event,
      eventId: `phys-${this.epoch}-${this.tick}-${sequence}`,
      tick: this.tick,
      sequence,
      sceneRevision: this.scene.sceneRevision,
      simulationTimeSeconds: this.tick * this.fixedDtSeconds,
      fixedDtSeconds: this.fixedDtSeconds,
      generation: r?.generation ?? this.generations.get(event.objectId) ?? 0,
      positionMetres: event.positionMetres ?? (r ? vector(r.body.translation()) : [...zero]),
    };
  });
}
