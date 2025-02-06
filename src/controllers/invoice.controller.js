// controllers/invoice.controller.js
const Invoice = require('../models/invoice.model');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

const empresaDefault = {
   nombre: 'Tu Empresa',
   direccion: 'Dirección de la empresa',
   rif: 'J-123456789',
   condicionIva: 'Contribuyente'
};

exports.getInvoices = async (req, res) => {
   try {
       const invoices = await Invoice.find()
           .populate('client')
           .populate('items.product');
       res.status(200).json(invoices);
   } catch (error) {
       console.error('Error obteniendo facturas:', error);
       res.status(500).json({ message: 'Error interno del servidor' });
   }
};

exports.createOrUpdateInvoice = async (req, res) => {
   try {
       console.log('Datos recibidos del frontend:', req.body);
       const { _id, ...invoiceData } = req.body;

       let invoice;
       if (_id) {
           invoice = await Invoice.findByIdAndUpdate(_id, invoiceData, { 
               new: true,
               runValidators: true 
           });
       } else {
           // Generar número único de factura
           const lastInvoice = await Invoice.findOne().sort({ number: -1 });
           const nextNumber = lastInvoice ? parseInt(lastInvoice.number.slice(4)) + 1 : 1;
           const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;

           invoice = new Invoice({
               number: invoiceNumber,
               client: invoiceData.client,
               items: invoiceData.items.map(item => ({
                   product: item.product,
                   quantity: item.quantity,
                   price: item.price,
                   subtotal: item.quantity * item.price
               })),
               subtotal: invoiceData.subtotal,
               tax: invoiceData.tax,
               total: invoiceData.total,
               status: 'draft',
               moneda: invoiceData.moneda || 'USD',
               condicionesPago: invoiceData.condicionesPago || 'Contado',
               diasCredito: invoiceData.diasCredito || 30
           });

           await invoice.save();
       }

       // Poblar los datos del cliente y productos
       await invoice.populate('client');
       await invoice.populate('items.product');

       res.status(201).json(invoice);
   } catch (error) {
       console.error('Error al guardar/actualizar la factura:', error);
       res.status(400).json({ error: error.message });
   }
};

exports.updateInvoice = async (req, res) => {
   try {
       const { id } = req.params;
       const updateData = req.body;

       const invoice = await Invoice.findByIdAndUpdate(
           id, 
           updateData,
           { new: true, runValidators: true }
       ).populate('client').populate('items.product');

       if (!invoice) {
           return res.status(404).json({ message: 'Factura no encontrada' });
       }

       res.status(200).json(invoice);
   } catch (error) {
       console.error('Error actualizando factura:', error);
       res.status(500).json({ message: error.message });
   }
};

exports.deleteInvoice = async (req, res) => {
   try {
       const { id } = req.params;
       const deletedInvoice = await Invoice.findByIdAndDelete(id);

       if (!deletedInvoice) {
           return res.status(404).json({ message: 'Factura no encontrada' });
       }

       res.status(204).end();
   } catch (error) {
       console.error('Error eliminando factura:', error);
       res.status(500).json({ message: error.message });
   }
};

exports.generateInvoicePDFController = async (req, res) => {
   try {
       const { id } = req.params;
       const invoice = await Invoice.findById(id)
           .populate('client')
           .populate('items.product');

       if (!invoice) {
           return res.status(404).json({ message: 'Factura no encontrada' });
       }

       res.setHeader('Content-Type', 'application/pdf');
       res.setHeader('Content-Disposition', `attachment; filename=factura_${invoice.number}.pdf`);

       generateInvoicePDF(invoice, res);
   } catch (error) {
       console.error('Error generando PDF:', error);
       if (!res.headersSent) {
           res.status(500).json({ message: 'Error generando el PDF' });
       }
   }
};