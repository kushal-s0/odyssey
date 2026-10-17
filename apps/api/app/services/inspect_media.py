"""Isolated upload parser. Input path/limits only; no environment credentials."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def inspect(path: Path, expected: str, max_pages: int, max_seconds: int) -> dict[str, object]:
    if sys.platform != 'win32':
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
        resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    with path.open('rb') as source:
        header = source.read(32)
    if header.startswith(b'%PDF-'):
        if expected != 'application/pdf':
            raise ValueError('type_mismatch')
        from pypdf import PdfReader
        reader = PdfReader(str(path), strict=True)
        if reader.is_encrypted:
            raise ValueError('encrypted_pdf')
        pages = len(reader.pages)
        if not 1 <= pages <= max_pages:
            raise ValueError('pdf_page_limit')
        # Do not execute actions, follow links or decompress page images in the API.
        return {'kind': 'pdf', 'media_type': 'application/pdf', 'pages': pages, 'duration_seconds': None}
    if header.startswith(b'OggS'):
        container_format, allowed = 'ogg', {'audio/ogg'}
    elif len(header) >= 12 and header[4:8] == b'ftyp':
        container_format, allowed = 'mov', {'audio/mp4', 'video/mp4'}
    elif header.startswith(b'\x1aE\xdf\xa3'):
        container_format, allowed = 'matroska', {'audio/webm'}
    elif header.startswith(b'RIFF') and header[8:12] == b'WAVE':
        container_format, allowed = 'wav', {'audio/wav'}
    elif header.startswith(b'ID3') or (len(header) > 1 and header[0] == 255 and header[1] & 224 == 224):
        container_format, allowed = 'mp3', {'audio/mpeg'}
    else:
        raise ValueError('unsupported_signature')
    if expected not in allowed:
        raise ValueError('type_mismatch')
    import av
    with path.open('rb') as source, av.open(source, mode='r', format=container_format,
            options={'protocol_whitelist': 'file,pipe', 'enable_drefs': '0', 'use_absolute_path': '0'}) as container:
        if len(container.streams.audio) != 1:
            raise ValueError('one_audio_stream_required')
        stream = container.streams.audio[0]
        stream.codec_context.thread_count = 1
        seconds = 0.0
        frames = 0
        start_time = None
        for frame in container.decode(stream):
            if not frame.sample_rate or not 8000 <= frame.sample_rate <= 96000 or len(frame.layout.channels) > 8:
                raise ValueError('unsupported_audio_parameters')
            seconds += frame.samples / frame.sample_rate
            frames += 1
            timestamp = float(frame.time) if frame.time is not None else seconds
            if start_time is None:
                start_time = timestamp
            if seconds > max_seconds or timestamp - start_time > max_seconds:
                raise ValueError('audio_duration_limit')
        if not frames or seconds <= 0:
            raise ValueError('empty_audio')
        return {'kind': 'audio', 'media_type': expected, 'pages': None, 'duration_seconds': round(seconds, 3)}
    raise ValueError('invalid_container')


if __name__ == '__main__':
    try:
        result = inspect(Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
        print(json.dumps(result))
    except Exception:
        # Never echo malformed source bytes, filenames, parser messages or paths.
        print('{"error":"invalid_or_unsupported_media"}')
        raise SystemExit(1) from None
