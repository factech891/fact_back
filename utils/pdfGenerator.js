const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice, outputStream) => {
    // Crear documento con margen más profesional
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(outputStream);

    // Colores corporativos
    const colors = {
        primary: '#002855',
        secondary: '#284B8C',
        border: '#D4E0F7',
        background: '#F8F9FA'
    };

    // Header
    doc.rect(50, 50, doc.page.width - 100, 100)
       .fillColor(colors.background)
       .fill();

    // Logo/Título de empresa
    doc.fontSize(24)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(invoice.empresa.nombre, 70, 60);

    // Datos de empresa
    doc.fontSize(10)
       .fillColor('black')
       .font('Helvetica')
       .text(`RIF: ${invoice.empresa.rif}`, 70, 90)
       .text(`Dirección: ${invoice.empresa.direccion}`, 70, 105)
       .text(`Teléfono: ${invoice.empresa.telefono}`, 70, 120)
       .text(`Email: ${invoice.empresa.email}`, 70, 135);

    // Información de factura
    doc.fontSize(20)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('FACTURA', 400, 60)
       .fontSize(10)
       .text(`N°: ${invoice.series}`, 400, 90)
       .text(`Fecha: ${new Date(invoice.fechaEmision).toLocaleDateString()}`, 400, 105)
       .text(`Vencimiento: ${new Date(invoice.fechaVencimiento).toLocaleDateString()}`, 400, 120)
       .text(`Moneda: ${invoice.moneda}`, 400, 135);

    // Datos del cliente
    doc.rect(50, 170, doc.page.width - 100, 80)
       .fillColor(colors.background)
       .fill();

    doc.fillColor(colors.secondary)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('DATOS DEL CLIENTE', 70, 180);

    doc.fillColor('black')
       .fontSize(10)
       .font('Helvetica')
       .text(`Cliente: ${invoice.client.nombre}`, 70, 200)
       .text(`RIF/CI: ${invoice.client.rif}`, 70, 215)
       .text(`Dirección: ${invoice.client.direccion}`, 70, 230)
       .text(`Teléfono: ${invoice.client.telefono}`, 350, 200)
       .text(`Email: ${invoice.client.email}`, 350, 215);

    // Tabla de items
    let y = 280;
    
    // Cabecera de tabla
    doc.rect(50, y, doc.page.width - 100, 20)
       .fillColor(colors.primary)
       .fill();
    
    doc.fillColor('white')
       .text('Código', 60, y + 5)
       .text('Descripción', 120, y + 5)
       .text('Cant.', 280, y + 5)
       .text('Precio', 330, y + 5)
       .text('IVA', 400, y + 5)
       .text('Total', 470, y + 5);

    y += 20;

    // Items
    invoice.items.forEach(item => {
        doc.rect(50, y, doc.page.width - 100, 20)
           .fillColor(y % 40 === 0 ? colors.background : 'white')
           .fill();

        doc.fillColor('black')
           .text(item.codigo, 60, y + 5)
           .text(item.descripcion, 120, y + 5)
           .text(item.cantidad.toString(), 280, y + 5)
           .text(`${invoice.moneda} ${item.precioUnitario.toFixed(2)}`, 330, y + 5)
           .text(item.exento ? 'Exento' : '16%', 400, y + 5)
           .text(`${invoice.moneda} ${item.subtotal.toFixed(2)}`, 470, y + 5);

        y += 20;
    });

    // Totales
    doc.rect(350, y + 20, doc.page.width - 400, 80)
       .fillColor(colors.background)
       .fill();

    doc.fillColor('black')
       .text(`Subtotal: ${invoice.moneda} ${invoice.subtotal.toFixed(2)}`, 370, y + 30)
       .text(`IVA (16%): ${invoice.moneda} ${invoice.iva.monto.toFixed(2)}`, 370, y + 50)
       .font('Helvetica-Bold')
       .text(`TOTAL: ${invoice.moneda} ${invoice.total.toFixed(2)}`, 370, y + 70);

    // Pie de página
    y += 120;
    doc.font('Helvetica')
       .fontSize(9)
       .text('Observaciones:', 50, y)
       .text(invoice.observaciones || '-', 50, y + 15)
       .text('Información Bancaria:', 50, y + 40)
       .text(invoice.infoBancaria || '-', 50, y + 55);

    doc.end();
};

module.exports = {
    generateInvoicePDF
};