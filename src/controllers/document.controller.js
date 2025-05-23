// controllers/document.controller.js
const mongoose = require('mongoose');
const Document = require('../models/document.model'); // Necesario para validación
const Invoice = require('../models/invoice.model'); // Necesario para conversión
// Importar funciones del servicio adaptado
const documentService = require('../services/document.service');
const invoiceService = require('../services/invoice.service'); // Usar servicio de factura adaptado
// Importar el servicio de numeración
const documentNumberingService = require('../services/document-numbering.service');

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Función auxiliar para normalizar fechas (sin cambios)
function normalizeDate(dateString) {
    if (!dateString) return new Date();
    if (dateString instanceof Date) {
         const date = new Date(dateString);
         date.setUTCHours(12, 0, 0, 0);
         return date;
    }
    if (typeof dateString === 'string') {
        let date = new Date(dateString);
        if (!isNaN(date.getTime()) && dateString.length <= 10 && !dateString.includes('T')) {
             const [year, month, day] = dateString.split('-').map(Number);
             if(year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
             } else {
                 date = new Date(NaN);
             }
        } else if (isNaN(date.getTime())) {
             date = new Date(NaN);
        }
        if (!isNaN(date.getTime())) {
            date.setUTCHours(12, 0, 0, 0);
            return date;
        }
    }
    const today = new Date();
    today.setUTCHours(12,0,0,0);
    return today;
}


/**
 * Obtener todos los documentos de la compañía del usuario.
 * (Sin cambios)
 */
exports.getDocuments = async (req, res) => {
   try {
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getDocuments] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
       console.log(`Controller [getDocuments] - Para CompanyId: ${companyId}`);
       const documents = await documentService.getAllDocuments(companyId);
       res.status(200).json(documents);
   } catch (error) {
       console.error('Controller [getDocuments] - Error:', error.message);
       res.status(500).json({ message: 'Error interno al obtener documentos.' });
   }
};

/**
 * Obtener un documento por ID, verificando que pertenezca a la compañía del usuario.
 * (Sin cambios)
 */
exports.getDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [getDocument] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }
        console.log(`Controller [getDocument] - DocumentID ${id}, CompanyId ${companyId}`);
        const document = await documentService.getDocumentById(id, companyId);
        res.status(200).json(document);
    } catch (error) {
        console.error(`Controller [getDocument] - Error obteniendo documento ${req.params.id}:`, error.message);
        if (error.message === 'Documento no encontrado') {
            return res.status(404).json({ message: 'Documento no encontrado.' });
        }
        if (error.message === 'ID de documento inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno al obtener el documento.' });
    }
};

/**
 * Obtener documentos pendientes (DRAFT, SENT) de la compañía del usuario.
 * (Sin cambios)
 */
exports.getPendingDocuments = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getPendingDocuments] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        const limit = parseInt(req.query.limit) || 5;
        console.log(`Controller [getPendingDocuments] - Para CompanyId: ${companyId}, Limit: ${limit}`);
        const documents = await documentService.getPendingDocuments(companyId, limit);
        res.status(200).json(documents);
    } catch (error) {
        console.error('Controller [getPendingDocuments] - Error:', error.message);
        res.status(500).json({ message: 'Error interno al obtener documentos pendientes.' });
    }
};

/**
 * Crear un nuevo documento para la compañía del usuario.
 * UTILIZA el servicio de numeración.
 */
exports.createDocument = async (req, res) => {
   try {
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [createDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
       console.log(`Controller [createDocument] - Para CompanyId: ${companyId}`);
       const documentData = req.body;
        const allowedTypes = Document.schema.path('type').enumValues;
        if (!documentData.type || !allowedTypes.includes(documentData.type)) {
             return res.status(400).json({ message: `Tipo de documento inválido. Permitidos: ${allowedTypes.join(', ')}` });
        }
        if (!documentData.client || !isValidObjectId(documentData.client)) {
             return res.status(400).json({ message: 'Cliente inválido o faltante.' });
        }
        if (!documentData.items || !Array.isArray(documentData.items) || documentData.items.length === 0) {
             return res.status(400).json({ message: 'Se requiere al menos un ítem en el documento.' });
        }

        // --- INICIO MODIFICACIÓN: Generación de número usando el servicio ---
        const documentType = documentData.type.toLowerCase(); // 'quote', 'proforma', etc.
        // El servicio de numeración debe manejar la atomicidad y la prevención de duplicados
        documentData.documentNumber = await documentNumberingService.getNextDocumentNumber(
            companyId,
            documentType
        );
        console.log(`Controller [createDocument] - Número de documento generado: ${documentData.documentNumber}`);
        // --- FIN MODIFICACIÓN ---

       // --- Cálculo de totales ---
       let calculatedSubtotal = 0;
       let calculatedTax = 0;
       const processedItems = documentData.items.map(item => {
           if (!item.product || !isValidObjectId(item.product) || item.quantity === undefined || item.price === undefined) {
               throw new Error('Cada ítem debe tener producto, cantidad y precio válidos.');
           }
           const quantity = Number(item.quantity);
           const price = Number(item.price);
            if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price < 0) {
                 throw new Error(`Valores inválidos para cantidad (${item.quantity}) o precio (${item.price}) en el ítem.`);
            }
           const itemSubtotal = quantity * price;
           calculatedSubtotal += itemSubtotal;
           if (!item.taxExempt) {
               calculatedTax += itemSubtotal * 0.16;
           }
           return {
               product: item.product,
               quantity: quantity,
               price: price,
               taxExempt: item.taxExempt || false,
               subtotal: itemSubtotal
           };
       });

       // Construir el objeto final para el servicio de creación de documentos
       const newDocumentData = {
           documentNumber: documentData.documentNumber, // Usar el número generado por el servicio
           client: documentData.client,
           type: documentData.type,
           currency: documentData.currency || 'USD',
           notes: documentData.notes || '',
           terms: documentData.terms || '',
           items: processedItems,
           subtotal: calculatedSubtotal,
           taxAmount: calculatedTax,
           total: calculatedSubtotal + calculatedTax,
           date: normalizeDate(documentData.date),
           expiryDate: documentData.expiryDate ? normalizeDate(documentData.expiryDate) : null,
           status: documentData.status || 'DRAFT'
       };

       // Llamar al servicio de creación de documentos
       const document = await documentService.createDocument(newDocumentData, companyId);
       res.status(201).json(document);

   } catch (error) {
       console.error('Controller [createDocument] - Error:', error.message);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        // Capturar error de número duplicado del servicio de numeración
        if (error.message.includes('Ya existe un documento con este número')) {
             return res.status(400).json({ message: 'Error: El número de documento ya existe para esta compañía y tipo.' });
        }
       res.status(500).json({ message: error.message || 'Error interno al crear el documento.' });
   }
};


/**
 * Actualizar un documento, verificando que pertenezca a la compañía del usuario.
 * (Sin cambios - Recordar que no valida stock aquí)
 */
exports.updateDocument = async (req, res) => {
   try {
       const { id } = req.params;
       const companyId = req.user?.companyId;
       const updateData = req.body;

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [updateDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [updateDocument] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }
        console.log(`Controller [updateDocument] - DocumentID ${id}, CompanyId ${companyId}`);

       if (updateData.items) {
            if (!Array.isArray(updateData.items) || updateData.items.length === 0) {
                return res.status(400).json({ message: 'Se requiere al menos un ítem en el documento.' });
            }
            let calculatedSubtotal = 0;
            let calculatedTax = 0;
            const processedItems = updateData.items.map(item => {
               if (!item.product || !isValidObjectId(item.product) || item.quantity === undefined || item.price === undefined) {
                   throw new Error('Cada ítem debe tener producto, cantidad y precio válidos.');
               }
               const quantity = Number(item.quantity);
               const price = Number(item.price);
               if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price < 0) {
                 throw new Error(`Valores inválidos para cantidad (${item.quantity}) o precio (${item.price}) en el ítem.`);
               }
               const itemSubtotal = quantity * price;
               calculatedSubtotal += itemSubtotal;
               if (!item.taxExempt) {
                   calculatedTax += itemSubtotal * 0.16;
               }
               return {
                   product: item.product,
                   quantity: quantity,
                   price: price,
                   taxExempt: item.taxExempt || false,
                   subtotal: itemSubtotal
               };
            });
           updateData.items = processedItems;
           updateData.subtotal = calculatedSubtotal;
           updateData.taxAmount = calculatedTax;
           updateData.total = calculatedSubtotal + calculatedTax;
       }

       if (updateData.date) {
           updateData.date = normalizeDate(updateData.date);
       }
       if (updateData.hasOwnProperty('expiryDate')) {
           updateData.expiryDate = updateData.expiryDate ? normalizeDate(updateData.expiryDate) : null;
       }

       delete updateData.documentNumber;
       delete updateData.type;
       delete updateData.companyId;
       delete updateData.convertedInvoice;

       const document = await documentService.updateDocument(id, updateData, companyId);
       res.status(200).json(document);

   } catch (error) {
       console.error(`Controller [updateDocument] - Error actualizando documento ${req.params.id}:`, error.message);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        if (error.message.startsWith('Documento no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'ID de documento inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
       res.status(500).json({ message: 'Error interno al actualizar el documento.' });
   }
};

/**
 * Eliminar un documento, verificando que pertenezca a la compañía del usuario.
 * (Sin cambios)
 */
exports.deleteDocument = async (req, res) => {
   try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [deleteDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [deleteDocument] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }
       console.log(`Controller [deleteDocument] - DocumentID ${id}, CompanyId ${companyId}`);
       await documentService.deleteDocument(id, companyId);
       res.status(204).end();
   } catch (error) {
       console.error(`Controller [deleteDocument] - Error eliminando documento ${req.params.id}:`, error.message);
        if (error.message.startsWith('Documento no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'ID de documento inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
       res.status(500).json({ message: 'Error interno al eliminar el documento.' });
   }
};

/**
 * Actualizar el estado de un documento, verificando que pertenezca a la compañía del usuario.
 * (Sin cambios)
 */
exports.updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [updateDocumentStatus] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [updateDocumentStatus] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }
        if (!status) {
             return res.status(400).json({ message: 'El nuevo estado es requerido.' });
        }
        const allowedStatuses = Document.schema.path('status').enumValues;
        const upperStatus = status.toUpperCase();
        if (!allowedStatuses.includes(upperStatus)) {
            return res.status(400).json({ message: `Estado no válido: ${status}. Permitidos: ${allowedStatuses.join(', ')}` });
        }
        console.log(`Controller [updateDocumentStatus] - DocumentID ${id}, Status ${upperStatus}, CompanyId ${companyId}`);
        const document = await documentService.updateDocumentStatus(id, upperStatus, companyId);
        res.status(200).json(document);
    } catch (error) {
        console.error(`Controller [updateDocumentStatus] - Error actualizando estado de documento ${req.params.id}:`, error.message);
         if (error.message.startsWith('Documento no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'ID de documento inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
         if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Error de validación: ${error.message}` });
         }
        res.status(500).json({ message: 'Error interno al actualizar el estado del documento.' });
    }
};

/**
 * Convertir un documento (ej. Cotización) a Factura para la compañía del usuario.
 * DELEGA la generación del número de factura al servicio de facturas.
 */
exports.convertToInvoice = async (req, res) => {
    try {
        const { id } = req.params; // ID del documento a convertir
        const invoiceModalData = req.body; // Datos adicionales del modal (status, paymentTerms, etc.)
        const companyId = req.user?.companyId; // ID de la compañía

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [convertToInvoice] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [convertToInvoice] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }
        console.log(`Controller [convertToInvoice] - DocumentID ${id}, CompanyId ${companyId}`);

        // 1. Obtener el documento original
        const originalDocument = await documentService.getDocumentById(id, companyId);

        // 2. Verificar si ya está convertido o no es convertible
        if (originalDocument.status === 'CONVERTED') {
            return res.status(400).json({ message: 'Este documento ya ha sido convertido a factura.' });
        }
        // Añadir más validaciones si es necesario (ej: solo convertir 'QUOTE' o 'PROFORMA')

        // 3. NO generar número de factura aquí. Se delega a invoiceService.createInvoice

        // 4. Preparar datos para la nueva factura (sin el campo 'number')
        const invoiceToCreate = {
            // number: undefined, // Dejar que el servicio de factura lo genere
            client: originalDocument.client._id || originalDocument.client,
            items: originalDocument.items.map(item => ({
                product: item.product._id || item.product,
                quantity: item.quantity,
                price: item.price,
                taxExempt: item.taxExempt,
                subtotal: item.subtotal
            })),
            subtotal: originalDocument.subtotal,
            tax: originalDocument.taxAmount, // Mapear taxAmount a tax
            total: originalDocument.total,
            moneda: originalDocument.currency, // Mapear currency a moneda
            notes: originalDocument.notes,
            terms: originalDocument.terms,
            status: invoiceModalData?.status?.toLowerCase() || 'pending', // Usar estado del modal o 'pending'
            date: normalizeDate(new Date()), // Fecha actual como fecha de factura
            condicionesPago: invoiceModalData?.paymentTerms || 'Contado', // Usar términos del modal o 'Contado'
            diasCredito: invoiceModalData?.creditDays !== undefined ? invoiceModalData.creditDays : 0, // Usar días del modal o 0
            documentType: 'invoice', // Indicar tipo para el servicio de numeración (si es necesario dentro de createInvoice)
            // originalDocument: originalDocument._id // Referencia opcional
        };

        // 5. Crear la factura usando el SERVICIO de facturas
        // Este servicio ahora debe llamar internamente a documentNumberingService
        // y manejar la validación de stock
        const newInvoice = await invoiceService.createInvoice(invoiceToCreate, companyId);

        // 6. Actualizar el documento original usando el SERVICIO de documentos
        const updatedDocument = await documentService.convertToInvoice(id, newInvoice._id, companyId);

        console.log(`Controller [convertToInvoice] - Factura creada ${newInvoice._id} desde Documento ${id}`);
        res.status(200).json({
            message: 'Documento convertido a factura exitosamente.',
            document: updatedDocument,
            invoice: newInvoice
        });

    } catch (error) {
        console.error(`Controller [convertToInvoice] - Error convirtiendo documento ${req.params.id} a factura:`, error.message);
        console.error(error.stack); // Log completo del stacktrace para depuración

        // Manejar error de STOCK_INSUFFICIENTE
        if (error.message.startsWith('STOCK_INSUFFICIENTE')) {
            return res.status(400).json({ message: error.message });
        }
        // Manejar error de número duplicado (desde createInvoice -> documentNumberingService)
        if (error.message.includes('Ya existe una factura con este número') || error.message.includes('Ya existe un documento con este número')) { // Incluir ambos casos por si acaso
            return res.status(400).json({ message: error.message });
        }
        // Otros errores específicos
        if (error.message.startsWith('Documento no encontrado') || error.message.startsWith('Factura no encontrada')) {
             return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('ya ha sido convertido')) {
             return res.status(400).json({ message: error.message });
        }
         if (error.message.startsWith('Producto inválido') || error.message.startsWith('Cliente inválido') || error.message.startsWith('Cantidad inválida')) {
             return res.status(400).json({ message: error.message });
         }
        if (error.name === 'ValidationError') {
             const errors = Object.values(error.errors).map(el => el.message);
             return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        // Error genérico
        res.status(500).json({ message: 'Error interno al convertir el documento a factura.' });
    }
};


// Función auxiliar para obtener prefijo (no se usa para factura, pero se mantiene para documentos)
// DEPRECATED if documentNumberingService handles prefixes
function getDocumentPrefix(type) {
    switch (type?.toUpperCase()) {
        case 'QUOTE': return 'COT';
        case 'PROFORMA': return 'PRO';
        case 'DELIVERY_NOTE': return 'ALB';
        case 'OTHER': return 'DOC';
        default: return 'DOC';
    }
}

// Exportar todas las funciones definidas en este archivo
module.exports = exports;