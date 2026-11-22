const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, PageSizes, rgb } = require('pdf-lib');
const { toEmbeddableImageBytes } = require('../utils/pdfImageBytes');

const PAGE = PageSizes.A4;
const PAGE_WIDTH = PAGE[0];
const PAGE_HEIGHT = PAGE[1];
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 48;
const INK = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.38, 0.4, 0.44);

function resolveFontPath() {
  const candidates = [
    process.env.PROCEDURE_PDF_FONT,
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansTC-Regular.otf'),
    process.platform === 'win32' ? 'C:\\Windows\\Fonts\\kaiu.ttf' : null,
    '/usr/share/fonts/opentype/noto/NotoSansCJKtc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansTC-Regular.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
  ].filter(Boolean);
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function loadFontBytes() {
  const fontPath = resolveFontPath();
  if (!fontPath) {
    const err = new Error('No font is available for procedure PDF export. Set PROCEDURE_PDF_FONT to a Traditional Chinese .ttf or .otf file.');
    err.status = 500;
    throw err;
  }
  return fs.readFileSync(fontPath);
}

function textOf(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '  ');
}

function glyphsFor(fkFont, text) {
  let out = '';
  for (const ch of textOf(text)) {
    if (ch === '\n') {
      out += ch;
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp < 32) continue;
    try {
      const glyph = fkFont.glyphForCodePoint(cp);
      if (glyph && glyph.id) out += ch;
    } catch {
      // Skip characters this font cannot draw.
    }
  }
  return out;
}

function wrapParagraph(text, font, size, maxWidth) {
  const lines = [];
  const paragraphs = textOf(text).split('\n');
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const ch of para) {
      const next = current + ch;
      if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(current);
        current = ch === ' ' ? '' : ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function fileKind(file) {
  const bytes = file?.bytes;
  const mime = String(file?.mime || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (!bytes || !bytes.length) return 'missing';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime === 'image/png' || name.endsWith('.png')) return 'png';
  if (mime === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpeg';
  return 'other';
}

function statusLabel(status) {
  return status === 'published' ? 'Published' : 'Draft';
}

function audienceLabel(procedure) {
  if (procedure.audience === 'user_groups') {
    const names = (procedure.audience_groups || []).map((group) => group.name).filter(Boolean);
    return names.length ? names.join(', ') : 'User groups';
  }
  return 'Everyone';
}

/**
 * Build a real PDF for a procedure. `files` maps image id to
 * { bytes, mime, name }. Images are drawn inline. Attached PDFs are copied
 * in as extra pages. This does not use the browser print dialog.
 */
async function buildProcedurePdf(procedure, files = new Map()) {
  const fontBytes = loadFontBytes();
  const fkFont = fontkit.create(fontBytes);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  let font;
  try {
    font = await doc.embedFont(fontBytes, { subset: true });
  } catch {
    font = await doc.embedFont(fontBytes, { subset: false });
  }

  const title = glyphsFor(fkFont, procedure.name || 'Procedure') || 'Procedure';
  doc.setTitle(title);
  doc.setCreator('BOSS E-Process');
  doc.setProducer('BOSS');

  let page = doc.addPage(PAGE);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let pendingNewPage = false;
  const ownPages = new Set([page]);
  const contentWidth = PAGE_WIDTH - MARGIN_X * 2;

  function newPage() {
    page = doc.addPage(PAGE);
    ownPages.add(page);
    y = PAGE_HEIGHT - MARGIN_TOP;
    pendingNewPage = false;
  }

  function ensure(height) {
    if (pendingNewPage || y - height < MARGIN_BOTTOM) newPage();
  }

  function drawLines(text, { size, color = INK, indent = 0, gap = 4, after = 8 } = {}) {
    const clean = glyphsFor(fkFont, text);
    const width = Math.max(40, contentWidth - indent);
    const lines = wrapParagraph(clean, font, size, width);
    const step = size + gap;
    if (!lines.length) return;
    for (const line of lines) {
      ensure(step);
      if (line) {
        page.drawText(line, {
          x: MARGIN_X + indent,
          y: y - size,
          size,
          font,
          color,
        });
      }
      y -= step;
    }
    y -= Math.max(0, after - gap);
  }

  drawLines(procedure.name || 'Procedure', { size: 18, after: 6 });
  const meta = [
    procedure.group_name || 'Work group',
    statusLabel(procedure.status),
    procedure.status === 'published' ? audienceLabel(procedure) : null,
  ].filter(Boolean).join('  ·  ');
  drawLines(meta, { size: 10, color: MUTED, after: 10 });
  if (String(procedure.description || '').trim()) {
    drawLines(procedure.description, { size: 11, after: 14 });
  }

  const steps = procedure.steps || [];
  if (!steps.length) {
    drawLines('This procedure has no steps yet.', { size: 11, color: MUTED, after: 0 });
  }

  async function drawImage(file, indent) {
    const kind = fileKind(file);
    const label = file?.name || 'Attachment';
    if (kind === 'missing') {
      drawLines(`Missing file: ${label}`, { size: 10, color: MUTED, indent, after: 8 });
      return;
    }
    if (kind === 'pdf') {
      drawLines(`Attached PDF: ${label}`, { size: 10, color: MUTED, indent, after: 8 });
      try {
        const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
        const copied = await doc.copyPages(src, src.getPageIndices());
        copied.forEach((copiedPage) => doc.addPage(copiedPage));
        pendingNewPage = true;
      } catch {
        drawLines(`Could not embed ${label}.`, { size: 10, color: MUTED, indent, after: 8 });
      }
      return;
    }
    if (kind !== 'png' && kind !== 'jpeg') {
      drawLines(`Attached file: ${label}`, { size: 10, color: MUTED, indent, after: 8 });
      return;
    }
    try {
      const bytes = toEmbeddableImageBytes(file.bytes);
      const image = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxW = Math.max(40, contentWidth - indent);
      const maxH = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      ensure(height + 8);
      page.drawImage(image, {
        x: MARGIN_X + indent,
        y: y - height,
        width,
        height,
      });
      y -= height + 6;
      drawLines(label, { size: 9, color: MUTED, indent, after: 10 });
    } catch {
      drawLines(`Could not embed ${label}.`, { size: 10, color: MUTED, indent, after: 8 });
    }
  }

  async function drawStep(step, number, indent) {
    drawLines(`${number}   ${step.title || 'Step'}`, { size: 13, indent, after: 4 });
    if (String(step.body || '').trim()) {
      drawLines(step.body, { size: 11, indent, after: 8 });
    }
    for (const image of step.images || []) {
      const file = files.get(image.id) || { name: image.file_name, bytes: null, mime: image.mime_type };
      await drawImage(file, indent);
    }
    const children = step.children || [];
    for (let index = 0; index < children.length; index += 1) {
      await drawStep(children[index], `${number}.${index + 1}`, indent + 16);
    }
    y -= 6;
  }

  for (let index = 0; index < steps.length; index += 1) {
    await drawStep(steps[index], String(index + 1), 0);
  }

  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((item, index) => {
    if (!ownPages.has(item)) return;
    const label = `${index + 1} / ${total}`;
    const size = 9;
    const width = font.widthOfTextAtSize(label, size);
    item.drawText(label, {
      x: PAGE_WIDTH - MARGIN_X - width,
      y: 24,
      size,
      font,
      color: MUTED,
    });
  });

  return Buffer.from(await doc.save());
}

module.exports = {
  buildProcedurePdf,
};
