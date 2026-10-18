import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "evals"))
from comprehensive_metrics import distance, error_rates, normal_text, numeric_strings  # noqa: E402


def test_word_substitution_has_known_denominator():
    result = error_rates("tea costs 10", "tea costs 15")
    assert result["reference_words"] == 3
    assert result["word_edits"] == 1
    assert result["wer"] == 1 / 3


def test_insertions_can_exceed_one_hundred_percent_wer():
    assert error_rates("tea", "tea and cups")["wer"] == 2


def test_empty_reference_does_not_become_fake_accuracy():
    result = error_rates("", "invented words")
    assert result["wer"] is None and result["cer"] is None


def test_unicode_normalization_case_and_spacing():
    assert normal_text("  CAFE\u0301\n") == "café"
    assert error_rates("CAFE\u0301", "café")["cer"] == 0


def test_edit_counts_and_financial_tokens_are_not_rounded():
    assert distance("kitten", "sitting") == 3
    assert numeric_strings("INR १२,००० and 12.50") == ["12000", "12.50"]
