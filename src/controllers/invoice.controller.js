// controllers/invoice.controller.js
const Invoice = require('../models/invoice.model');

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

// Nuevo método para datos de dashboard
exports.getDashboardData = async (req, res) => {
    try {
        const invoices = await Invoice.find().populate('client');
        
        // Procesar para facturación diaria con conteo correcto
        const facturacionDiaria = [];
        const facturasPorDia = {};
        
        // Agrupar facturas por día
        invoices.forEach(invoice => {
            const fecha = new Date(invoice.date);
            const dia = fecha.getDate();
            const mes = fecha.getMonth();
            
            // Abreviaturas en español para los meses
            const mesesAbr = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const key = `${dia} ${mesesAbr[mes]}`;
            
            if (!facturasPorDia[key]) {
                facturasPorDia[key] = {
                    name: key,
                    USD: 0,
                    VES: 0,
                    total: 0,
                    facturas: 0
                };
            }
            
            // Incrementar conteo de facturas
            facturasPorDia[key].facturas += 1;
            
            // Sumar montos según la moneda
            if (invoice.moneda === 'USD') {
                facturasPorDia[key].USD += invoice.total;
                facturasPorDia[key].total += invoice.total;
            } else if (invoice.moneda === 'VES') {
                facturasPorDia[key].VES += invoice.total;
                // Para el total en USD, necesitarías convertir usando una tasa
                // Por ahora, solo sumamos el valor en VES
                facturasPorDia[key].total += invoice.total;
            }
        });
        
        // Convertir a array para el frontend
        Object.values(facturasPorDia).forEach(data => {
            facturacionDiaria.push(data);
        });
        
        res.status(200).json({
            facturacionDiaria
        });
    } catch (error) {
        console.error('Error obteniendo datos de dashboard:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};