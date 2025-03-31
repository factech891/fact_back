// controllers/document.controller.js
const Document = require('../models/document.model');
const Invoice = require('../models/invoice.model'); // <--- IMPORTANTE: Importar el modelo Invoice
const documentService = require('../services/document.service');
const invoiceService = require('../services/invoice.service');

exports.getDocuments = async (req, res) => {
   try {
       const documents = await documentService.getAllDocuments();
       res.status(200).json(documents);
   } catch (error) {
       console.error('Error obteniendo documentos:', error);
       res.status(500).json({ message: 'Error interno del servidor' });
   }
};

exports.getDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await documentService.getDocumentById(id);
        
        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        
        res.status(200).json(document);
    } catch (error) {
        console.error(`Error obteniendo documento ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

exports.getPendingDocuments = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const documents = await documentService.getPendingDocuments(limit);
        res.status(200).json(documents);
    } catch (error) {
        console.error('Error obteniendo documentos pendientes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

exports.createDocument = async (req, res) => {
   try {
       console.log('Datos recibidos del frontend:', req.body);
       const documentData = req.body;

       // Generar número único de documento según su tipo
       const prefix = getDocumentPrefix(documentData.type);
       const lastDocument = await Document.findOne({ type: documentData.type }).sort({ createdAt: -1 });
       let nextNumber = 1;
       
       if (lastDocument && lastDocument.documentNumber) {
           // Extraer número del formato PREFIX-0001
           const match = lastDocument.documentNumber.match(/^[A-Z]+-(\d+)$/);
           if (match && match[1]) {
               nextNumber = parseInt(match[1]) + 1;
           }
       }
       
       const documentNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
       documentData.documentNumber = documentNumber;

       // Procesar items
       const processedItems = documentData.items.map(item => ({
           product: item.product,
           quantity: item.quantity || 1,
           price: item.price || 0,
           taxExempt: item.taxExempt || false,
           subtotal: (item.quantity || 1) * (item.price || 0)
       }));
       
       // Calcular totales
       const subtotal = processedItems.reduce((sum, item) => sum + item.subtotal, 0);
       const taxAmount = processedItems.reduce((sum, item) => {
           if (item.taxExempt) {
               return sum;
           } else {
               return sum + (item.subtotal * 0.16); // 16% de IVA
           }
       }, 0);

       // Crear el documento
       const newDocumentData = {
           ...documentData,
           items: processedItems,
           subtotal,
           taxAmount,
           total: subtotal + taxAmount
       };

       const document = await documentService.createDocument(newDocumentData);
       
       // Poblar los datos del cliente y productos
       await document.populate('client');
       await document.populate('items.product');

       res.status(201).json(document);
   } catch (error) {
       console.error('Error al crear documento:', error);
       res.status(400).json({ message: error.message || 'Error al procesar la solicitud' });
   }
};

exports.updateDocument = async (req, res) => {
   try {
       const { id } = req.params;
       const updateData = req.body;
       
       // Recalcular totales si hay cambios en los items
       if (updateData.items) {
           const processedItems = updateData.items.map(item => ({
               product: item.product,
               quantity: item.quantity || 1,
               price: item.price || 0,
               taxExempt: item.taxExempt || false,
               subtotal: (item.quantity || 1) * (item.price || 0)
           }));
           
           const subtotal = processedItems.reduce((sum, item) => sum + item.subtotal, 0);
           const taxAmount = processedItems.reduce((sum, item) => {
               if (item.taxExempt) {
                   return sum;
               } else {
                   return sum + (item.subtotal * 0.16); // 16% de IVA
               }
           }, 0);
           
           updateData.items = processedItems;
           updateData.subtotal = subtotal;
           updateData.taxAmount = taxAmount;
           updateData.total = subtotal + taxAmount;
       }

       const document = await documentService.updateDocument(id, updateData);

       if (!document) {
           return res.status(404).json({ message: 'Documento no encontrado' });
       }

       res.status(200).json(document);
   } catch (error) {
       console.error(`Error actualizando documento ${req.params.id}:`, error);
       res.status(500).json({ message: error.message || 'Error interno del servidor' });
   }
};

exports.deleteDocument = async (req, res) => {
   try {
       const { id } = req.params;
       const deletedDocument = await documentService.deleteDocument(id);

       if (!deletedDocument) {
           return res.status(404).json({ message: 'Documento no encontrado' });
       }

       res.status(204).end();
   } catch (error) {
       console.error(`Error eliminando documento ${req.params.id}:`, error);
       res.status(500).json({ message: error.message || 'Error interno del servidor' });
   }
};

exports.updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Validar que el estado sea uno de los permitidos
        const allowedStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
        if (!status || !allowedStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({ message: 'Estado no válido proporcionado' });
        }
        
        const document = await documentService.updateDocumentStatus(id, status.toUpperCase());
        
        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        
        res.status(200).json(document);
    } catch (error) {
        console.error(`Error actualizando estado de documento ${req.params.id}:`, error);
        res.status(500).json({ message: error.message || 'Error interno del servidor' });
    }
};

// --- Función Modificada ---
exports.convertToInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const invoiceData = req.body; // Datos del modal

        const document = await documentService.getDocumentById(id); // Obtener documento original

        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        if (document.status === 'CONVERTED') {
            return res.status(400).json({ message: 'Este documento ya ha sido convertido a factura' });
        }

        // --- INICIO: Generar número de factura ---
        const invoicePrefix = 'INV'; // CAMBIADO: Estandarizado a INV
        const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }); // Buscar la última factura creada
        let nextInvoiceNumber = 1;
        if (lastInvoice && lastInvoice.number) {
            const match = lastInvoice.number.match(/^[A-Z]+-(\d+)$/);
            if (match && match[1]) {
                nextInvoiceNumber = parseInt(match[1]) + 1;
            }
        }
        const generatedInvoiceNumber = `${invoicePrefix}-${String(nextInvoiceNumber).padStart(4, '0')}`;
        // --- FIN: Generar número de factura ---


        // --- Preparar datos para la nueva factura ---
        const invoiceToCreate = {
            // Datos del MODAL o valores por defecto
            status: invoiceData.status ? invoiceData.status.toLowerCase() : 'draft',
            date: new Date(), // CAMBIADO: Siempre usamos la fecha actual, independientemente de lo que venga en invoiceData
            paymentTerms: invoiceData.paymentTerms || document.paymentTerms || 'Contado',
            creditDays: invoiceData.creditDays !== undefined ? invoiceData.creditDays : (document.creditDays || 0),

            // Datos del DOCUMENTO ORIGINAL (o recalculados/generados)
            number: generatedInvoiceNumber, // <-- Número de factura generado
            client: document.client._id || document.client,
            items: document.items.map(item => ({
                product: item.product._id || item.product,
                quantity: item.quantity,
                price: item.price,
                taxExempt: item.taxExempt,
                subtotal: item.subtotal // <-- Incluir subtotal del item original
            })),
            subtotal: document.subtotal,
            tax: document.taxAmount, // Asegúrate que el modelo Invoice usa 'tax'
            total: document.total,
            moneda: document.currency,
            notes: document.notes,
            terms: document.terms,
            originalDocument: document._id
        };
        // --- Fin preparación datos ---

        // Crear la factura usando el SERVICIO
        const newInvoice = await invoiceService.createInvoice(invoiceToCreate);

        if (!newInvoice) {
             throw new Error('La creación de la factura falló.');
        }

        // Actualizar el documento original usando el SERVICIO
        const updatedDocument = await documentService.convertToInvoice(id, newInvoice._id);

        res.status(200).json({
            message: 'Documento convertido a factura exitosamente.',
            document: updatedDocument,
            invoice: newInvoice
        });
    } catch (error) {
        // Captura errores de validación y otros
        console.error(`Error convirtiendo documento ${req.params.id} a factura:`, error);
        // Si es un error de validación de Mongoose, el mensaje puede ser útil
        const errorMessage = error.errors ? error._message : (error.message || 'Error interno al convertir a factura');
        res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: errorMessage, details: error.errors });
    }
};
// --- Fin Función Modificada ---

// Función para obtener prefijo según tipo de documento
function getDocumentPrefix(type) {
    switch (type) {
        case 'QUOTE':
            return 'COT';
        case 'PROFORMA':
            return 'PRO';
        case 'DELIVERY_NOTE':
            return 'ALB';
        default:
            return 'DOC';
    }
}

// Exportar todas las funciones
module.exports = exports;