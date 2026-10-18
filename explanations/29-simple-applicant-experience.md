# Simple applicant experience

The first screen asks the applicant to speak, write or send a file. The saved
result puts a loss/funding gap and the next question ahead of scores. More tools,
facts, sources, proposed rubric and earlier versions remain available through
explicit expandable sections. These are display changes; submitted facts,
permissions, durable jobs and mathematical/LLM assessments are preserved.

`i18n/simple.ts` holds plain-language English/Hindi overrides over the existing
catalog. Structured messages are translated; arbitrary original/model prose
keeps its actual language. Follow-up questions have simpler authored Hindi
guidance with conflict/unreadable context retained. Changing menus preserves
draft answers. The UI does not automatically overwrite a chosen content language.

`ReadAloud.tsx` uses the browser's SpeechSynthesis API after a click. It listens
for voiceschanged, chooses a voice of the actual displayed language and requires
localService=true. It does not use an English voice to speak Hindi. Reading stops
on page/language/text changes, hidden tabs and microphone start. Missing voices
show a translated explanation. There is no cloud TTS fallback or extra service.
API reference: [voice locality](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
and [voice availability](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices).

The actual Edge capability probe found local English voices only on this machine.
Hindi voice output therefore remains unavailable here without installing a local
Hindi voice. Browser fixtures verify selection/cancellation/error boundaries;
they do not measure speech quality. Hindi interface text works independently.

Checks: `npm.cmd --prefix apps/web run typecheck`, `run lint`, `run build` and
`node apps/web/scripts/browser-demo-readiness.mjs`. The eight fixture groups,
scope and real device inventory are recorded in `evals/reports/simple-ui.json`.
No new model evaluation or live applicant data is used. Production JS still has
the existing >500kB advisory; successful display tests are not user research.

Committee answer: “We show one next action and important money information first.
A mentor can expand the evidence and ratings. The interface is designed to be
easier to use, but we still need to observe real applicants using it.”
