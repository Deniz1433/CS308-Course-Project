// backend/utils/generateInvoice.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

function generateInvoice({ id, customerName, items, total }, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();
    doc.fontSize(12)
       .text(`Invoice #: ${id}`)
       .text(`Date: ${new Date().toLocaleDateString()}`)
       .text(`Billed to: ${customerName}`)
       .moveDown();

    // Table header
    doc.font('Helvetica-Bold')
       .text('Item',  50)
       .text('Qty',   300)
       .text('Price', 370)
       .text('Total', 450)
       .moveDown();
    doc.font('Helvetica');

    // Line items
    items.forEach(i => {
      doc.text(i.name,                   50)
         .text(i.qty.toString(),         300)
         .text(`${i.price.toFixed(2)} USD`, 370)
         .text(`${(i.qty * i.price).toFixed(2)} USD`, 450)
         .moveDown();
    });

    // Grand total
    doc.moveDown()
       .font('Helvetica-Bold')
       .text(`Grand Total: ${total.toFixed(2)} USD`, { align: 'right' });

    doc.end();

    stream.on('finish',  resolve);
    stream.on('error',   reject);
  });
}

module.exports = generateInvoice;
