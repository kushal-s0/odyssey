# English/Hindi interface and an honest first-review summary

The October18 demo sprint follows the organizer's first-line screening goal.
It reuses the recorded model outputs and improves how people understand and act
on them; it does not rerun models or claim newly measured accuracy.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/i18n/I18nProvider.tsx` | English/Hindi context, optional localStorage preference, document language |
| `apps/web/src/i18n/hi.ts` | Local interface dictionary; no paid translation calls |
| `LanguagePicker`, localized pages/components | Change menus/guidance without remounting the workspace or replacing drafts |
| `domain/screening.ts` | Read saved economics and evidence flags; identify losses, funding gaps, mismatches and clarification needs |
| `ScreeningBrief` | Present the next review step ahead of the rubric score; source-field links |
| `RubricGuide` | Six weights,0–4 anchors, unknown handling and the meaning of a total |
| `contracts/uploads.py`, `routes/submissions.py` | Include arithmetic for the same saved assessment in the single scoped workspace response |
| `api/uploads.ts`, `pages/SubmitIdea.tsx` | Preserve expired HTTP status, pause waiting, retain the file/intent, discard unattached upload safely |
| `api/client.ts` | Accept successful bodyless HTTP204 responses |

Original applicant text, model reasons, English evidence, exported historical
content and user-authored program names are not passed through the interface
dictionary. These retain their own language; a visible note explains that
boundary. English/Hindi interface wording is prepared, not independently
reviewed fluency evidence for other languages. Content-language selection is
separate from interface language.

Financial calculations remain the existing Decimal server rules. The workspace
response derives them in memory from its already authorized saved assessment;
no extra SQL statement, dispatch, upload or model generation is introduced.
Stale/different-assessment arithmetic cannot produce a current finding. Missing
arithmetic and unknown information request clarification. Flags neither rewrite
the persisted model rating nor automatically approve/reject a beneficiary.

Stopping a browser transfer cannot revoke a request already received by the
server. The UI says to check saved ideas and retry the same input. Request keys
survive network failures; an expired intent is cleared; unattached cleanup is
an explicit action. The server still refuses deletion through this route if an
original has already been attached to an accepted idea.

Verification uses focused local API tests and a browser that intercepts Auth/API
and replays the earlier saved synthetic N01/N03/U01/P01 outputs. This proves UI
behavior, not live login/provider/model accuracy. The real local app health and
owned worker are checked separately. Source datasets, credentials, model caches,
historical evaluation outputs and existing Git attribution are preserved.

Committee answer: the pretrained models assist evidence extraction; our work
connects private multimodal intake, grounding, durable processing, review,
arithmetic and contextual views. The failed negative grading is a known limit.
The next quality step is independent human labels and versioned improvements,
not presenting the previous89/99 check count as success prediction accuracy.
