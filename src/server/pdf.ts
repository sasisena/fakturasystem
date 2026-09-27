/**
 * Faktura som PDF (pdfkit). I fase 2 finnes bare utkast: de merkes tydelig «UTKAST» og har verken
 * fakturanummer, KID eller forfallsdato – det tildeles når fakturaen sendes (fase 3).
 * Oppsettet følger kravene i bokføringsforskriften § 5-1-1 til salgsdokumentasjon.
 */
import PDFDocument from 'pdfkit';
import type { organizations } from '@/db/schema';
import { formatAccountNumber, formatNok, formatOre } from '@/lib/faktura';
import type { InvoiceDto } from './invoicing';

type Seller = typeof organizations.$inferSelect;

const formatOrgNumber = (n: string) => n.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
const formatQuantity = (q: number) => q.toLocaleString('nb-NO', { maximumFractionDigits: 3 });
const formatDate = (d: Date) => new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' }).format(d);

export function invoiceFilename(inv: InvoiceDto): string {
  return `faktura-utkast-${inv.customer.customerNumber}-${inv.id.slice(0, 8)}.pdf`;
}

export function renderInvoicePdf(inv: InvoiceDto, seller: Seller): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: invoiceFilename(inv), Author: seller.name } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = 50;
  const right = doc.page.width - 50;
  const width = right - left;

  // Vannmerke på utkast
  doc.save().rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.font('Helvetica-Bold').fontSize(90).fillColor('#000000', 0.06).text('UTKAST', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' });
  doc.restore().fillColor('#000000', 1);

  // Topp: tittel og selger
  doc.font('Helvetica-Bold').fontSize(22).text('FAKTURA', left, 50);
  doc.font('Helvetica').fontSize(10).fillColor('#A61D13').text('UTKAST – ikke sendt', left, 78).fillColor('#000000');
  doc.font('Helvetica-Bold').fontSize(11).text(seller.name, left, 50, { width, align: 'right' });
  doc.font('Helvetica').fontSize(9).text(
    [
      seller.address,
      `${seller.postalCode} ${seller.city}`.trim(),
      seller.orgNumber && `Org.nr. ${formatOrgNumber(seller.orgNumber)}${seller.vatRegistered ? ' MVA' : ''}`,
      seller.organizationForm === 'AS' || seller.organizationForm === 'ASA' ? 'Foretaksregisteret' : '',
      seller.email,
      seller.phone,
    ].filter(Boolean).join('\n'),
    left,
    66,
    { width, align: 'right' },
  );

  // Kunde og fakturainfo
  const blockTop = 160;
  const c = inv.customer;
  doc.font('Helvetica-Bold').fontSize(10).text(c.name, left, blockTop, { width: 260 });
  doc.font('Helvetica').fontSize(10).text(
    [c.address, `${c.postalCode} ${c.city}`.trim(), c.orgNumber && `Org.nr. ${formatOrgNumber(c.orgNumber)}`].filter(Boolean).join('\n'),
    { width: 260 },
  );
  const meta: [string, string][] = [
    ['Fakturanr.', 'Tildeles ved sending'],
    ['Utkast laget', formatDate(inv.createdAt)],
    ['Kundenr.', String(c.customerNumber)],
    ...(inv.theirReference ? ([['Deres ref.', inv.theirReference]] as [string, string][]) : []),
  ];
  let y = blockTop;
  for (const [label, value] of meta) {
    doc.font('Helvetica').text(label, 330, y, { width: 90 });
    doc.font('Helvetica-Bold').text(value, 420, y, { width: right - 420, align: 'right' });
    y += 15;
  }

  // Linjer
  const cols = { desc: left, qty: 290, price: 350, vat: 425, sum: 465 };
  let rowY = 280;
  const header = () => {
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Beskrivelse', cols.desc, rowY);
    doc.text('Antall', cols.qty, rowY, { width: 55, align: 'right' });
    doc.text('Pris', cols.price, rowY, { width: 70, align: 'right' });
    doc.text('Mva', cols.vat, rowY, { width: 35, align: 'right' });
    doc.text('Beløp', cols.sum, rowY, { width: right - cols.sum, align: 'right' });
    rowY += 14;
    doc.moveTo(left, rowY).lineTo(right, rowY).lineWidth(0.5).stroke();
    rowY += 6;
    doc.font('Helvetica').fontSize(9);
  };
  header();
  for (const line of inv.lines) {
    const h = Math.max(doc.heightOfString(line.description, { width: 230 }), 12);
    if (rowY + h > doc.page.height - 120) {
      doc.addPage();
      rowY = 50;
      header();
    }
    doc.text(line.description, cols.desc, rowY, { width: 230 });
    doc.text(`${formatQuantity(line.quantity)} ${line.unit}`, cols.qty, rowY, { width: 55, align: 'right' });
    doc.text(formatOre(line.unitPrice), cols.price, rowY, { width: 70, align: 'right' });
    doc.text(`${line.vatRate} %`, cols.vat, rowY, { width: 35, align: 'right' });
    doc.text(formatOre(line.net), cols.sum, rowY, { width: right - cols.sum, align: 'right' });
    rowY += h + 6;
  }
  doc.moveTo(left, rowY).lineTo(right, rowY).stroke();
  rowY += 10;
  if (rowY > doc.page.height - 230) {
    doc.addPage();
    rowY = 50;
  }

  // Summer
  const sumRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9);
    doc.text(label, 290, rowY, { width: 160 });
    doc.text(value, 450, rowY, { width: right - 450, align: 'right' });
    rowY += bold ? 18 : 14;
  };
  sumRow('Sum eks. mva', formatOre(inv.totals.net));
  if (inv.vatRegistered) {
    for (const b of inv.totals.vatBreakdown) sumRow(`Mva ${b.rate} % av ${formatOre(b.base)}`, formatOre(b.vat));
  }
  sumRow('Å betale', formatNok(inv.totals.gross), true);
  if (!inv.vatRegistered) {
    doc.font('Helvetica-Oblique').fontSize(8).text('Selger er ikke registrert i Merverdiavgiftsregisteret.', left, rowY);
    rowY += 14;
  }
  if (inv.note) {
    rowY += 10;
    doc.font('Helvetica').fontSize(9).text(inv.note, left, rowY, { width });
  }

  // Betalingsinformasjon nederst på siste side
  const boxTop = doc.page.height - 130;
  doc.rect(left, boxTop, width, 60).lineWidth(0.5).stroke();
  const col = (x: number, label: string, value: string) => {
    doc.font('Helvetica').fontSize(8).text(label, x, boxTop + 12, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).text(value, x, boxTop + 26, { lineBreak: false });
  };
  col(left + 15, 'Kontonummer', seller.accountNumber ? formatAccountNumber(seller.accountNumber) : '—');
  col(left + 170, 'Beløp', formatNok(inv.totals.gross));
  doc.font('Helvetica').fontSize(8).text('KID og forfallsdato settes når fakturaen sendes.', left + 310, boxTop + 22, { width: width - 325 });

  doc.end();
  return done;
}
