const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const generateInvoicePDF = async (invoice, outputStream) => {
    // Configurar documento
    const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4'
    });
    doc.pipe(outputStream);

    const colors = {
        primary: '#002855',
        secondary: '#1a75ff',
        accent: '#00b8d4',
        border: '#e0e0e7',
        background: '#f8f9fa',
        text: '#2c3e50'
    };

    // Header
    doc.rect(0, 0, doc.page.width, 150)
       .fillColor(colors.primary)
       .fill();

    // Información de empresa (lado izquierdo)
    doc.fontSize(24)
       .fillColor('white')
       .font('Helvetica-Bold')
       .text(invoice.empresa.nombre, 50, 40);

    doc.fontSize(10)
       .font('Helvetica')
       .text(invoice.empresa.direccion, 50, 70)
       .text(`RIF: ${invoice.empresa.rif}`, 50, 85)
       .text(`Tel: ${invoice.empresa.telefono}`, 50, 100)
       .text(`Email: ${invoice.empresa.email}`, 50, 115);

    // Información de factura (lado derecho)
    doc.save();
    doc.rect(350, 30, 200, 100)
       .fillColor('white')
       .fill();

    // QR Code
    try {
        const qrData = {
            factura: invoice.series,
            fecha: new Date(invoice.fechaEmision).toLocaleDateString(),
            total: `${invoice.moneda} ${invoice.total.toFixed(2)}`,
            verificacion: `FAC-${invoice.series}`
        };
        const qrImage = await QRCode.toDataURL(JSON.stringify(qrData));
        doc.image(qrImage, 500, 40, { width: 40 });
    } catch (error) {
        console.error('Error generando QR:', error);
    }

    doc.fillColor(colors.primary)
       .fontSize(20)
       .text('FACTURA', 370, 40)
       .fontSize(10)
       .text(`N°: ${invoice.series}`, 370, 70)
       .text(`Fecha: ${new Date(invoice.fechaEmision).toLocaleDateString()}`, 370, 85)
       .text(`Vencimiento: ${new Date(invoice.fechaVencimiento).toLocaleDateString()}`, 370, 100);
    doc.restore();

    // Información del cliente
    doc.rect(50, 170, doc.page.width - 100, 100)
       .fillColor(colors.background)
       .fill();

    doc.fillColor(colors.primary)
       .fontSize(14)
       .text('DATOS DEL CLIENTE', 70, 180)
       .fontSize(10)
       .font('Helvetica')
       .fillColor(colors.text)
       .text(`Cliente: ${invoice.client.nombre}`, 70, 205)
       .text(`RIF/CI: ${invoice.client.rif}`, 70, 220)
       .text(`Dirección: ${invoice.client.direccion}`, 70, 235)
       .text(`Teléfono: ${invoice.client.telefono}`, 350, 205)
       .text(`Email: ${invoice.client.email}`, 350, 220);

    // Tabla de productos
    let y = 300;
    doc.rect(50, y, doc.page.width - 100, 30)
       .fillColor(colors.primary)
       .fill();

    doc.fillColor('white')
       .text('Código', 60, y + 10)
       .text('Descripción', 130, y + 10)
       .text('Cantidad', 280, y + 10)
       .text('Precio Unit.', 350, y + 10)
       .text('Total', 480, y + 10);

    y += 30;

    // Items
    invoice.items.forEach((item, i) => {
        doc.rect(50, y, doc.page.width - 100, 25)
           .fillColor(i % 2 === 0 ? colors.background : 'white')
           .fill();

        doc.fillColor(colors.text)
           .text(item.codigo, 60, y + 7)
           .text(item.descripcion, 130, y + 7)
           .text(item.cantidad.toString(), 280, y + 7)
           .text(`${invoice.moneda} ${item.precioUnitario.toFixed(2)}`, 350, y + 7)
           .text(`${invoice.moneda} ${item.subtotal.toFixed(2)}`, 480, y + 7);

        y += 25;
    });

    // Totales con mejor formato
    y += 20;
    const totalsBox = {
        x: 350,
        width: doc.page.width - 400,
        height: 120,
        padding: 15
    };

    // Fondo para totales
    doc.rect(totalsBox.x, y, totalsBox.width, totalsBox.height)
       .fillColor('white')
       .strokeColor(colors.border)
       .fillAndStroke();

    // Líneas divisorias y totales
    const xPos = totalsBox.x + totalsBox.padding;
    const totalWidth = totalsBox.width - (totalsBox.padding * 2);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.text);

    // Subtotal
    doc.text('Subtotal:', xPos, y + 20);
    doc.text(`${invoice.moneda} ${(invoice.subtotal || 0).toFixed(2)}`, 
             xPos, y + 20, 
             { width: totalWidth, align: 'right' });

    // IVA
    doc.text('IVA (16%):', xPos, y + 45);
    doc.text(`${invoice.moneda} ${(invoice.iva?.monto || 0).toFixed(2)}`, 
             xPos, y + 45, 
             { width: totalWidth, align: 'right' });

    // Total Final
    doc.font('Helvetica-Bold')
       .fontSize(12);
    doc.text('TOTAL:', xPos, y + 80);
    doc.text(`${invoice.moneda} ${(invoice.total || 0).toFixed(2)}`, 
             xPos, y + 80, 
             { width: totalWidth, align: 'right' });

             
    // Footer
    const footerTop = doc.page.height - 120;

    doc.rect(50, footerTop, doc.page.width - 100, 70)
       .fillColor(colors.background)
       .fill();

    doc.fillColor(colors.text)
       .fontSize(9)
       .text('Observaciones:', 60, footerTop + 10)
       .fontSize(8)
       .text(invoice.observaciones || '-', 60, footerTop + 25)
       .text('Información Bancaria:', 60, footerTop + 40)
       .text(invoice.infoBancaria || '-', 60, footerTop + 55);

    doc.end();
};

module.exports = {
    generateInvoicePDF
};