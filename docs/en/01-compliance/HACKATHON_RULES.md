<!-- english-source: {"path":"docs/01-compliance/HACKATHON_RULES.md","sha256":"b408e37549cb31eedd0af6af65bc00c4b7327d428ce57037a60a9913951d6868","translated_at":"2026-10-27T03:38:14.1997776Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/01-compliance/HACKATHON_RULES.md`](../../01-compliance/HACKATHON_RULES.md). Source SHA-256: `b408e37549cb31eedd0af6af65bc00c4b7327d428ce57037a60a9913951d6868`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="hackathon-規則查核"></a>
# Hackathon Rules Review

> For the current recheck, see “2026-10-27 Sound Behavior Phase Recheck” at the end. The 2026-10-26 review history is retained below; the waiver date at that time does not mean the current version is still the same.

Review time: 2026-10-26 03:05 (Asia/Taipei, UTC+08:00); information was obtained from official public pages during 2026-10-25 19:01–19:05 UTC. Its purpose is research and engineering preparation; no application, login, acceptance of terms, credit redemption, or project submission was performed on the user's behalf. The user's application/acceptance status and personal eligibility were not checked.

<!-- english-original-anchor --> <a id="正式來源與可讀性"></a>
## Official Sources and Readability

| ID | Official source | Evidence obtained in this review |
|---|---|---|
| HC-01 | [Meta event page](https://dev.meta.ai/events/global-hackathon) | Readable: dates, themes, tracks, and application restrictions; it still states that official rules will be published before the 10/26 start. |
| HC-02 | [Cerebral Valley Event Waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) | Plain-text extraction displayed only Loading; browser rendering was then used to read the full text successfully. The title was `Hackathon Terms & Conditions (“Official Rules”) and Event Waiver`, and the date at the end of the document was 2026-10-13. Sections are identified by name below because the page has no numbered provisions. |
| HC-03 | [Co-host's event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) | Readable; the header uses EST, while dates in the body use ET, creating a discrepancy in time-zone labeling. |
| HC-04 | [Official submission entry](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) | Read-only navigation redirected to the login page; without logging in, the complete submission fields could not be viewed. |

The connected Devpost service was queried first: an exact event-name search returned 0 results, and an overview query using the official Meta URL returned `Hackathon not found`. Rules from other Devpost competitions were therefore not applied. HC-02 calls itself Official Rules; HC-01's old notice does not justify saying that there are “no rules at all,” nor does it establish that HC-02 covers submission requirements that have not yet been published. Versions must be compared again before the start and before submission.

<!-- english-original-anchor --> <a id="時程與時區"></a>
## Schedule and Time Zones

The year is 2026, as explicitly stated on the official page. Conversions use US Eastern local time (Windows `Eastern Standard Time`, including daylight saving time); the Taipei conversions are engineering derivations, not a separate announcement from the organizer. In month 10, the time zone is still EDT (UTC−04); 11/4 is EST (UTC−05), so a fixed 12-hour offset must not be used.

| Item | Original official date/time (HC-01) | Taipei time/status |
|---|---|---|
| Applications open | 10/13 09:00 ET | 10/13 21:00 |
| Application deadline | 10/25 23:59 ET; may close early at 20,000 applicants | **10/26 11:59**; HC-02 says EST, which would literally mean 12:59. Use the earlier ET time for planning; available places are not guaranteed. |
| Acceptance notification | By 10/26 09:00 ET | By 10/26 21:00 |
| Event starts | 10/26, kickoff livestream | HC-01 gives no exact time; the discrepancy between 12:00 EST in HC-03's header and its ET labeling remains unresolved, so this is not used as an exact start point for eligible development. |
| Workshops | 10/27–11/4 | Only a date range is available; individual session times remain to be confirmed. |
| **Project submission** | **11/4 21:00 ET** | **11/5 10:00** (UTC 11/5 02:00); an internal freeze at least one day earlier is recommended. |
| Judging/closing | 11/4–11/8; 11/9 | The official information gives dates only; these cannot simply be treated as the same dates in Taipei. |

Meta may change the dates. At the time of this review, it was early morning on 10/26 in Taipei. The application deadline and project submission deadline must not be conflated, and “the application deadline has not yet arrived” does not mean “accepted.”

<!-- english-original-anchor --> <a id="明確允許禁止附條件與未知"></a>
## Explicitly Allowed, Prohibited, Conditional, and Unknown

| Category | Verified content and applicable sections | Reflection Lab decision |
|---|---|---|
| **Explicitly allowed** | HC-02 `Event Overview`: Indie Developer accepts individuals, students, and teams of up to 4 people; there is also a Startup track. Participation is virtual, with no purchase required. | Indie/Push the Frontier is provisionally recommended as a fit; no track has been selected on the user's behalf. A theme is not a third competition track. |
| **Explicitly prohibited** | HC-01/HC-02: false, duplicate, or spam applications may lead to disqualification; each participant and each project is limited to one track; others' rights must not be infringed. `Code of Conduct` prohibits harassment and related conduct. | Preserve truthful authorship, sources, and work records; do not claim that someone who has not been accepted is eligible to participate. |
| **Conditional: eligibility** | HC-02 `Age Restrictions and Eligibility Requirements`: at least 18 years old and of legal age in the place of residence; each intended participant must apply and be accepted. Persons restricted by law/sanctions and specified related persons may not participate. | The user's age, identity, organization, location, and proof of acceptance have not been verified. A Taipei time zone is not proof of eligibility. |
| **Conditional: geography/related persons** | The same HC-02 section excludes Belarus, China, Russia, Ukraine, Syria, the listed Crimea/Donetsk/Luhansk regions, Cuba, North Korea, Iran, and other comprehensively sanctioned regions; it also covers sanctioned persons and their agents. Meta/Cerebral Valley employees, contractors, interns, government-related persons, and the family/household members specified in the provisions may not participate. | The public page does not exclude Taiwan, but this cannot substitute for a complete eligibility determination. Refer to the original section for the complete geographic and family definitions. |
| **Conditional: teams** | HC-02 `Event Overview`: designate an eligible and authorized Representative to submit on behalf of the team; Indie must list all team members; a Startup representative must be a current employee and be authorized to receive notices/prizes. | Team size and ownership of rights require a separate check; no submission is created at this stage. |
| **Conditional: open source** | HC-02 `Hackathon Submission` explicitly permits open source software/hardware, provided its license is followed and the project enhances or builds upon that open source product. | Three.js, Rapier, and similar dependencies can be evaluated under this condition; each package still requires an individual license inventory. This does not answer whether previously written, self-owned product code may be reused. |
| **Conditional: third-party assistance** | HC-02 `Hackathon Submission` permits commissioned technical assistance, but project components must remain the participants' own work and rights, with guarantees of originality and non-infringement. | This cannot be extrapolated to mean that every commercial SDK, sound effect, weight, or AI output has competition approval. |
| **Conditional: Meta tools** | HC-02 `Event Overview` says participants build with Meta AI products; HC-01 introduces the Muse Spark family, Muse Image, SAM 3.1, open weights, and Muse Code. | The product should have a verifiable use of Meta models; no requirement to use every model, minimum call volume, or exclusive-provider clause was found. Model licenses/API terms of use require a separate review. |
| **Unconfirmed** | Limits on pre-event research/code preparation; whether existing self-owned code may be reused; the scope of competition permission for commercial SDKs; special restrictions on third-party data, sound effects, and pretrained weights. | **Under the user's Phase B instructions, perform only research, documentation, environment setup, SDK smoke tests, and isolated feasibility validation; do not yet implement substantial official product functionality.** This is the project's conservative scope, not an official clause prohibiting research. |
| **Unconfirmed** | Whether non-Meta coding agents such as Codex are restricted, the disclosure format for AI outputs, and whether Muse Code is mandatory; no explicit permission or prohibition concerning Codex was found. | Truthfully retain provenance for this AI collaboration; do not interpret a tool's absence from the text as either a prohibition or blanket permission. |
| **Unconfirmed** | Public/private repository, required license, source ZIP, commit/diff evidence, deployment platform, whether localhost is allowed, provision of login accounts, video duration/language/visibility, and all required form fields. | HC-04 requires login to read the form; the public provisions do not specify these details. Requirements from other competitions, such as 2/3-minute videos or mandatory public GitHub repositories, must not be imported. |

<!-- english-original-anchor --> <a id="評審與展示"></a>
## Judging and Demonstration

HC-02 `Hackathon Judging Criteria` applies to judging projects and is separate from application screening: Impact **30%**, Use of Meta AI Tooling **25%**, Technical Depth & Execution **20%**, and Demo **25%**. Demo evaluation includes actual operation, live stability, and video quality, but mandatory video upload fields/duration specifications have not yet been obtained.

Reflection Lab can present an engineering demonstration supported by evidence: a Meta agent generates validated scene operations, the solver supplies data, A/B comparisons are reproducible, and approximation limits are explicit. This is a project recommendation, not an additional official clause. The application-screening balance of “half idea, half technical ability” must not be misrepresented as the project scoring scheme.

<!-- english-original-anchor --> <a id="智慧財產與公開資料"></a>
## Intellectual Property and Public Information

HC-02 `Hackathon Submission` retains participants' ownership of their projects relative to the organizers; at the same time, submission grants the organizers, their subsidiaries, agents, and partner companies perpetual, irrevocable, worldwide, royalty-free, non-exclusive, broad rights of use, adaptation, and reuse. `Release of Information` also provides a transferable, sublicensable, perpetual, broad license for event-related Materials and explicitly makes no confidentiality commitment. `Image, Video and Audio Recording Consent` covers long-term use of names, likenesses, voices, chats, screen sharing, and submitted content.

Retaining ownership therefore does not mean that a submission remains confidential; having a lawful source does not necessarily mean having the right to grant all reuse rights required by the event. Public demos must not contain API keys, personal data, company secrets, or unauthorized third-party data. If the actual scope of a third-party license and the event's guarantees are uncertain, first replace the material with original or clearly reusable assets and record the replacement; do not claim that additional rights have been obtained.

<!-- english-original-anchor --> <a id="正式開發提交前關卡"></a>
## Gates Before Official Development/Submission

1. Recheck HC-01/HC-02 and announcements for accepted participants, retain new version dates and change summaries, and confirm the rules for pre-event work and other coding agents.
2. The user must handle their own eligibility, acceptance, and acceptance of legal terms; this review did not inspect accounts or act on their behalf.
3. In an authorized logged-in context, obtain the complete HC-04 requirements and check the repository, deployment, video, team members, and receipt confirmation.
4. Complete third-party notices/data-license checks for the actual distributed content, include provenance differences before and after the event starts, and leave a buffer before the deadline.

This document does not treat an unfound clause as an official exemption; all unknowns remain pending review and do not prevent authorized research and isolated validation.

<!-- english-original-anchor --> <a id="2026-10-27-sound-behavior-階段重查"></a>
## 2026-10-27 Sound Behavior Phase Recheck

Review: 01:19 Taipei, public pages only; no login, acceptance of terms, credit redemption, or submission. The [Meta event page](https://dev.meta.ai/events/global-hackathon), [CV public event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), and complete [Official Rules/waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) were reread. The waiver page footer is now **2026-10-25**; the earlier summary recorded 10/13, and without the original earlier full text a complete redline cannot be established. The Meta page still announces rules in the future tense; this does not invalidate the already readable waiver.

| Question | Classification confirmed in this review |
| --- | --- |
| Codex or other coding agents | **UNSTATED**: no explicit permission or prohibition was found in the public full text that was read; third-party technical assistance/OSS are conditionally permitted, which cannot be extrapolated into an exemption for all AI collaboration. Muse Code being introduced does not make it mandatory or the only available option. |
| Use of Meta models | **CONDITIONAL**: public provisions require building with Meta AI products; the event introduces the API and Meta open weights. No API exclusivity, mandatory Muse Code use, minimum call count, or fixed deployment method was found. Using a coding agent cannot itself be treated as proof of product integration. |
| Integration depth | **JUDGING CRITERION**: Meta tooling accounts for 25%, assessing creativity and work beyond basic integration; there is no publicly stated quantitative minimum threshold. |
| Submission evidence | Public scoring involves a working demo, live stability, and video quality; repository, API logs, deployment, video specifications, and receipt fields are **UNKNOWN**. Both [details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) and [submit](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) actually redirected to the login page in this review, and their contents were not read. |

No change to the project deadline was found; it remains 11/4 21:00 ET＝11/5 10:00 Taipei. CV's Event Closed label cannot determine whether the user has been accepted; eligibility, the boundary for pre-event code, announcements after login, and credit terms still require verification. This public recheck is insufficient to declare complete competition compliance.

The project's use of Codex for development and the Meta Model API for the in-product Muse Agent is the user's latest engineering decision, not a coding-agent exemption issued by the organizer. The [evidence package recommendations](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) for reproducible model/tool traces and runtime results are engineering methods, not confirmed mandatory attachments. For source dates, rendered-text fingerprints, and limitations, see [metadata for this review](../../../research/sound-behaviors/ai-rules-sources.json); a fingerprint is not a hash of the original HTTP bytes or a guarantee of a legal version.
