const PDFDocument = require('pdfkit');
const fs = require('fs');

let invoices = [
    { id: 1, client: 'Juan Pérez', total: 1000, status: 'pendiente', series: '0001' },
    { id: 2, client: 'María López', total: 1500, status: 'pagada', series: '0002' },
];

const getInvoices = async (req, res) => res.json(invoices);

const createInvoices = async (req, res) => {
    const newInvoice = {
        id: invoices.length + 1,
        client: req.body.client,
        total: req.body.total,
        status: 'pendiente',
        series: (invoices.length + 1).toString().padStart(4, '0'), // Generar número de serie automáticamente
    };
    invoices.push(newInvoice);
    res.json(newInvoice);
};

const updateInvocies = async (req, res) => {
    const { id } = req.params;
    const { client, total, status } = req.body;
    const index = invoices.findIndex(invoice => invoice.id === parseInt(id));

    if (index !== -1) {
        invoices[index] = { ...invoices[index], client, total, status };
        res.json(invoices[index]);
    } else {
        res.status(404).json({ message: 'Invoice not found' });
    }
};

const deleteInvoices = async (req, res) => {
    invoices = invoices.filter(invoice => invoice.id !== parseInt(req.params.id));
    res.status(204).end();
};

// Generar PDF para una factura específica
const generateInvoicePDF = async (req, res) => {
    const { id } = req.params;
    const invoice = invoices.find(invoice => invoice.id === parseInt(id));

    if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
    }

    const pdfPath = `invoice_${invoice.series}.pdf`;
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(pdfPath));
    doc.pipe(res);

    doc.fontSize(20).text(`Factura N°: ${invoice.series}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Cliente: ${invoice.client}`);
    doc.text(`Total: $${invoice.total}`);
    doc.text(`Estado: ${invoice.status}`);
    doc.end();
};

module.exports = {
    getInvoices,
    createInvoices,
    updateInvocies,
    deleteInvoices,
    generateInvoicePDF,
};
