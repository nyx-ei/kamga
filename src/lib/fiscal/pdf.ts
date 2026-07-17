import 'server-only';

type PdfLine = {
  size?: number;
  text: string;
};

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

export function createSimplePdf(lines: PdfLine[]): Buffer {
  const objects: string[] = [];
  const contentLines: string[] = ['BT', '/F1 11 Tf', '50 770 Td', '14 TL'];

  for (const line of lines) {
    if (line.size !== undefined) {
      contentLines.push(`/F1 ${line.size} Tf`);
    }

    contentLines.push(`(${escapePdfText(line.text)}) Tj`, 'T*');
  }

  contentLines.push('ET');

  const content = contentLines.join('\n');
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`);

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
    chunks.push(object);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');

  for (const offset of offsets.slice(1)) {
    chunks.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
  }

  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(chunks.join(''), 'utf8');
}
