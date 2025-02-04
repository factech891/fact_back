// invoice.controller.js
const { generateInvoicePDF } = require('../utils/pdfGenerator');

const empresaDefault = {
   nombre: 'Tu Empresa',
   direccion: 'Dirección de la empresa',
   rif: 'J-123456789',
   condicionIva: 'Contribuyente'
};

let invoices = [];

const getInvoices = async (req, res) => res.json(invoices);

const createInvoices = async (req, res) => {
   try {
       const { cliente, items, subtotal, moneda, condicionesPago, diasCredito } = req.body;
       
       const ivaAmount = subtotal * 0.16;
       const total = subtotal + ivaAmount;

       const newInvoice = {
           id: invoices.length + 1,
           series: (invoices.length + 1).toString().padStart(4, '0'),
           empresa: empresaDefault,
           client: {
               ...cliente
           },
           fechaEmision: new Date(),
           fechaVencimiento: new Date(new Date().setDate(new Date().getDate() + (diasCredito || 30))),
           condicionesPago: condicionesPago || 'Contado',
           moneda: moneda || 'USD',
           items: items || [],
           subtotal: subtotal || 0,
           descuento: 0,
           iva: {
               tasa: 16,
               monto: ivaAmount
           },
           total: total,
           status: 'pendiente',
           observaciones: '',
           infoBancaria: 'Datos bancarios para transferencias'
       };

       invoices.push(newInvoice);
       res.json(newInvoice);
   } catch (error) {
       console.error('Error creating invoice:', error);
       res.status(500).json({ message: 'Error interno del servidor' });
   }
};

const updateInvocies = async (req, res) => {
   const { id } = req.params;
   const { cliente, items, subtotal, status, moneda, condicionesPago } = req.body;
   const index = invoices.findIndex(invoice => invoice.id === parseInt(id));

   if (index !== -1) {
       const ivaAmount = subtotal * 0.16;
       const total = subtotal + ivaAmount;

       invoices[index] = {
           ...invoices[index],
           client: cliente,
           items: items || [],
           subtotal: subtotal || 0,
           iva: {
               tasa: 16,
               monto: ivaAmount
           },
           total: total,
           moneda: moneda || invoices[index].moneda,
           condicionesPago: condicionesPago || invoices[index].condicionesPago,
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