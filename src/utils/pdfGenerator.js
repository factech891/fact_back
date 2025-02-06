const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const empresaDefault = {
    nombre: 'Tu Empresa',
    direccion: 'Dirección de la empresa',
    rif: 'J-123456789',
    telefono: '+58 424-1234567',
    email: 'info@tuempresa.com'
};

const generateInvoicePDF = async (invoice, outputStream) => {
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
       .text(empresaDefault.nombre, 50, 40);

    doc.fontSize(10)
       .font('Helvetica')
       .text(empresaDefault.direccion, 50, 70)
       .text(`RIF: ${empresaDefault.rif}`, 50, 85)
       .text(`Tel: ${empresaDefault.telefono}`, 50, 100)
       .text(`Email: ${empresaDefault.email}`, 50, 115);

    // Información de factura (lado derecho)
    doc.save();
    doc.rect(350, 30, 200, 100)
       .fillColor('white')
       .fill();

    // QR Code
    try {
        const qrData = {
            factura: invoice.number,
            fecha: new Date(invoice.date).toLocaleDateString(),
            total: `${invoice.moneda} ${invoice.total.toFixed(2)}`,
            verificacion: `FAC-${invoice.number}`
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
       .text(`N°: ${invoice.number}`, 370, 70)
       .text(`Fecha: ${new Date(invoice.date).toLocaleDateString()}`, 370, 85);

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
       .text(`RIF/CI: ${invoice.client.rif || 'N/A'}`, 70, 220)
       .text(`Dirección: ${invoice.client.direccion || 'N/A'}`, 70, 235);

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
        const product = item.product;
        doc.rect(50, y, doc.page.width - 100, 25)
           .fillColor(i % 2 === 0 ? colors.background : 'white')
           .fill();

        doc.fillColor(colors.text)
           .text(product.codigo, 60, y + 7)
           .text(product.nombre, 130, y + 7)
           .text(item.quantity.toString(), 280, y + 7)
           .text(`${invoice.moneda || 'USD'} ${item.price.toFixed(2)}`, 350, y + 7)
           .text(`${invoice.moneda || 'USD'} ${(item.quantity * item.price).toFixed(2)}`, 480, y + 7);

        y += 25;
    });

    // Totales
    y += 20;
    const totalsBox = {
        x: 350,
        width: doc.page.width - 400,
        height: 120,
        padding: 15
    };

    doc.rect(totalsBox.x, y, totalsBox.width, totalsBox.height)
       .fillColor('white')
       .strokeColor(colors.border)
       .fillAndStroke();

    const xPos = totalsBox.x + totalsBox.padding;
    const totalWidth = totalsBox.width - (totalsBox.padding * 2);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.text);

    // Subtotal
    doc.text('Subtotal:', xPos, y + 20);
    doc.text(`${invoice.moneda || 'USD'} ${invoice.subtotal.toFixed(2)}`, 
             xPos, y + 20, 
             { width: totalWidth, align: 'right' });

    // IVA
    doc.text('IVA (16%):', xPos, y + 45);
    doc.text(`${invoice.moneda || 'USD'} ${invoice.tax.toFixed(2)}`, 
             xPos, y + 45, 
             { width: totalWidth, align: 'right' });

    // Total Final
    doc.font('Helvetica-Bold')
       .fontSize(12);
    doc.text('TOTAL:', xPos, y + 80);
    doc.text(`${invoice.moneda || 'USD'} ${invoice.total.toFixed(2)}`, 
             xPos, y + 80, 
             { width: totalWidth, align: 'right' });

    doc.end();
};

module.exports = {
    generateInvoicePDF
};