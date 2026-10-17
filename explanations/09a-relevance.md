# Relevance experiment

build_pairs.py reads original ZIP PDFs without modifying them and keeps proposed
QA text only under ignored evals/private. Labels and family merges are unreviewed.
train_relevance.py uses pinned, frozen MiniLM CPU features and a small logistic
classifier. evaluate_relevance.py reports abstention separately and refuses an
apparent two-class quality metric from a one-class holdout. The exact artifact,
feature/data hashes and report reproduce the rejection decision.

Committee: Did we train the language model? No. We fit a small relevance head on
pretrained embeddings. Is it validated? No; insufficient independently reviewed
families and class coverage prevent promotion. Why retain the baseline? The
deployment must expose uncertainty rather than promote an unsupported model.
Relevance, financial plausibility, source verification and business success are
different questions. No financial amount or personal demographic is a relevance
label. Read docs/MODEL_CARD.md for limitations and reproduction.
