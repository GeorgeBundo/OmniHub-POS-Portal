'use strict';

(function installOmniHubQuotationPdf(global) {
  function imageFrom(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The official logo could not be rendered.'));
      image.src = source;
    });
  }

  function ascii(value) {
    return new TextEncoder().encode(value);
  }

  function join(parts, length) {
    const bytes = new Uint8Array(length);
    let offset = 0;
    parts.forEach(part => {
      bytes.set(part, offset);
      offset += part.length;
    });
    return bytes;
  }

  function jpegPdf(dataUrl, pixelWidth, pixelHeight) {
    const binary = atob(String(dataUrl).split(',')[1] || '');
    const jpeg = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) jpeg[index] = binary.charCodeAt(index);

    const parts = [];
    const offsets = [0];
    let length = 0;
    const push = part => {
      const bytes = typeof part === 'string' ? ascii(part) : part;
      parts.push(bytes);
      length += bytes.length;
    };
    const object = (number, body) => {
      offsets[number] = length;
      push(`${number} 0 obj\n${body}\nendobj\n`);
    };

    push('%PDF-1.4\n%OmniHub quotation PDF\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    offsets[4] = length;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    const content = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n';
    object(5, `<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`);
    const xrefOffset = length;
    push('xref\n0 6\n0000000000 65535 f \n');
    for (let number = 1; number <= 5; number += 1) {
      push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
    }
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return join(parts, length);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric'
    }).format(date);
  }

  function money(value, currency) {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`;
  }

  function text(context, value, x, y, options = {}) {
    const { size = 22, weight = 400, color = '#171517', align = 'left', maxWidth } = options;
    context.save();
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'top';
    context.font = `${weight} ${size}px Arial`;
    if (maxWidth) context.fillText(String(value ?? ''), x, y, maxWidth);
    else context.fillText(String(value ?? ''), x, y);
    context.restore();
  }

  function wrapped(context, value, x, y, maxWidth, lineHeight, options = {}) {
    const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    let line = '';
    let cursor = y;
    context.save();
    context.font = `${options.weight || 400} ${options.size || 20}px Arial`;
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        text(context, line, x, cursor, options);
        line = word;
        cursor += lineHeight;
      } else line = candidate;
    });
    if (line) text(context, line, x, cursor, options);
    context.restore();
    return cursor + lineHeight;
  }

  function rule(context, x, y, width, color = '#d2d2d2', height = 1) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  async function createBytes(documentHeader, lines, customer, options = {}) {
    const width = 1240;
    const height = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser cannot create the quotation PDF.');

    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ed161b';
    context.fillRect(1070, 0, 170, 1188);
    context.fillStyle = '#080808';
    context.fillRect(1070, 1198, 170, height - 1198);

    const logo = await imageFrom(options.logoSource);
    context.drawImage(logo, 58, 44, 136, 136);
    context.save();
    context.translate(1155, 1100);
    context.rotate(-Math.PI / 2);
    wrapped(context, 'For premium apparel branding, secure identification solutions, brand identity development, web design, custom stationery, and headwear embellishment.', 0, 0, 950, 23, { size: 18, weight: 500, color: '#fff' });
    context.restore();
    context.save();
    context.translate(1155, 1650);
    context.rotate(-Math.PI / 2);
    text(context, 'OmniHub Solutions', 0, 0, { size: 28, weight: 800, color: '#fff' });
    context.restore();

    text(context, 'QUOTATION', 1000, 66, { size: 72, weight: 900, align: 'right', maxWidth: 770 });
    rule(context, 58, 202, 965, '#ed161b', 12);
    text(context, 'OmniHub Solutions', 58, 246, { size: 25, weight: 800 });
    text(context, '1074 Mkoba 1, Gweru, Zimbabwe', 58, 280, { size: 19 });
    text(context, 'sales@omnihubsolutions.com', 58, 309, { size: 19 });
    text(context, '+263 77 460 6801  |  +263 77 565 2450', 58, 338, { size: 19 });

    [['Quotation No:', documentHeader.document_number], ['Quotation Date:', formatDate(documentHeader.issue_date)], ['Quotation Valid Till:', formatDate(documentHeader.due_date)]].forEach(([key, value], index) => {
      const y = 246 + index * 37;
      text(context, key, 625, y, { size: 19, weight: 700 });
      text(context, value || '—', 1018, y, { size: 19, align: 'right', maxWidth: 230 });
    });

    context.fillStyle = '#ed161b';
    context.fillRect(58, 390, 565, 45);
    text(context, 'QUOTE TO:', 76, 400, { size: 23, weight: 800, color: '#fff' });
    text(context, customer?.name || 'Customer', 62, 457, { size: 28, weight: 800, maxWidth: 550 });
    let customerY = wrapped(context, customer?.address || '', 62, 495, 540, 25, { size: 18 });
    text(context, [customer?.phone, customer?.email].filter(Boolean).join('  |  '), 62, customerY, { size: 18, maxWidth: 550 });

    const tableX = 58;
    const tableWidth = 965;
    const jobY = 570;
    const metadata = documentHeader.metadata || {};
    const headers = ['Salesperson', 'Job #', 'Ship Method', 'Ship Terms', 'Delivery', 'Payment Terms', 'Due Date'];
    const values = [options.salesperson || '', metadata.job_number || '', metadata.shipping_method || 'Collection', metadata.shipping_terms || 'Full', formatDate(metadata.delivery_date || documentHeader.due_date), metadata.payment_terms || 'Full payment', formatDate(documentHeader.due_date)];
    const column = tableWidth / headers.length;
    context.fillStyle = '#1c1a1b';
    context.fillRect(tableX, jobY, tableWidth, 42);
    headers.forEach((header, index) => text(context, header, tableX + column * index + column / 2, jobY + 12, { size: 14, weight: 700, color: '#fff', align: 'center', maxWidth: column - 10 }));
    values.forEach((value, index) => text(context, value || '—', tableX + column * index + column / 2, jobY + 57, { size: 13, align: 'center', maxWidth: column - 10 }));
    rule(context, tableX, jobY + 88, tableWidth);

    const itemY = 690;
    const itemWidths = [70, 465, 90, 170, 170];
    context.fillStyle = '#1c1a1b';
    context.fillRect(tableX, itemY, tableWidth, 48);
    let cursorX = tableX;
    ['#', 'Item Details', 'Qty', 'Unit Price', 'Total'].forEach((header, index) => {
      text(context, header, cursorX + (index === 1 ? 12 : itemWidths[index] / 2), itemY + 13, { size: 17, weight: 700, color: '#fff', align: index === 1 ? 'left' : 'center' });
      cursorX += itemWidths[index];
    });

    const displayRows = Math.max(7, Math.min(18, lines.length));
    const rowHeight = Math.max(31, Math.min(54, Math.floor(500 / displayRows)));
    for (let index = 0; index < displayRows; index += 1) {
      const line = lines[index];
      const y = itemY + 48 + index * rowHeight;
      rule(context, tableX, y + rowHeight - 1, tableWidth);
      if (!line) continue;
      text(context, String(index + 1).padStart(2, '0'), tableX + 35, y + 11, { size: 17, align: 'center' });
      text(context, line.description, tableX + 82, y + 11, { size: 17, maxWidth: 445 });
      text(context, Number(line.quantity), tableX + 580, y + 11, { size: 17, align: 'center' });
      text(context, money(line.unit_price, documentHeader.currency), tableX + 790, y + 11, { size: 17, align: 'right', maxWidth: 155 });
      const total = Number(line.quantity) * Number(line.unit_price) - Number(line.discount || 0);
      text(context, money(total, documentHeader.currency), tableX + 955, y + 11, { size: 17, align: 'right', maxWidth: 155 });
    }

    const lowerY = itemY + 48 + displayRows * rowHeight + 25;
    text(context, 'Payment Details', tableX, lowerY, { size: 19, weight: 800 });
    text(context, '• EcoCash: 0774606801 (George Bundo)', tableX, lowerY + 31, { size: 16 });
    text(context, '• Steward Bank 1051180751 (George Bundo)', tableX, lowerY + 57, { size: 16 });
    text(context, 'Terms & Conditions', tableX, lowerY + 96, { size: 19, weight: 800 });
    text(context, '• Full payment before design work commences.', tableX, lowerY + 127, { size: 15 });
    text(context, '• Complete and clear client details are required.', tableX, lowerY + 151, { size: 15 });
    text(context, '• Late cancellations may incur a 50% fee.', tableX, lowerY + 175, { size: 15 });

    const totalX = 700;
    const totalWidth = 323;
    [['Sub Total:', money(documentHeader.subtotal, documentHeader.currency)], ['Tax:', money(documentHeader.tax_total, documentHeader.currency)], ['Discount:', money(documentHeader.discount_total, documentHeader.currency)], ['Paid:', money(documentHeader.paid_total, documentHeader.currency)]].forEach(([key, value], index) => {
      const y = lowerY + index * 41;
      text(context, key, totalX + 12, y + 9, { size: 18 });
      text(context, value, totalX + totalWidth - 12, y + 9, { size: 18, align: 'right' });
      rule(context, totalX, y + 40, totalWidth);
    });
    const grandY = lowerY + 164;
    context.fillStyle = '#ed161b';
    context.fillRect(totalX, grandY, totalWidth, 50);
    text(context, 'Total', totalX + 12, grandY + 12, { size: 21, weight: 800, color: '#fff' });
    text(context, money(documentHeader.total, documentHeader.currency), totalX + totalWidth - 12, grandY + 12, { size: 21, weight: 800, color: '#fff', align: 'right' });
    text(context, 'Thank You!', 540, 1670, { size: 31, weight: 900, align: 'center' });

    return jpegPdf(canvas.toDataURL('image/jpeg', 0.96), width, height);
  }

  function download(fileName, bytes) {
    if (!(bytes instanceof Uint8Array) || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('Quotation generation did not produce a valid PDF.');
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(fileName || 'OmniHub-Quotation.pdf').toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    const revoke = () => URL.revokeObjectURL(url);
    setTimeout(revoke, 10 * 60 * 1000);
    return { fileName: link.download, url, revoke };
  }

  global.OmniHubQuotationPdf = { createBytes, download };
})(window);
