"""Synthetic durable-orchestration load only; never selected for application inference."""
import time


def run(context):
    assert context['work']['pipeline_version']=='scale-fixture-v1'
    if not context['input'].get('checkpoint'):
        yield {'checkpoint':{'synthetic':True,'inference':False}}
        time.sleep(2)
    yield {'publish':{'synthetic':True,'inference':False,'recovered':True}}
