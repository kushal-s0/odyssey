"""Start the existing Supabase-backed app and owned worker; no demo login bypass."""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time

from configure import REQUIRED, ROOT, configure


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview', action='store_true', help='Frontend/API preview only; no model worker')
    args = parser.parse_args()
    values = configure()
    missing = [name for name in REQUIRED if not values.get(name)]
    if missing and not args.preview:
        raise SystemExit('Fill '+', '.join(missing)+' in root .env.local. Use start.cmd --preview for the landing page.')
    model_python = ROOT/'.venv-model/Scripts/python.exe'
    node = shutil.which('node')
    vite = ROOT/'apps/web/node_modules/vite/bin/vite.js'
    if not node or not vite.exists() or (not args.preview and not model_python.exists()):
        raise SystemExit('Dependencies are missing. Follow README setup; existing environments are reused.')
    for port in (8000, 5173):
        with socket.socket() as check:
            if check.connect_ex(('127.0.0.1', port)) == 0:
                raise SystemExit(f'Port {port} is already occupied. Stop only your earlier app process, then retry.')
    logs = ROOT/'.local/run-logs'
    logs.mkdir(parents=True, exist_ok=True)
    children: list[subprocess.Popen[bytes]] = []
    handles = []
    base = dict(os.environ)
    base['PYTHONIOENCODING'] = 'utf-8'
    commands = [('api', [sys.executable, '-B', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], base),
                ('web', [node, str(vite), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], base)]
    if not args.preview:
        allowed = {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','CUDA_PATH'}
        worker_env = {key:value for key,value in base.items() if key.upper() in allowed}
        worker_env.update({key:values[key] or '' for key in ('WORKER_API_URL','WORKER_ID','WORKER_CREDENTIAL','HF_TOKEN') if key in values})
        worker_env['PYTHONIOENCODING'] = 'utf-8'
        commands.append(('worker', [str(model_python), '-B', '-m', 'app.worker', '--allow-loopback',
            '--handler', 'app.pipeline.run:handler', '--stages', 'extract:text', 'translate', 'structure', 'assess',
            '--continuous', '--stage-seconds', '240'], worker_env))
    try:
        for name, command, environment in commands:
            output = (logs/f'{name}.log').open('wb')
            handles.append(output)
            children.append(subprocess.Popen(command, cwd=ROOT if name!='web' else ROOT/'apps/web',
                env=environment, stdout=output, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0))
        print('Open http://127.0.0.1:5173 | Supabase login only | Ctrl+C stops these app processes.', flush=True)
        print('Logs: .local/run-logs. '+('Preview only; no model worker.' if args.preview else 'Owned worker stays available until you stop the app.'), flush=True)
        while True:
            for index, process in enumerate(children):
                if process.poll() is not None:
                    raise RuntimeError(f'{commands[index][0]} stopped; inspect its local log and restart start.cmd')
            time.sleep(.5)
    except KeyboardInterrupt:
        print('\nStopping the app; saved database records are retained.')
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    finally:
        for process in reversed(children):
            if process.poll() is None:
                process.terminate()
        for process in children:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        for handle in handles:
            handle.close()


if __name__ == '__main__':
    main()
