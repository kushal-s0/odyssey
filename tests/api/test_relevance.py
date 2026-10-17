from app.domain.relevance import BASELINE, SELECTED_RELEVANCE, baseline_label


def test_unpromoted_classifier_cannot_replace_baseline():
    assert SELECTED_RELEVANCE==BASELINE


def test_relevance_never_conflates_short_or_implausible_amounts_with_irrelevance():
    assert baseline_label('',.9)=='missing'
    assert baseline_label('Tea',.1)=='uncertain'
    assert baseline_label('INR 999999999 profit',.7)=='relevant'
    assert baseline_label('The cricket shop is nearby',.1)=='uncertain'
