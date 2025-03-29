// controllers/document.controller.js
const Document = require('../models/document.model');
const documentService = require('../services/document.service');

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
       const lastDocument = await Document.findOne({ type: documentData.type }).sort({ documentNumber: -1 });
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
       const newDocument = {
           ...documentData,
           documentNumber,
           items: processedItems,
           subtotal,
           taxAmount,
           total: subtotal + taxAmount
       };

       const document = await documentService.createDocument(newDocument);
       
       // Poblar los datos del cliente y productos
       await document.populate('client');
       await document.populate('items.product');

       res.status(201).json(document);
   } catch (error) {
       console.error('Error al crear documento:', error);
       res.status(400).json({ error: error.message });
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
       res.status(500).json({ message: error.message });
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
       res.status(500).json({ message: error.message });
   }
};

exports.updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Validar que el estado sea uno de los permitidos
        const allowedStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }
        
        const document = await documentService.updateDocumentStatus(id, status);
        
        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        
        res.status(200).json(document);
    } catch (error) {
        console.error(`Error actualizando estado de documento ${req.params.id}:`, error);
        res.status(500).json({ message: error.message });
    }
};

exports.convertToInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const invoiceData = req.body;
        
        // Primero obtener el documento para convertirlo a factura
        const document = await documentService.getDocumentById(id);
        
        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        
        if (document.status === 'CONVERTED') {
            return res.status(400).json({ message: 'Este documento ya ha sido convertido a factura' });
        }
        
        // Crear objeto para la nueva factura
        const invoiceController = require('./invoice.controller');
        
        // Preparar datos de la factura a partir del documento
        const invoiceToCreate = {
            client: document.client._id,
            items: document.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.price,
                taxExempt: item.taxExempt
            })),
            subtotal: document.subtotal,
            tax: document.taxAmount,
            total: document.total,
            moneda: document.currency,
            condicionesPago: document.paymentTerms,
            diasCredito: document.creditDays,
            status: 'draft'
        };
        
        // Crear la factura usando el controlador de facturas
        // Aquí estamos simulando una solicitud a la API de facturas
        const mockReq = { body: invoiceToCreate };
        const mockRes = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.data = data;
                return this;
            }
        };
        
        await invoiceController.createOrUpdateInvoice(mockReq, mockRes);
        
        if (mockRes.statusCode !== 201) {
            throw new Error('Error al crear factura');
        }
        
        // Actualizar el documento como convertido y guardar referencia a la factura
        const updatedDocument = await documentService.convertToInvoice(id, mockRes.data._id);
        
        res.status(200).json({
            document: updatedDocument,
            invoice: mockRes.data
        });
    } catch (error) {
        console.error(`Error convirtiendo documento ${req.params.id} a factura:`, error);
        res.status(500).json({ message: error.message });
    }
};

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