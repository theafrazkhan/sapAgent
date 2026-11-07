"""Typed public API boundary; existing Node services own SQL/import transactions."""
import os
import json
from typing import Literal
from uuid import UUID
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, Field

app = FastAPI(title='Smart Factory API', version='0.2.0', description='Authenticated manufacturing evidence API. Sign in through the dashboard first. Tenant and membership are resolved from the session; no operation accepts a tenant ID.', docs_url='/docs', root_path='/backend')
ORIGIN = os.getenv('APP_URL', 'http://localhost:3000')
UPSTREAM = os.getenv('APPLICATION_URL', 'http://127.0.0.1:3000')

class ToolRequest(BaseModel):
    class Config:
        extra = 'forbid'
    snapshotId: UUID
    name: Literal['get_dashboard_summary','list_orders','get_order_details','list_components','list_procurement','list_inspections','get_capacity']
    arguments: dict = Field(default_factory=dict, description='Validated against the named tool schema from GET /tools.')

session_security=APIKeyCookie(name='factory_session',auto_error=False)

async def forward(request: Request, path: str, method='GET', body=None, params=None):
    cookie=request.headers.get('cookie','')
    if not cookie:
        raise HTTPException(401,'A signed-in workspace session is required')
    async with httpx.AsyncClient(timeout=100) as client:
        response=await client.request(method, UPSTREAM+'/api/'+path, headers={'cookie':cookie,'origin':ORIGIN}, json=body, params=params)
    if response.status_code>=400:
        raise HTTPException(response.status_code,response.json().get('error','Request failed'))
    return response.json()

@app.get('/health', tags=['Operations'])
def health():
    return {'status':'ok','version':'0.2.0'}

@app.get('/dashboard', tags=['Dashboard'], summary='Get the selected or latest complete snapshot and deterministic charts')
async def dashboard(request:Request,snapshot:UUID|None=None):
    return await forward(request,'overview',params={'snapshot':str(snapshot)} if snapshot else {})

@app.get('/records', tags=['Evidence'], summary='Search paginated source records; original IDs and units are preserved')
async def records(request:Request,snapshot:UUID,section:Literal['orders','components','procurement','inspections','capacity','sales'],q:str= '',offset:int=0):
    if len(q)>120 or not 0<=offset<=250000: raise HTTPException(422,'Invalid search bounds')
    return await forward(request,'records',params={'snapshot':str(snapshot),'section':section,'q':q,'offset':offset})

@app.get('/orders/{order_id}', tags=['Evidence'])
async def order(request:Request,order_id:str,snapshot:UUID):
    return await forward(request,'order',params={'snapshot':str(snapshot),'id':order_id})

@app.get('/tools', tags=['Agent'], summary='Strict JSON schemas and semantics for every available agent tool')
async def tools(request:Request):
    return await forward(request,'tools')

@app.post('/tools/execute', tags=['Agent'], summary='Execute a bounded, authenticated, read-only evidence tool')
async def execute(request:Request,body:ToolRequest, session: str | None = Depends(session_security)):
    return await forward(request,'tools/execute','POST',json.loads(body.json()))
