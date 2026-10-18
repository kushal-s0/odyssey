"""Small auditable reference metrics; empty references never yield fake accuracy."""

import re
import unicodedata


def distance(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, left in enumerate(reference, 1):
        current = [i]
        for j, right in enumerate(hypothesis, 1):
            current.append(
                min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right))
            )
        previous = current
    return previous[-1]


def normal_text(text):
    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


def words(text):
    value = normal_text(text)
    return "".join(
        " " if unicodedata.category(c)[0] in {"P", "S"} else c for c in value
    ).split()


def error_rates(reference, hypothesis):
    ref, hyp = words(reference), words(hypothesis)
    chars, observed = normal_text(reference), normal_text(hypothesis)
    we = distance(ref, hyp)
    ce = distance(chars, observed)
    return {
        "word_edits": we,
        "reference_words": len(ref),
        "wer": we / len(ref) if ref else None,
        "character_edits": ce,
        "reference_characters": len(chars),
        "cer": ce / len(chars) if chars else None,
    }


def numeric_strings(text):
    return [
        "".join(str(int(c)) if c.isdecimal() else c for c in token).replace(",", "")
        for token in re.findall(r"\d+(?:[,\.]\d+)*", text)
    ]
