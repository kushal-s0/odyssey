# Session handoff

Updated 17 October 2026, 22:22 IST. Deadline: 18 October, 06:00 IST, including deployed demo.
Read HACKATHON_RESET.md for the functional brief and priority order; old production gates are deferred honestly.

## Rules and current state

- Branch second, origin https://github.com/kushal-s0/odyssey.git. New author AND committer: Kartik Verma <kartikverma2204number1@gmail.com>. No trailers, no historical rewrite, local commits only. No push/PR/publication/deployment approval.
- Latest request: remove unnecessary files, simplify startup/README/env, restore real model results quickly, then finish the brief. Supabase login ONLY, no local/demo bypass. User is configuring private settings; never print them.
- Keep React/FastAPI/Supabase (one app PostgreSQL/Auth/storage service) and owned RTX5050 laptop worker. Local PostgreSQL is optional test infrastructure only. No MySQL/Mongo rewrite, paid APIs or trial-credit foundation.
- Original uploaded source archives/PDF preserved. Licenses/provenance retained. Human review available in English/Hindi only.

## Completed and verified here

- Removed 255 tracked legacy .tools vendor/bytecode files and duplicate setup reference/browser template. Removed only verified disposable ignored clean-install copies. Retained working venvs, model caches, private data and test evidence.
- Root .env.local is the single local config. configure.py safely migrated old browser values without overwriting filled root settings, derives public/Auth URLs and generates two random worker secrets. Vite reads root and exposes only VITE_ values. No private configured secret found in built browser assets.
- setup.cmd / scripts/bootstrap.py: actual end-to-end PASS. Reused CUDA packages/Qwen and checksum-verified pinned MiniLM. First npm ci was blocked by an old Vite/esbuild process; verified/stopped old preview, rerun succeeded (196 packages in22s).
- start.cmd / scripts/dev.py: actual API200 + frontend200 preview and Ctrl+C cleanup PASS, both ports closed. Missing-key/occupied-port checks work. Preview does not bypass Auth or generate assessments. Full Supabase-backed launcher cannot be verified until real config is valid.
- Owned worker now has explicit --continuous operator mode used by start.cmd; finite defaults retained. No idle/provider quota trick. Per-stage bounds remain. Four worker process tests PASS after change.
- Model env restored: Torch2.9.1+cu128, Transformers4.57.6, NumPy2.2.6, required API/language/model packages installed. GPU RTX5050 Laptop8151MiB.
- Actual English stored assessment PASS,168.306s cold total, peak Qwen extraction4,390,399,488bytes. Clarity/feasibility2/4, other domains insufficient; provisional50.00/coverage0.4/completeness22.22%, headline withheld/rankingfalse. Unknown profit stayed null, suppliedINR10 retained. This is pretrained inference, not new training.
- T08 DONE: 10 actual Edge/API/Postgres/Qwen applicant journeys PASS133.626s, including new pending-mic-permission no-POST regression. Landing desktop/mobile and auth fixture regressions PASS. Provider/microphone fixtures are explicitly synthetic; not hosted Auth evidence.
- Result view now includes extracted business fields/source links, grounded reasons and separate scores.
- Frontend typecheck/lint/build PASS; build5.77s1630modules. New scripts/worker Ruff PASS. Earlier API138passed/no skips86.71s; mypy53files PASS before worker CLI change. Existing AnyIO/Starlette deprecation.
- Five migrations applied/replayed only to existing local test DB on127.0.0.1:55432. Private DSN .local/test-database-url. Do not start/delete another DB/volume on that port.

## Current blockers and next actions

- Last private root check: SUPABASE_SERVICE_ROLE_KEY still blank; DATABASE_URL filled but hostname failed DNS resolution even outside sandbox. No hosted migration/account operation executed. User was told to check actual Connect > shared session-pooler URI. Do not print the URL/password; report safe categories only. Verify configured project, connectivity, migrations, asymmetric JWKS and private storage once corrected.
- Public Supabase URL/key migrated; not proof hosted login works. docs/ACCOUNT_SETUP.md gives actual migrations/Auth-user/profile/cohort commands. A login needs a trusted profile/cohort, not just Auth credentials.
- AI4Bharat IndicTrans2/IndicConformer probes still401 with existing token. Public NLLB600M (CC-BY-NC4 research) and Whisper-small are documented candidates, NOT integrated or language-quality verified. Do not train on unrelated internet descriptions as fake score labels. T09A rejected candidate remains unserved.
- Next brief implementation: T10 digital PDF -> real scanned/handwriting extraction with page evidence; T11 actual audio; accessible verified translation; assessor view, similarity, local context, four comparisons. Existing upload is not processing. Reuse Qwen/MiniLM/contracts and avoid another stack/scaffold.
- T09 longer exact-quote grounding remains brittle; recover valid facts with explicit warnings rather than fabricate evidence. Translation and non-English quality remain unfinished.
- Secondary HF deployment, large load tests and extra classifier training deferred; keep gates/report blockers honest. README short, docs/SETUP.md detailed, explanations/ maintained. Final T27 is the full step-by-step free deployment walkthrough.

## Commands and recovery

Windows PowerShell uses npm.cmd (npm.ps1 blocked). .\setup.cmd provisions; .\start.cmd starts real app after config/account setup. .venv/Scripts/python.exe -B scripts/configure.py --check lists missing names only. Do not rerun tests against hosted data.

Safe reports: evals/reports/applicant-ui.json and feasibility/owned-assessment.json. Only english case in the latter is this laptop; other cases remain earlier-machine history. Private synthetic screenshots/output under .local/ are ignored. No permanent app worker/API/Vite retained after final launcher check; local test database remains running. Inspect ports/processes before starting, and never kill an unrelated process.
