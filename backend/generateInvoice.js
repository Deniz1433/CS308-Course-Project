const PDFDocument = require('pdfkit');
const fs = require('fs');

function generateInvoice({ customerName, address, brand, serialNumber, items, total }, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ─── Header ───────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .text('INVOICE', { align: 'center' })
      .moveDown();

    doc
      .fontSize(12)
      .text(`Date: ${new Date().toLocaleDateString()}`)
      .text(`Billed to: ${customerName}`)
      .text(`Address: ${address}`)
      .text(`Brand: ${brand}`)
      .text(`Invoice SN: ${serialNumber}`)
      .moveDown();

    // ─── Table Setup ───────────────────────────────────────────────────────────
    const headers = ['Item','Distributor','Model','Serial #','Qty','Price','Total'];

    // Compute usable width and equal column widths
    const left   = doc.page.margins.left;
    const right  = doc.page.width - doc.page.margins.right;
    const usable = right - left;               // e.g. ~495pt on A4 with 50pt margins
    const colW   = usable / headers.length;    // ~70pt each for 7 columns

    // Positions x[0] = left, x[i] = left + i*colW
    const positions = headers.map((_,i) => left + i*colW);

    // ── DRAW HEADER ───────────────────────────────────────────────────────────
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => {
      doc.text(h, positions[i], y, { width: colW, align: 'left' });
    });

    // Move down after header
    const headerHeight = doc.heightOfString(headers[0], { width: colW });
    doc.y = y + headerHeight + 8;
    doc.font('Helvetica');

    // ── DRAW ROWS ─────────────────────────────────────────────────────────────
    items.forEach(item => {
      const rowY = doc.y;
      const cells = [
        item.name,
        item.distributor,
        item.model,
        item.serialNumber,
        item.qty.toString(),
        `${item.price.toFixed(2)} USD`,
        `${item.total.toFixed(2)} USD`
      ];

      // Measure max height of this row
      const heights = cells.map(text =>
        doc.heightOfString(text, { width: colW })
      );
      const rowH = Math.max(...heights);

      // Draw each cell at (positions[i], rowY) with width colW
      cells.forEach((text, i) => {
        doc.text(text, positions[i], rowY, { width: colW, align: 'left' });
      });

      // Advance to next row
      doc.y = rowY + rowH + 6;
    });

    // ─── Grand Total ────────────────────────────────────────────────────────────
    doc
      .moveDown()
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`Grand Total: ${total.toFixed(2)} USD`, left, doc.y, {
        width: usable,
        align: 'right'
      });

    // ─── Finish ─────────────────────────────────────────────────────────────────
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = generateInvoice;