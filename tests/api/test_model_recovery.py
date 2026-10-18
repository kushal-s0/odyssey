from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app.contracts.models import Domain
from app.contracts.worker import StageInput
from app.pipeline import assess
from app.providers.local_models import Qwen
from app.providers.speech import LocalSpeech
from test_assessments import structured_fixture


class Feature(int):
    def to(self, *args, **kwargs):
        return self


class Samples:
    def __init__(self, count):
        self.count = count

    def __len__(self):
        return self.count

    def __getitem__(self, key):
        start, stop, step = key.indices(self.count)
        return Samples(len(range(start, stop, step)))


def speech(always_capped=False):
    model = LocalSpeech.__new__(LocalSpeech)
    model.odia = False
    model.device = 'synthetic-device'
    model.dtype = None
    model.torch = SimpleNamespace(inference_mode=nullcontext)
    calls = []
    class Processor:
        def __call__(self, samples, **kwargs):
            return SimpleNamespace(input_features=Feature(len(samples)), attention_mask=Feature(1))

        def batch_decode(self, output, **kwargs):
            return ['uncertain source chunk']
    def generate(**kwargs):
        size = int(kwargs['input_features'])
        calls.append(size)
        return SimpleNamespace(shape=(1, 384 if always_capped or size > 14 * 16000 else 20))
    model.processor = Processor()
    model.model = SimpleNamespace(generate=generate)
    return model, calls


def test_capped_asr_retries_disjoint_halves_without_publishing_prefix():
    model, calls = speech()
    text, language = model.transcribe(Samples(28 * 16000), 'hi')
    assert calls == [28 * 16000, 14 * 16000, 14 * 16000]
    assert text == 'uncertain source chunk uncertain source chunk'
    assert language.code == 'hi' and language.needs_confirmation
    model, calls = speech(always_capped=True)
    with pytest.raises(ValueError, match='human transcription'):
        model.transcribe(Samples(28 * 16000), 'hi')
    assert len(calls) <= 4


def test_invalid_domain_after_bounded_repair_yields_null_not_lost_assessment(monkeypatch):
    structured = structured_fixture()
    class BrokenRater:
        measurements = []

        def json(self, system, source, *, validator):
            actual = Qwen.__new__(Qwen)
            actual.generate = lambda *_: '{"rating":2,"reason":"Invented 999 customers","segments":[199]}'
            return actual.json(system, source, validator=validator)
    class Encoder:
        def cosine(self, *args):
            return .5

        def embed(self, *args):
            return [1.] + [0.] * 383
    monkeypatch.setattr(assess, 'Qwen', BrokenRater)
    monkeypatch.setattr(assess, 'SentenceEncoder', Encoder)
    evidence = structured.evidence[0]
    value = StageInput(submission_id=evidence.submission_id, input_revision_id=evidence.input_revision_id,
        input_kind='text', preferred_language='en', source_text='Tea for office workers.',
        attachment_id=None, source_hash='a' * 64, bytes=None, media_type=None, pages=None, duration_seconds=None,
        previous_outputs={'structure': structured.model_dump(mode='json')})
    events = list(assess.handler({'work': {'stage_key': 'assess', 'pipeline_version': 'screening-v1'},
                                 'input': value.model_dump(mode='json')}))
    assert 'publish' in events[-1] and not any('failure' in event for event in events)
    domains = events[-1]['publish']['domains']
    clarity = next(row for row in domains if row['domain'] == Domain.clarity)
    assert clarity['rating'] is None and 'could not be grounded' in clarity['reason']
    assert '999' not in str(domains)
