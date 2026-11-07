"""Load ignored local settings without shell evaluation, then run FastAPI."""
import os
from pathlib import Path
for line in Path('.env.local').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1)
        os.environ.setdefault(key,value.strip().strip('"').strip("'"))
os.execv('.venv/bin/uvicorn',['uvicorn','backend.main:app','--host','127.0.0.1','--port','8000'])
