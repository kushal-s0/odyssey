from fastapi import APIRouter

from ..auth.access import ActorDep, ActorView

router = APIRouter(prefix='/v1', tags=['identity'])


@router.get('/me', response_model=ActorView)
def me(actor: ActorDep) -> ActorView:
    return actor
