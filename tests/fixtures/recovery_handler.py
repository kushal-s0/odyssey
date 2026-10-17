"""Synthetic process-recovery handler; never used as application inference."""
import os
import time


def recover(context):
    assert context['work']['pipeline_version'] == 'orchestration-probe-v1'
    assert not any(key in os.environ for key in (
        'WORKER_CREDENTIAL','DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STAGE_CAPABILITY_SIGNING_KEY'))
    if not context['input'].get('checkpoint'):
        yield {'checkpoint': {'probe':'durable-before-termination', 'inference':False}}
        time.sleep(60)
    yield {'publish': {'probe':'recovered-checkpoint','inference':False}}


def hang(context):
    assert context['work']['pipeline_version'] == 'orchestration-probe-v1'
    time.sleep(60)
    yield {'publish': {'unexpected':True}}


def stream_probe(context):
    import sys
    # Model libraries probe stdio when imported after the orphan watcher starts.
    sys.stdin.isatty()
    yield {'publish': {'stdio_probe':True,'inference':False,'text':context['input']['source_text']}}
