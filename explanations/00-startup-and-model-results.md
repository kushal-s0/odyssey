# Startup and the first real result

The application uses Supabase for its PostgreSQL database, password login and
private file storage. A separate local PostgreSQL instance is only a developer
test fixture. MySQL/MongoDB are not required. Keeping the working persistence
avoids spending the hackathon rewriting already verified submission/evidence code.

`setup.cmd` runs `scripts/bootstrap.py`: install the pinned API dependencies,
reuse the existing CUDA environment, add missing model packages, install the web
lockfile, configure local settings and verify cached model checksums. Two Python
environments keep large GPU libraries out of the lightweight API. Model files and
dependency folders are ignored, rather than copied into Git.

`scripts/configure.py` maintains one private root `.env.local`. It never overwrites
a filled value, migrates old browser settings safely and generates separate random
worker/bootstrap signing secrets. Vite reads the same file but exposes only the
public `VITE_` names. The local worker receives a narrow environment without the
database/service keys. A separately hosted worker needs only its worker settings.

`start.cmd` runs `scripts/dev.py`: validate required setting names, check ports,
then start API, frontend and the owned worker. Logs stay ignored under `.local`.
The explicit continuous worker mode runs until the operator stops the app; it does
not depend on a hosted inference allowance or ping a provider to prevent sleep.
Each model stage still has a timeout and only one GPU stage executes at a time.
The laptop, electricity and internet must remain available.

The English result is actual pretrained Qwen inference, not foundation-model
training. The source is split into evidence, business facts must quote that
evidence, domain judgments cite it, and server code calculates the totals. An
unknown profit remains missing. Insufficient evidence withholds the headline and
ranking even when a provisional score can be calculated.

On this RTX5050 laptop a cold synthetic English case completed in168.306seconds,
with peak extraction allocation about4.39GB. Ten actual browser journeys passed
using a real API/database/model and explicitly synthetic identity-provider replies.
This proves the measured local flow; hosted Supabase login and semantic accuracy
need their own checks. No new training, all-language coverage or public deployment
is claimed. See T08/T09 reports for the exact boundaries and remaining features.

Committee questions: why no new training? There are too few reliable human score
labels to justify it. The existing small relevance experiment was evaluated and
rejected for serving. Why original evidence? It lets an assessor inspect the basis
of a model suggestion and identify omissions. Why missing scores? Absence of
information is not evidence of an unviable business.
