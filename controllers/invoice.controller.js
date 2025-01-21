const { generateInvoicePDF } = require('../utils/pdfGenerator');

// Datos de empresa por defecto
const empresaDefault = {
    nombre: 'Tu Empresa',
    direccion: 'Dirección de la empresa',
    cuit: '30-12345678-9',
    condicionIva: 'Responsable Inscripto'
};

let invoices = [
    {
        id: 1,
        series: '0001',
        empresa: empresaDefault,
        client: {
            nombre: 'Juan Pérez',
            direccion: '',
            cuit: '',
            condicionIva: ''
        },
        fechaEmision: new Date(),
        fechaVencimiento: new Date(new Date().setDate(new Date().getDate() + 30)),
        condicionPago: 'Contado',
        items: [
            {
                descripcion: 'Producto 1',
                cantidad: 1,
                precioUnitario: 1000,
                subtotal: 1000
            }
        ],
        subtotal: 1000,
        descuento: 0,
        iva: {
            tasa: 21,
            monto: 210
        },
        total: 1210,
        status: 'pendiente',
        observaciones: '',
        infoBancaria: 'Datos bancarios para transferencias'
    }
];

const getInvoices = async (req, res) => res.json(invoices);

const createInvoices = async (req, res) => {
    const { client, total } = req.body;
    
    // Crear factura con estructura completa
    const newInvoice = {
        id: invoices.length + 1,
        series: (invoices.length + 1).toString().padStart(4, '0'),
        empresa: empresaDefault,
        client: {
            nombre: client.nombre || client,
            direccion: client.direccion || '',
            cuit: client.cuit || '',
            condicionIva: client.condicionIva || ''
        },
        fechaEmision: new Date(),
        fechaVencimiento: new Date(new Date().setDate(new Date().getDate() + 30)),
        condicionPago: 'Contado',
        items: [
            {
                descripcion: 'Producto/Servicio',
                cantidad: 1,
                precioUnitario: parseFloat(total),
                subtotal: parseFloat(total)
            }
        ],
        subtotal: parseFloat(total),
        descuento: 0,
        iva: {
            tasa: 21,
            monto: parseFloat(total) * 0.21
        },
        total: parseFloat(total) * 1.21,
        status: 'pendiente',
        observaciones: '',
        infoBancaria: 'Datos bancarios para transferencias'
    };

    invoices.push(newInvoice);
    res.json(newInvoice);
};

const updateInvocies = async (req, res) => {
    const { id } = req.params;
    const { client, total, status } = req.body;
    const index = invoices.findIndex(invoice => invoice.id === parseInt(id));

    if (index !== -1) {
        invoices[index] = {
            ...invoices[index],
            client: {
                nombre: client.nombre || client,
                direccion: client.direccion || invoices[index].client.direccion,
                cuit: client.cuit || invoices[index].client.cuit,
                condicionIva: client.condicionIva || invoices[index].client.condicionIva
            },
            items: [
                {
                    descripcion: 'Producto/Servicio',
                    cantidad: 1,
                    precioUnitario: parseFloat(total),
                    subtotal: parseFloat(total)
                }
            ],
            subtotal: parseFloat(total),
            iva: {
                tasa: 21,
                monto: parseFloat(total) * 0.21
            },
            total: parseFloat(total) * 1.21,
            status: status || invoices[index].status
        };
        res.json(invoices[index]);
    } else {
        res.status(404).json({ message: 'Factura no encontrada' });
    }
};

const deleteInvoices = async (req, res) => {
    invoices = invoices.filter(invoice => invoice.id !== parseInt(req.params.id));
    res.status(204).end();
};

const generateInvoicePDFController = async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = invoices.find(invoice => invoice.id === parseInt(id));

        if (!invoice) {
            return res.status(404).json({ message: 'Factura no encontrada' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=factura_${invoice.series}.pdf`);

        generateInvoicePDF(invoice, res);
    } catch (error) {
        console.error('Error generando PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generando el PDF' });
        }
    }
};

module.exports = {
    getInvoices,
    createInvoices,
    updateInvocies,
    deleteInvoices,
    generateInvoicePDFController
};