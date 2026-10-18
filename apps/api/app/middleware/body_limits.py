"""Bound JSON before parsing, including chunked requests and slow bodies."""
import asyncio
import time
from uuid import uuid4

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class JsonBodyLimits:
    def __init__(self, app: ASGIApp) -> None:
        self.app=app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type']!='http' or scope.get('method') not in {'POST','PUT','PATCH','DELETE'}:
            await self.app(scope,receive,send)
            return
        # Original-file streaming has separate authenticated byte/time bounds.
        if scope.get('method')=='PUT' and scope['path'].startswith('/v1/uploads/') and scope['path'].endswith('/complete'):
            await self.app(scope,receive,send)
            return
        maximum=3*1024*1024 if scope['path'].startswith('/internal/') else 256*1024
        headers=dict(scope.get('headers',[]))
        length=headers.get(b'content-length')
        if length and (not length.isdigit() or int(length)>maximum):
            await JSONResponse(status_code=413,content={'code':'request_too_large',
                'message':'Request exceeds the supported JSON size limit','retryable':False,
                'request_id':scope.get('state',{}).get('request_id',str(uuid4()))})(scope,receive,send)
            return
        count=0
        deadline=time.monotonic()+15
        async def bounded_receive() -> Message:
            nonlocal count
            try:
                message=await asyncio.wait_for(receive(),max(.001,deadline-time.monotonic()))
            except TimeoutError:
                raise HTTPException(408,'Request body timed out; retry with a complete request') from None
            if message['type']=='http.request':
                count+=len(message.get('body',b''))
                if count>maximum:
                    raise HTTPException(413,'Request exceeds the supported JSON size limit')
            return message
        await self.app(scope,bounded_receive,send)
