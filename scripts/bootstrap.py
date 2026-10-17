"""Reproducible local setup; reuse the existing CUDA environment and model cache."""
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    uv = shutil.which('uv')
    npm = shutil.which('npm.cmd' if os.name=='nt' else 'npm')
    if not uv or not npm:
        raise SystemExit('Install uv and Node.js 22/npm first; see README.')
    os.environ['UV_CACHE_DIR'] = str(ROOT/'.cache/uv')
    api, model = [ROOT/name/'Scripts/python.exe' for name in ('.venv', '.venv-model')]
    for environment, executable in (('.venv', api), ('.venv-model', model)):
        if not executable.exists():
            run([uv, 'venv', environment, '--python', '3.11'])
    prefix = [uv, '--system-certs', 'pip', 'install']
    run([*prefix, '--python', str(api), '-r', 'apps/api/requirements-dev.lock'])
    run([*prefix, '--python', str(api), '--no-deps', '-e', 'apps/api'])
    present = subprocess.run([str(model), '-c', 'import torch, torchvision; assert torch.cuda.is_available()'],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if present.returncode:
        run([*prefix, '--python', str(model), 'torch==2.9.1', 'torchvision==0.24.1',
             '--index-url', 'https://download.pytorch.org/whl/cu128'])
    run([*prefix, '--python', str(model), '-r', 'apps/api/requirements.lock', '-r', 'models/requirements-text.txt'])
    run([*prefix, '--python', str(model), '--no-deps', '-e', 'apps/api'])
    run([npm, '--prefix', 'apps/web', 'ci', '--no-fund', '--no-audit'])
    # Configure reports missing values but prepares the canonical file regardless.
    subprocess.run([str(api), '-B', 'scripts/configure.py'], cwd=ROOT, check=False)
    run([str(model), '-B', 'scripts/download_models.py', '--artifacts', 'qwen', 'embedding'])
    print('Dependencies/models prepared. Fill the two Supabase secrets in root .env.local, then run start.cmd.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError:
        raise SystemExit('Setup stopped at the failed step. Existing environments/cache were preserved; fix the error and rerun.') from None
