// Candidate registry only. No entry authorizes a formal browser run.
export const V4_CANDIDATE_POLICY = Object.freeze({
  id: "chrome156-861389-strict-post-window-b-v4-candidate-1",
  schemaVersion: "4.0.0",
  status: "NOT_QUALIFIED",
  formalQualification: "NOT_APPROVED",
  producerRevision: "861389936bf33ea77529ee5dcc0605e68f6bb620",
  executableSha256: "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa",
  perfettoRevision: "403906f4adfbf287a02e5546f8430dcc9d56b649",
  nativeV3SourceSha256: "3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782",
  maximumClassifiedTasks: 1,
  eventName: "ThreadControllerImpl::RunTask",
  eventCategory: "toplevel",
  eventPhase: "B",
  sourceLocation: Object.freeze({
    src_file: "cc/trees/proxy_impl.cc",
    src_func: "ScheduledActionSendBeginMainFrame",
    src_line: 849,
  }),
  contract: "docs/16-nonadvanced-completion/lanes/performance/ADR-PERF-QUALIFICATION-V4.md",
  independentSourceReview:
    "docs/16-nonadvanced-completion/lanes/performance/semantic-01-independent-review.json",
  qualificationRequires: Object.freeze([
    "INDEPENDENT_SOURCE_REVIEW",
    "FRESH_SEMANTIC_PILOT_RAW_REVIEW",
    "VERSIONED_APPROVAL_RECORD",
  ]),
});
export const V4_APPROVED_QUALIFICATIONS = Object.freeze([]);
export function requireApprovedV4Qualification(id) {
  const found = V4_APPROVED_QUALIFICATIONS.find((entry) => entry.id === id);
  if (!found) throw new Error("V4_QUALIFICATION_NOT_APPROVED");
  return found;
}
