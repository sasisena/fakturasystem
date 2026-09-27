import PDFDocument from 'pdfkit';
import { formatAccountNumber, formatNok, formatOre, lineTotals, type Company, type Invoice } from '@faktura/core';

const formatDate = (iso: string | null): string => (iso ? iso.split('-').reverse().join('.') : '');
const formatOrgNumber = (n: string): string => n.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
const formatQuantity = (q: number): string => q.toLocaleString('nb-NO', { maximumFractionDigits: 2 });

export function invoiceFilename(inv: Invoice): string {
  return `${inv.kind === 'credit_note' ? 'kreditnota' : 'faktura'}-${inv.number ?? `utkast-${inv.id}`}.pdf`;
}

/** Lager PDF med de opplysningene bokføringsforskriften § 5-1-1 krever på en salgsdokumentasjon. */
export function renderInvoicePdf(inv: Invoice, currentCompany: Company): Promise<Buffer> {
  const seller = inv.seller ?? currentCompany;
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: invoiceFilename(inv) } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = 50;
  const right = doc.page.width - 50;
  const width = right - left;
  const isCredit = inv.kind === 'credit_note';

  // Topp: tittel og selger
  doc.font('Helvetica-Bold').fontSize(22).text(isCredit ? 'KREDITNOTA' : inv.status === 'draft' ? 'FAKTURA (UTKAST)' : 'FAKTURA', left, 50);
  doc.font('Helvetica-Bold').fontSize(11).text(seller.name, left, 50, { width, align: 'right' });
  doc.font('Helvetica').fontSize(9);
  const sellerLines = [
    seller.address,
    `${seller.postalCode} ${seller.city}`.trim(),
    seller.orgNumber && `Org.nr. ${formatOrgNumber(seller.orgNumber)}${seller.vatRegistered ? ' MVA' : ''}`,
    seller.email,
    seller.phone,
  ].filter(Boolean);
  doc.text(sellerLines.join('\n'), left, 66, { width, align: 'right' });

  // Kunde og fakturainfo
  const blockTop = 150;
  const c = inv.customer;
  doc.font('Helvetica-Bold').fontSize(10).text(c.name, left, blockTop);
  doc.font('Helvetica').fontSize(10).text(
    [c.address, `${c.postalCode} ${c.city}`.trim(), c.orgNumber && `Org.nr. ${formatOrgNumber(c.orgNumber)}`].filter(Boolean).join('\n'),
  );

  const meta: [string, string][] = [
    [isCredit ? 'Kreditnotanr.' : 'Fakturanr.', String(inv.number ?? '—')],
    ['Fakturadato', formatDate(inv.issueDate)],
    ...(!isCredit ? ([['Forfallsdato', formatDate(inv.dueDate)]] as [string, string][]) : []),
    ['Kundenr.', String(inv.customerId)],
    ...(inv.theirReference ? ([['Deres ref.', inv.theirReference]] as [string, string][]) : []),
  ];
  let y = blockTop;
  for (const [label, value] of meta) {
    doc.font('Helvetica').text(label, 340, y, { width: 90 });
    doc.font('Helvetica-Bold').text(value, 430, y, { width: right - 430, align: 'right' });
    y += 15;
  }

  // Linjer
  const cols = { desc: left, qty: 300, price: 350, vat: 425, sum: 465 };
  let rowY = 270;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Beskrivelse', cols.desc, rowY);
  doc.text('Antall', cols.qty, rowY, { width: 45, align: 'right' });
  doc.text('Pris', cols.price, rowY, { width: 70, align: 'right' });
  doc.text('Mva', cols.vat, rowY, { width: 35, align: 'right' });
  doc.text('Beløp', cols.sum, rowY, { width: right - cols.sum, align: 'right' });
  rowY += 14;
  doc.moveTo(left, rowY).lineTo(right, rowY).lineWidth(0.5).stroke();
  rowY += 6;

  doc.font('Helvetica').fontSize(9);
  for (const line of inv.lines) {
    const h = Math.max(doc.heightOfString(line.description, { width: 240 }), 12);
    if (rowY + h > doc.page.height - 200) {
      doc.addPage();
      rowY = 50;
    }
    doc.text(line.description, cols.desc, rowY, { width: 240 });
    doc.text(formatQuantity(line.quantity), cols.qty, rowY, { width: 45, align: 'right' });
    doc.text(formatOre(line.unitPrice), cols.price, rowY, { width: 70, align: 'right' });
    doc.text(`${seller.vatRegistered ? line.vatRate : 0} %`, cols.vat, rowY, { width: 35, align: 'right' });
    doc.text(formatOre(lineTotals(line).net), cols.sum, rowY, { width: right - cols.sum, align: 'right' });
    rowY += h + 6;
  }
  doc.moveTo(left, rowY).lineTo(right, rowY).stroke();
  rowY += 10;

  // Summer
  const sumRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9);
    doc.text(label, 300, rowY, { width: 150 });
    doc.text(value, 450, rowY, { width: right - 450, align: 'right' });
    rowY += bold ? 18 : 14;
  };
  sumRow('Sum eks. mva', formatOre(inv.totals.net));
  if (seller.vatRegistered) {
    for (const b of inv.totals.vatBreakdown) sumRow(`Mva ${b.rate} % av ${formatOre(b.base)}`, formatOre(b.vat));
  }
  sumRow(isCredit ? 'Til gode' : 'Å betale', formatNok(isCredit ? -inv.totals.gross : inv.totals.gross), true);
  if (!seller.vatRegistered) {
    doc.font('Helvetica-Oblique').fontSize(8).text('Selger er ikke registrert i Merverdiavgiftsregisteret.', left, rowY);
    rowY += 14;
  }

  if (inv.note) {
    rowY += 10;
    doc.font('Helvetica').fontSize(9).text(inv.note, left, rowY, { width });
    rowY = doc.y;
  }

  // Betalingsinformasjon nederst
  if (!isCredit) {
    const boxTop = doc.page.height - 150;
    doc.rect(left, boxTop, width, 70).lineWidth(0.5).stroke();
    const col = (x: number, label: string, value: string) => {
      doc.font('Helvetica').fontSize(8).text(label, x, boxTop + 14);
      doc.font('Helvetica-Bold').fontSize(12).text(value, x, boxTop + 28);
    };
    col(left + 15, 'Kontonummer', formatAccountNumber(seller.accountNumber));
    col(left + 145, 'KID', inv.kid ?? '—');
    col(left + 285, 'Beløp', formatNok(inv.totals.gross));
    col(left + 400, 'Forfall', formatDate(inv.dueDate));
  }

  doc.end();
  return done;
}
