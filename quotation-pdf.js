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

  async function download(fileName, bytes) {
    if (!(bytes instanceof Uint8Array) || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('Quotation generation did not produce a valid PDF.');
    }

    const safeName = String(fileName || 'OmniHub-Quotation.pdf').toLowerCase().endsWith('.pdf')
      ? fileName
      : `${fileName}.pdf`;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const mobile = isMobileBrowser();
    const revoke = () => URL.revokeObjectURL(url);

    if (mobile && typeof File !== 'undefined' && navigator.canShare && navigator.share) {
      const file = new File([blob], safeName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: safeName.replace(/\.pdf$/i, ''),
            text: 'OmniHub quotation PDF'
          });
          setTimeout(revoke, 60 * 1000);
          return { fileName: safeName, url: null, revoke, mobile, shared: true };
        } catch (error) {
          if (error?.name !== 'AbortError') throw error;
        }
      }
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', `Download ${safeName}`);
    document.body.appendChild(link);
    if (!mobile) link.click();
    link.remove();

    setTimeout(revoke, mobile ? 30 * 60 * 1000 : 10 * 60 * 1000);
    return { fileName: safeName, url, revoke, mobile, shared: false };
  }

  global.OmniHubQuotationPdf = { createBytes, download };
})(window);

(function installOmniHubFinanceV277Compat(global) {
  const install = () => {
    try {
      const note = document.querySelector('#financePage .allocation-note');
      if (note) {
        note.innerHTML = '<strong>Actual P/L:</strong> Revenue − cost of sales − recorded expenses. <strong>Allocation plan per sale:</strong> 10% tithe, 10% repairs, 10% rent and electricity, 20% expense reserve, 10% emergency fund and 10% savings. Cost of Sale remains the existing item-cost calculation. Any balance after Cost of Sale and the fixed reserves is shown separately. Allocations are planning reserves and are not counted as actual expenses until an expense is recorded.';
      }

      const updateHeader = () => {
        const row = document.querySelector('#financeSaleRows')?.closest('table')?.querySelector('thead tr');
        if (row) {
          row.innerHTML = '<th>Receipt / date</th><th>Till</th><th>Status</th><th>Revenue</th><th>Cost of sale</th><th>Cost %</th><th>Tithe 10%</th><th>Repairs 10%</th><th>Rent &amp; electricity 10%</th><th>Expense reserve 20%</th><th>Emergency fund 10%</th><th>Savings 10%</th><th>Remaining</th>';
        }
      };
      updateHeader();

      global.financeCard = function financeCardV277(currency, summary) {
        const card = document.createElement('article');
        card.className = 'finance-currency';
        const profit = Number(summary.profit_loss || 0);
        const estimate = Number(summary.estimated_cost_sales || 0);
        const remaining = Number(summary.post_allocation_balance || 0);
        card.innerHTML = `<h3>${currency} · ${Number(summary.transactions || 0)} transaction(s)</h3><div class="finance-kpis"><div class="finance-kpi"><span>Revenue</span><strong>${money(summary.revenue, currency)}</strong></div><div class="finance-kpi"><span>Cost of sales</span><strong>${money(summary.cost_of_sales, currency)}</strong></div><div class="finance-kpi"><span>Recorded expense</span><strong>${money(summary.operating_expenses, currency)}</strong></div><div class="finance-kpi"><span>Total expense</span><strong>${money(summary.total_expenses, currency)}</strong></div><div class="finance-kpi ${profit < 0 ? 'loss' : 'profit'}"><span>Profit / loss</span><strong>${money(profit, currency)}</strong></div><div class="finance-kpi"><span>Tithe · 10%</span><strong>${money(summary.tithes, currency)}</strong></div><div class="finance-kpi"><span>Repairs · 10%</span><strong>${money(summary.repairs_maintenance, currency)}</strong></div><div class="finance-kpi"><span>Rent &amp; electricity · 10%</span><strong>${money(summary.rent_electricity, currency)}</strong></div><div class="finance-kpi"><span>Expense reserve · 20%</span><strong>${money(summary.expense_reserve, currency)}</strong></div><div class="finance-kpi"><span>Emergency fund · 10%</span><strong>${money(summary.emergency_fund, currency)}</strong></div><div class="finance-kpi"><span>Savings · 10%</span><strong>${money(summary.savings, currency)}</strong></div><div class="finance-kpi ${remaining < 0 ? 'loss' : ''}"><span>Remaining after reserves &amp; CoS</span><strong>${money(remaining, currency)}</strong></div></div>${estimate ? `<div class="cost-estimate" style="margin-top:11px">${estimate} historical sale(s) use the current catalogue cost estimate. New sales retain their original unit cost.</div>` : ''}`;
        return card;
      };

      global.renderFinance = function renderFinanceV277(data) {
        financeData = data;
        updateHeader();
        const summary = $('financeSummary');
        summary.innerHTML = '';
        ['USD', 'ZiG'].forEach(currency => summary.appendChild(global.financeCard(currency, data.summary?.[currency] || {})));
        $('financePeriodLabel').textContent = `${String(data.period || financePeriod).replace(/^./, value => value.toUpperCase())} · ${data.from} to ${data.to}`;
        document.querySelectorAll('[data-finance-period]').forEach(button => button.classList.toggle('active', button.dataset.financePeriod === financePeriod));

        const sales = $('financeSaleRows');
        sales.innerHTML = '';
        financeExportRows = [
          ['Period', data.from + ' to ' + data.to],
          [],
          ['Currency', 'Revenue', 'Cost of sales', 'Recorded expenses', 'Total expenses', 'Profit/Loss', 'Tithe 10%', 'Repairs 10%', 'Rent & electricity 10%', 'Expense reserve 20%', 'Emergency fund 10%', 'Savings 10%', 'Remaining after reserves & CoS']
        ];
        ['USD', 'ZiG'].forEach(currency => {
          const item = data.summary?.[currency] || {};
          financeExportRows.push([currency, item.revenue || 0, item.cost_of_sales || 0, item.operating_expenses || 0, item.total_expenses || 0, item.profit_loss || 0, item.tithes || 0, item.repairs_maintenance || 0, item.rent_electricity || 0, item.expense_reserve || 0, item.emergency_fund || 0, item.savings || 0, item.post_allocation_balance || 0]);
        });
        financeExportRows.push([], ['Receipt', 'Date', 'Till', 'Status', 'Currency', 'Revenue', 'Cost of sale', 'Cost %', 'Tithe 10%', 'Repairs 10%', 'Rent & electricity 10%', 'Expense reserve 20%', 'Emergency fund 10%', 'Savings 10%', 'Remaining after reserves & CoS', 'Cost basis']);

        (data.sales || []).forEach(sale => {
          const tr = document.createElement('tr');
          const receipt = td('');
          receipt.append(document.createTextNode(sale.receipt_number || '—'), document.createElement('br'), document.createTextNode(new Date(sale.occurred_at).toLocaleString()));
          tr.appendChild(receipt);
          tr.appendChild(td(sale.till_code));
          const statusCell = td('');
          const badge = document.createElement('span');
          badge.className = 'finance-status ' + sale.status;
          badge.textContent = sale.status;
          statusCell.appendChild(badge);
          tr.appendChild(statusCell);
          tr.appendChild(td(money(sale.revenue, sale.currency)));
          const cost = td(money(sale.cost_of_sales, sale.currency));
          if (sale.cost_is_estimate) {
            cost.appendChild(document.createElement('br'));
            const estimateNote = document.createElement('span');
            estimateNote.className = 'cost-estimate';
            estimateNote.textContent = 'Current cost estimate';
            cost.appendChild(estimateNote);
          }
          tr.appendChild(cost);
          tr.appendChild(td(Number(sale.cost_percentage || 0).toFixed(2) + '%'));
          tr.appendChild(td(money(sale.tithes, sale.currency)));
          tr.appendChild(td(money(sale.repairs_maintenance, sale.currency)));
          tr.appendChild(td(money(sale.rent_electricity, sale.currency)));
          tr.appendChild(td(money(sale.expense_reserve, sale.currency)));
          tr.appendChild(td(money(sale.emergency_fund, sale.currency)));
          tr.appendChild(td(money(sale.savings, sale.currency)));
          const remaining = td(money(sale.post_allocation_balance, sale.currency));
          if (Number(sale.post_allocation_balance) < 0) remaining.className = 'danger-text';
          tr.appendChild(remaining);
          sales.appendChild(tr);
          financeExportRows.push([sale.receipt_number, sale.occurred_at, sale.till_code, sale.status, sale.currency, sale.revenue, sale.cost_of_sales, sale.cost_percentage, sale.tithes, sale.repairs_maintenance, sale.rent_electricity, sale.expense_reserve, sale.emergency_fund, sale.savings, sale.post_allocation_balance, sale.cost_is_estimate ? 'Current catalogue estimate' : 'Sale-time cost']);
        });

        if (!(data.sales || []).length) {
          const tr = document.createElement('tr');
          const cell = td('No sales in this period.');
          cell.colSpan = 13;
          cell.className = 'inventory-empty';
          tr.appendChild(cell);
          sales.appendChild(tr);
        }

        const expenses = $('financeExpenseRows');
        expenses.innerHTML = '';
        financeExportRows.push([], ['Expense date', 'Number', 'Description', 'Category', 'Method', 'Currency', 'Amount', 'Reference']);
        (data.expenses || []).forEach(expense => {
          const tr = document.createElement('tr');
          [expense.occurred_on, `${expense.expense_number} · ${expense.description}`, expense.category, String(expense.payment_method || '').replaceAll('_', ' '), expense.currency, money(expense.amount, expense.currency), expense.reference || '—'].forEach(value => tr.appendChild(td(value)));
          expenses.appendChild(tr);
          financeExportRows.push([expense.occurred_on, expense.expense_number, expense.description, expense.category, expense.payment_method, expense.currency, expense.amount, expense.reference || '']);
        });
        if (!(data.expenses || []).length) {
          const tr = document.createElement('tr');
          const cell = td('No recorded expenses in this period.');
          cell.colSpan = 7;
          cell.className = 'inventory-empty';
          tr.appendChild(cell);
          expenses.appendChild(tr);
        }
      };

      if (typeof financeData === 'object' && financeData) global.renderFinance(financeData);
    } catch (error) {
      console.error('OmniHub v2.7.7 finance compatibility layer failed', error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else queueMicrotask(install);
})(window);
