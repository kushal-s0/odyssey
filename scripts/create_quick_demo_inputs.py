"""Small fictional text-layer PDFs; preserve the original and benchmark inputs."""
import hashlib
import json
import re
import textwrap
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    'tea-positive': (
        'I propose a tea stall for office workers in Pune, with pre-order pickup before work. '
        'I spoke to 30 workers; 18 said they would consider buying, but I have no confirmed orders. '
        'Startup investment is INR 20000, own funds INR 12000 and requested loan INR 8000; '
        'the selling price is INR 10 per cup. Estimated revenue is INR 30000 per month '
        'and expenses INR 22000 per month; profit is not yet verified.'),
    'tea-loss': (
        'I plan a tea stall for office workers in Pune. I spoke to 30 workers and 28 said they '
        'would not buy because three stalls already serve them; I have no orders and no price '
        'or service advantage. Startup investment is INR 50000, own funds INR 1000 and '
        'requested loan INR 0. Revenue is INR 20000 per month and expenses INR 28000 per month.'),
}


def write_pdf(path: Path, source: str) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
        NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({
        NameObject('/F1'): writer._add_object(font)})})
    # No decorative headings, instructions, empty tables or images in the source.
    # Render the same complete paragraph as the .txt companion, without rewriting.
    # Keep complete money clauses/periods together, and start each sentence on
    # its own line: a dangling "I" or a detached expense amount is a poor source
    # segment. This changes only line wrapping, never the words or figures.
    monetary = re.compile(r'(?:(?:startup )?investment|own funds|requested loan|'
        r'(?:the )?selling price|(?:estimated )?revenue|(?:and )?expenses)'
        r'(?: is)? INR \d+(?: per (?:cup|month))?', re.I)
    lines = []
    for sentence in re.split(r'(?<=[.!?])\s+', source):
        protected = monetary.sub(lambda match: match[0].replace(' ', '~'), sentence)
        lines.extend(line.replace('~', ' ') for line in textwrap.wrap(protected,
            width=88, break_long_words=False, break_on_hyphens=False))
    encoded = ['BT /F1 10 Tf 44 744 Td 16 TL']
    for line in lines:
        escaped = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        encoded.append(f'({escaped}) Tj T*')
    encoded.append('ET')
    stream = DecodedStreamObject()
    stream.set_data('\n'.join(encoded).encode('ascii'))
    page[NameObject('/Contents')] = writer._add_object(stream)
    writer.write(path)


def main() -> None:
    target = ROOT/'input/quick-demo'
    target.mkdir(parents=True, exist_ok=True)
    artifacts = []
    for name, source in CASES.items():
        text = target/(name+'-en.txt')
        text.write_text(source+'\n', encoding='utf-8')
        write_pdf(target/(name+'-en.pdf'), source)
        for path in [text, target/(name+'-en.pdf')]:
            data = path.read_bytes()
            artifacts.append({'path': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    (target/'manifest.json').write_text(json.dumps({'synthetic': True,
        'scope': 'Compact demo inputs; authored expectations, not new model-evaluation results.',
        'artifacts': artifacts, 'expected_arithmetic': {
            'tea-positive': {'funding_total': '20000.00', 'operating_surplus_per_month': '8000.00'},
            'tea-loss': {'funding_gap': '49000.00', 'operating_surplus_per_month': '-8000.00'}},
        'note': 'Positive has useful self-reported detail, not verified success. Negative must expose risks; unknown must not become zero.'}, indent=2)+'\n', encoding='utf-8')
    print('Created four compact fictional inputs and their separate hash manifest; existing inputs unchanged.')


if __name__ == '__main__':
    main()
