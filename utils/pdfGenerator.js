const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice, outputStream) => {
    const doc = new PDFDocument({ margin: 30 });

    doc.pipe(outputStream);

    // Encabezado
    doc.fontSize(20).text('Factura', { align: 'right' });
    doc.fontSize(10).text(`Serie: ${invoice.series}`, { align: 'right' });
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, { align: 'right' });

    doc.moveDown();
    doc.fontSize(12).text(`Cliente: ${invoice.client.nombre || '-'}`);
    doc.text(`Dirección: ${invoice.client.direccion || '-'}`);
    doc.text(`CUIT/DNI: ${invoice.client.cuit || '-'}`);
    doc.text(`Condición IVA: ${invoice.client.condicionIva || '-'}`);

    // Totales
    doc.moveDown();
    doc.text(`Total: $${invoice.total.toFixed(2)}`, { align: 'right' });

    doc.end();
};

module.exports = {
    generateInvoicePDF
};