from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from threading import BoundedSemaphore

from fastapi import HTTPException

from ..config import Settings

_parser_slot = BoundedSemaphore(1)


def inspect_media(path: Path, expected: str, settings: Settings) -> dict[str, Any]:
    # Bound parser time/memory separately; source libraries never inherit service credentials.
    environment = {name: value for name, value in os.environ.items()
                   if name.upper() in {'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'PATH'}}
    if not _parser_slot.acquire(blocking=False):
        raise HTTPException(429, 'Another file is being validated; retry shortly')
    try:
        result = subprocess.run([sys.executable, '-I', str(Path(__file__).with_name('inspect_media.py')),
            str(path), expected, str(settings.max_pdf_pages), str(settings.max_audio_seconds)],
            env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20, check=False)
        if result.returncode or len(result.stdout) > 4096:
            raise ValueError('Invalid media')
        metadata: dict[str, Any] = json.loads(result.stdout)
        if metadata.get('kind') not in {'pdf', 'audio'}:
            raise ValueError('Invalid parser result')
        return metadata
    except (subprocess.TimeoutExpired, ValueError, OSError):
        raise HTTPException(422, 'File could not be validated. Use an unencrypted PDF within the page limit or a supported recording within the time limit.') from None
    finally:
        _parser_slot.release()
