import assert from "node:assert/strict";
import { solveAcoustics } from "../../../src/acoustics/solver.ts";

const tolerance = 1e-10;
const near = (a, b) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
let pathId;
for (let k = 0; k < 100; k++) {
  const theta = (k * 2 * Math.PI) / 100;
  const rotate = ([x, y, z]) => [
    Math.cos(theta) * x - Math.sin(theta) * y,
    Math.sin(theta) * x + Math.cos(theta) * y,
    z,
  ];
  const transform = (v) => rotate(v).map((n, i) => n + [0, 2, -3][i]);
  const result = solveAcoustics({
    requestId: "rigid-invariance",
    sceneRevision: 0,
    geometryRevision: 0,
    poseTick: k,
    topologyId: "probe-room",
    source: { id: "source-a", positionM: transform([1, 1, 0]) },
    listener: { id: "listener-a", positionM: transform([5, 1, 0]) },
    surfaces: [{
      id: "floor",
      materialId: "material-a",
      normal: rotate([0, 1, 0]),
      verticesM: [[-10, 0, -10], [-10, 0, 10], [10, 0, 10], [10, 0, -10]].map(transform),
    }],
    materials: [{
      schemaVersion: "1.0.0",
      id: "material-a",
      revision: 0,
      label: "Synthetic probe",
      dataClass: "Synthetic",
      sourceUrls: [],
      conditions: "equal medium magnitude only",
      phaseModel: "zeroPhaseMagnitudeOnly",
      bands: [{ centerHz: 1000, absorptionEnergy: 0.26, reflectionEnergy: 0.64,
        transmissionEnergy: 0.1, scatteringFraction: 0.25 }],
    }],
    bandCentersHz: [1000],
    atmosphere: { medium: "air", speedOfSoundMps: 343, bandAbsorptionDbPerM: [0.1] },
  });
  assert.equal(result.frame.paths.length, 2);
  const path = result.frame.paths.find((p) => p.order === 1);
  assert.ok(path);
  near(path.lengthM, Math.sqrt(20));
  near(path.absoluteDelayS, Math.sqrt(20) / 343);
  near(path.relativeDelayS, (Math.sqrt(20) - 4) / 343);
  near(path.bandGains[0], Math.sqrt(0.64 * 0.75) / Math.sqrt(20) * 10 ** (-0.1 * Math.sqrt(20) / 20));
  transform([3, 0, 0]).forEach((value, i) => near(path.verticesM[1][i], value));
  rotate([-2 / Math.sqrt(5), -1 / Math.sqrt(5), 0]).forEach((value, i) => near(path.arrivalDirection[i], value));
  if (pathId) assert.equal(path.id, pathId);
  pathId = path.id;
  assert.equal(result.diagnostics.materialDiffuseEnergyExcluded, true);
}
console.log(JSON.stringify({
  status: "PASS",
  cases: 100,
  scope: "Independent rigid-transform first-order geometry, delay, pressure, arrival and identity probe",
  tolerance,
  reference: "Closed-form sqrt(20), midpoint reflection and orthogonal coordinate transform; no solver helpers",
  node: process.version,
}));
