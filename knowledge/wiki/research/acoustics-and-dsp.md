---
id: RLAB-KB-0011
title: 聲學與DSP綜合知識
type: research
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:54:59.738Z
sources:
  - RLAB-SRC-0006
  - RLAB-SRC-0007
  - RLAB-SRC-0008
  - RLAB-SRC-0010
  - RLAB-SRC-0009
  - SB-SRC-0002
  - SB-SRC-0001
related_tasks:
  - RLAB-TASK-0001
related_decisions: []
supersedes: []
tags:
  - P1
  - acoustics
  - DSP
  - research
---

# 聲學／DSP：可追溯結論與實作界線

27核心paper/ISO/technical來源與64中央主張見[PAPER_INDEX](../../../research/papers/PAPER_INDEX.md)、[Ledger](../../../research/EVIDENCE_LEDGER.json)。VERIFIED只指來源索引／已讀方法及有限解析證據，不代表全文皆讀、論文原實驗重現或真實房間驗證。

- finite polygon ISM必須檢反射點在面內及各segment visibility；stable path identity由source/listener/ordered surfaces/model version決定，不依排名／座標。
- A/R/T是能量定義；同阻抗magnitude-only才用sqrt(R)。scattering分配反射能量；量測absorption若含transmission不能再重扣。Synthetic preset不得標Measured。
- direct與reflections共用emission t0；absolute/relative delay不雙算，propagation／DSP／device delay分開。
- EDC反向積分，EDT/T20/T30 fit需decay範圍與noise考量；insufficient不能補RT60=0。dBFS不等於dB SPL。
- 精確移動傳播需retarded time；quasi-static delay是近似；delay變化已產生Doppler時不可再重複pitch shift。
- collision sample playback不是modal synthesis；impulse只是excitation一部分。wave FDTD/FEM/BEM適用條件、網格與成本不能由geometric微基準推得。

原始公式與條件在[ACOUSTIC_THEORY](../../../research/theory/ACOUSTIC_THEORY.md)、[DSP_MODELS](../../../research/theory/DSP_MODELS.md)、[PHYSICS_THEORY](../../../research/theory/PHYSICS_THEORY.md)。完整ISO大氣係數reference、V3獨立solver與V5實房間仍缺，見[blockers](../blockers/open-questions.md)。


Sound研究把發聲內容與傳播分開，Web Audio生命周期／Worklet block新claims SB-AUD-C01/02為DOC/SPEC review，不是audio實測；新Ledger68sources/66claims，原Phase1數量保留歷史。Physical-inspired sample屬perceptual，不是自然振動。參見[來源與限制](interactive-sound-design.md)。
