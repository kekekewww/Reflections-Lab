// Test-only domain checks. The product host must implement its own validated transaction boundary.
const isUnit = (vector, tolerance = 1e-6) => Math.abs(Math.hypot(...vector) - 1) <= tolerance;
export function sceneDomainErrors(scene) {
  const errors = [];
  const objects = new Map(scene.objects.map((object) => [object.id, object]));
  const ids = [
    ...scene.objects.map((o) => o.id),
    ...scene.sources.map((s) => s.id),
    scene.listener.id,
  ];
  if (new Set(ids).size !== ids.length) errors.push("duplicate scene object/source/listener ID");
  for (const entity of [...scene.objects, scene.listener])
    if (!isUnit(entity.orientationQuaternion))
      errors.push(`${entity.id}: quaternion must have unit norm`);
  for (const source of scene.sources)
    if (!objects.has(source.objectId)) errors.push(`${source.id}: unknown object reference`);
  for (const object of scene.objects) {
    const [width, height, depth] = object.dimensionsM;
    if (object.shape === "sphere" && (width !== height || width !== depth))
      errors.push(`${object.id}: sphere must have equal dimensions`);
    if (object.shape === "capsule" && (width !== depth || height < width))
      errors.push(`${object.id}: capsule bounds invalid`);
  }
  return errors;
}
export function materialDomainErrors(material) {
  const errors = [];
  material.bands.forEach((band, i) => {
    if (
      Math.abs(band.absorptionEnergy + band.reflectionEnergy + band.transmissionEnergy - 1) > 1e-9
    )
      errors.push(`band ${i}: A+R+T != 1`);
    if (i > 0 && material.bands[i - 1].centerHz >= band.centerHz)
      errors.push(`band ${i}: centers must be strictly increasing`);
  });
  if (material.dataClass === "Measured" && material.sourceUrls.length === 0)
    errors.push("measured data requires source provenance");
  return errors;
}
export function acousticFrameDomainErrors(frame) {
  const errors = [];
  frame.bandCentersHz.forEach((band, index) => {
    if (
      !Number.isFinite(band) ||
      band <= 0 ||
      (index > 0 && frame.bandCentersHz[index - 1] >= band)
    )
      errors.push("band centers must be positive, unique and strictly increasing");
  });
  const individual = frame.capabilities.includes("individualReflectionPaths");
  if (!individual && (frame.paths.length > 0 || frame.pathAvailability === "available"))
    errors.push("individual reflection paths unsupported by backend capabilities");
  if (frame.impulseResponseArtifactId !== null && !frame.capabilities.includes("impulseResponse"))
    errors.push("IR artifact unsupported by backend capabilities");
  for (const path of frame.paths) {
    if (path.sourceId !== frame.sourceId || path.listenerId !== frame.listenerId)
      errors.push(`${path.id}: source/listener IDs differ from frame pair`);
    if (path.bandGains.length !== frame.bandCentersHz.length)
      errors.push(`${path.id}: band gain count differs from frame band centers`);
    if (path.surfaceIds.length !== path.order || path.verticesM.length !== path.order + 2)
      errors.push(`${path.id}: order/vertices/surfaces mismatch`);
    if (!isUnit(path.arrivalDirection))
      errors.push(`${path.id}: arrivalDirection must be unit length`);
    const last = path.verticesM.at(-1),
      previous = path.verticesM.at(-2);
    const apparent = previous.map((value, axis) => value - last[axis]);
    const finalSegmentLength = Math.hypot(...apparent);
    if (
      finalSegmentLength <= 1e-12 ||
      apparent.some(
        (value, axis) => Math.abs(value / finalSegmentLength - path.arrivalDirection[axis]) > 1e-6,
      )
    )
      errors.push(`${path.id}: arrivalDirection must point from listener toward last interaction`);
    const geometricLength = path.verticesM
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum + Math.hypot(...point.map((value, axis) => value - path.verticesM[index][axis])),
        0,
      );
    if (Math.abs(path.lengthM - geometricLength) > 1e-9)
      errors.push(`${path.id}: path length differs from segment geometry`);
    if (
      frame.directDelayS !== null &&
      Math.abs(path.absoluteDelayS - frame.directDelayS - path.relativeDelayS) > 1e-9
    )
      errors.push(`${path.id}: absolute/relative delay mismatch`);
  }
  return errors;
}
export function experimentDomainErrors(experiment) {
  const errors = [];
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(experiment.createdAt) ||
    !Number.isFinite(Date.parse(experiment.createdAt))
  )
    errors.push("createdAt must parse as UTC ISO8601");
  if (
    new Set(experiment.resultArtifacts.map((a) => a.id)).size !== experiment.resultArtifacts.length
  )
    errors.push("duplicate artifact ID");
  return errors;
}
