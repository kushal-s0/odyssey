"""Durable chunked audio extraction with coarse, actual sample time ranges."""
import importlib
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from uuid import uuid5

from ..contracts.models import AudioEvidence
from ..contracts.pipeline import EvidenceBundle
from ..contracts.worker import StageInput
from ..providers.local_models import ModelUnavailable
from ..providers.speech import LocalSpeech


def decode(path: Path, max_seconds: float = 600) -> Any:
    av = importlib.import_module('av')
    np = importlib.import_module('numpy')
    chunks = []
    size = 0
    with av.open(str(path)) as source:
        if not source.streams.audio:
            raise ValueError('No audio stream')
        resampler = av.AudioResampler(format='fltp',layout='mono',rate=16000)
        for frame in source.decode(audio=0):
            for output in resampler.resample(frame):
                part = output.to_ndarray().reshape(-1)
                size += part.size
                if size > (max_seconds + 1) * 16000:
                    raise ValueError('Decoded audio exceeds duration bound')
                chunks.append(part)
        for output in resampler.resample(None):
            chunks.append(output.to_ndarray().reshape(-1))
    samples = np.concatenate(chunks) if chunks else np.array([],dtype=np.float32)
    if samples.size == 0 or not np.isfinite(samples).all() or np.max(np.abs(samples)) > 10:
        raise ValueError('Invalid or empty audio samples')
    return samples.astype(np.float32)


def audio_chunks(samples: Any, max_seconds: int = 28) -> Iterator[tuple[int,int]]:
    if not 5 <= max_seconds <= 28:
        raise ValueError('Audio chunk size outside supported bounds')
    np = importlib.import_module('numpy')
    cursor = 0
    while cursor < len(samples):
        stop = min(cursor + max_seconds * 16000, len(samples))
        if stop < len(samples):
            # Choose a low-energy 100ms boundary in the last four seconds, to
            # reduce clipped words without overlapping or duplicated evidence.
            first = max(cursor + (max_seconds - 4) * 16000, stop - 4 * 16000)
            choices = [(float(np.mean(samples[i:i+1600]**2)),i+800) for i in range(first,stop-1600,1600)]
            if choices:
                stop = min(choices)[1]
        yield cursor,stop
        cursor = stop


def handler(context: dict[str,Any]) -> Iterator[dict[str,Any]]:
    try:
        if context['work']['stage_key'] != 'extract:audio' or context['work']['pipeline_version'] != 'screening-v1':
            raise ValueError('Wrong audio stage/version')
        value = StageInput.model_validate(context['input'])
        if value.input_kind != 'audio' or not value.attachment_id or not context.get('source_path'):
            raise ValueError('No private original audio')
        samples = decode(Path(context['source_path']), min(600,value.duration_seconds or 600))
        np = importlib.import_module('numpy')
        checkpoint = value.checkpoint or {}
        bundle = EvidenceBundle.model_validate(checkpoint['bundle']) if checkpoint.get('bundle') else EvidenceBundle(evidence=list(value.inherited_evidence),
            warnings=['audio_transcript_requires_review','audio_times_are_chunk_ranges_not_word_alignment'])
        completed = int(checkpoint.get('completed_chunks',0))
        model = None
        for index,(start,stop) in enumerate(audio_chunks(samples, 10 if value.preferred_language == 'or' else 28)):
            if index < completed:
                continue
            part = samples[start:stop]
            if float(np.sqrt(np.mean(part**2))) < .002:
                bundle.warnings = list(dict.fromkeys([*bundle.warnings,'audio_silent_chunk_omitted']))
            else:
                if model is None:
                    model = LocalSpeech(value.preferred_language)
                transcript,language = model.transcribe(part,value.preferred_language)
                if transcript:
                    bundle.evidence.append(AudioEvidence(id=uuid5(value.input_revision_id,f'audio-chunk-v1:{start}:{stop}'),
                        submission_id=value.submission_id,input_revision_id=value.input_revision_id,
                        attachment_id=value.attachment_id,start_seconds=start/16000,end_seconds=stop/16000,
                        original_text=transcript,language=language,transcription_uncertain=True))
            yield {'checkpoint':{'completed_chunks':index+1,'bundle':bundle.model_dump(mode='json')}}
        if len(bundle.evidence) == len(value.inherited_evidence):
            yield {'failure':{'code':'needs_review'}}
            return
        yield {'publish':bundle.model_dump(mode='json')}
    except ModelUnavailable:
        yield {'failure':{'code':'model_access_denied'}}
    except (ValueError,KeyError):
        yield {'failure':{'code':'needs_review'}}
