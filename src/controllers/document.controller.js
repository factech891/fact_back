// controllers/document.controller.js
const mongoose = require('mongoose');
const Document = require('../models/document.model'); // Necesario para generación de número y validación
const Invoice = require('../models/invoice.model'); // Necesario para generación de número de factura
// Importar funciones del servicio adaptado
const documentService = require('../services/document.service');
const invoiceService = require('../services/invoice.service'); // Usar servicio de factura adaptado

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Función auxiliar para normalizar fechas (mejorada)
function normalizeDate(dateString) {
    if (!dateString) return new Date(); // Devuelve fecha actual si no hay string

    // Si ya es un objeto Date, solo ajustar hora
    if (dateString instanceof Date) {
         const date = new Date(dateString);
         // Fijar al mediodía UTC para evitar saltos de día por zona horaria local del servidor/cliente
         date.setUTCHours(12, 0, 0, 0);
         return date;
    }

    // Si es un string
    if (typeof dateString === 'string') {
        // Intentar parsear como ISO 8601 (incluye zona horaria si existe)
        let date = new Date(dateString);
        // Si el parseo es válido y no tiene ya hora/zona explícita (ej. solo YYYY-MM-DD)
        if (!isNaN(date.getTime()) && dateString.length <= 10 && !dateString.includes('T')) {
             // Asumir mediodía UTC para evitar saltos de día por zona horaria
             const [year, month, day] = dateString.split('-').map(Number);
             // Validar partes antes de crear fecha
             if(year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
             } else {
                 date = new Date(NaN); // Marcar como inválida si las partes no son correctas
             }
        } else if (isNaN(date.getTime())) {
             // Si el parseo inicial falla, podría ser otro formato o inválido
             date = new Date(NaN); // Marcar como inválida
        }
         // Si después de todo es una fecha válida, devolverla ajustada a UTC mediodía, si no, devolver fecha actual
        if (!isNaN(date.getTime())) {
            date.setUTCHours(12, 0, 0, 0);
            return date;
        }
    }

    // Si no es string ni Date válida, devolver fecha actual
    const today = new Date();
    today.setUTCHours(12,0,0,0);
    return today;
}


/**
 * Obtener todos los documentos de la compañía del usuario.
 */
exports.getDocuments = async (req, res) => {
   try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getDocuments] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

       console.log(`Controller [getDocuments] - Para CompanyId: ${companyId}`);
       // Llamar al servicio con companyId
       const documents = await documentService.getAllDocuments(companyId);
       res.status(200).json(documents);

   } catch (error) {
       console.error('Controller [getDocuments] - Error:', error.message);
       res.status(500).json({ message: 'Error interno al obtener documentos.' });
   }
};

/**
 * Obtener un documento por ID, verificando que pertenezca a la compañía del usuario.
 */
exports.getDocument = async (req, res) => { // Nombre de función corregido/confirmado
    try {
        const { id } = req.params; // ID del documento
        const companyId = req.user?.companyId; // ID de la compañía

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [getDocument] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }

        console.log(`Controller [getDocument] - DocumentID ${id}, CompanyId ${companyId}`);
        // Llamar al servicio con ID de documento y companyId
        const document = await documentService.getDocumentById(id, companyId);
        // El servicio lanza error si no se encuentra o no pertenece a la compañía
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
 */
exports.getPendingDocuments = async (req, res) => {
    try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [getPendingDocuments] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

        const limit = parseInt(req.query.limit) || 5; // Default limit 5
        console.log(`Controller [getPendingDocuments] - Para CompanyId: ${companyId}, Limit: ${limit}`);
        // Llamar al servicio con companyId y limit
        const documents = await documentService.getPendingDocuments(companyId, limit);
        res.status(200).json(documents);

    } catch (error) {
        console.error('Controller [getPendingDocuments] - Error:', error.message);
        res.status(500).json({ message: 'Error interno al obtener documentos pendientes.' });
    }
};

/**
 * Crear un nuevo documento para la compañía del usuario.
 */
exports.createDocument = async (req, res) => {
   try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [createDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

       console.log(`Controller [createDocument] - Para CompanyId: ${companyId}`);
       const documentData = req.body;

       // Validar tipo de documento
        const allowedTypes = Document.schema.path('type').enumValues;
        if (!documentData.type || !allowedTypes.includes(documentData.type)) {
             return res.status(400).json({ message: `Tipo de documento inválido. Permitidos: ${allowedTypes.join(', ')}` });
        }
        // Validar cliente y items básicos
        if (!documentData.client || !isValidObjectId(documentData.client)) {
             return res.status(400).json({ message: 'Cliente inválido o faltante.' });
        }
        if (!documentData.items || !Array.isArray(documentData.items) || documentData.items.length === 0) {
             return res.status(400).json({ message: 'Se requiere al menos un ítem en el documento.' });
        }

       // --- Generar número único de documento POR COMPAÑÍA Y TIPO ---
       const prefix = getDocumentPrefix(documentData.type);
       const lastDocument = await Document.findOne({ companyId: companyId, type: documentData.type })
            .sort({ createdAt: -1 });
       let nextNumber = 1;
       if (lastDocument && lastDocument.documentNumber) {
           const match = lastDocument.documentNumber.match(/^[A-Z]+(?:-[A-Z]+)*-(\d+)$/); // Ajustar regex si el prefijo cambia
           if (match && match[1]) {
               nextNumber = parseInt(match[1], 10) + 1;
           }
       }
       const documentNumber = `${prefix}-${String(nextNumber).padStart(5, '0')}`; // Ajustar padding si es necesario
       documentData.documentNumber = documentNumber;
        // Verificar si el número generado ya existe
       const existingNumber = await documentService.getDocumentByNumber(documentNumber, companyId);
        if (existingNumber) {
            console.error(`Controller [createDocument] - Error: Número de documento generado ${documentNumber} ya existe para CompanyId ${companyId}`);
            return res.status(500).json({ message: 'Error al generar número de documento único. Intente nuevamente.' });
        }
       // --- Fin Generación Número ---

       // Procesar items y calcular totales
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
               calculatedTax += itemSubtotal * 0.16; // Ejemplo IVA 16%
           }
           return {
               product: item.product,
               quantity: quantity,
               price: price,
               taxExempt: item.taxExempt || false,
               subtotal: itemSubtotal
           };
       });

       // Crear el objeto final para el servicio
       const newDocumentData = {
           documentNumber: documentNumber,
           client: documentData.client,
           type: documentData.type,
           currency: documentData.currency || 'USD', // Default currency
           notes: documentData.notes || '',
           terms: documentData.terms || '',
           items: processedItems,
           subtotal: calculatedSubtotal,
           taxAmount: calculatedTax, // Asegúrate que el modelo usa 'taxAmount'
           total: calculatedSubtotal + calculatedTax,
           date: normalizeDate(documentData.date),
           expiryDate: documentData.expiryDate ? normalizeDate(documentData.expiryDate) : null,
           status: documentData.status || 'DRAFT'
           // companyId será añadido por el servicio
       };

       // Llamar al servicio de creación pasando datos y companyId
       const document = await documentService.createDocument(newDocumentData, companyId);

       res.status(201).json(document);

   } catch (error) {
       console.error('Controller [createDocument] - Error:', error.message);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        if (error.message.includes('duplicate key') || error.message.includes('Ya existe un documento con este número')) {
             return res.status(400).json({ message: 'Error: El número de documento ya existe para esta compañía y tipo.' });
        }
       res.status(500).json({ message: error.message || 'Error interno al crear el documento.' });
   }
};

/**
 * Actualizar un documento, verificando que pertenezca a la compañía del usuario.
 */
exports.updateDocument = async (req, res) => {
   try {
       const { id } = req.params; // ID del documento
       const companyId = req.user?.companyId; // ID de la compañía
       const updateData = req.body; // Datos a actualizar

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller [updateDocument] - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller [updateDocument] - ID de documento inválido: ${id}`);
            return res.status(400).json({ message: 'ID de documento inválido.' });
        }

        console.log(`Controller [updateDocument] - DocumentID ${id}, CompanyId ${companyId}`);

       // Recalcular totales si hay cambios en los items
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
                   calculatedTax += itemSubtotal * 0.16; // Ejemplo IVA 16%
               }
               // Reconstruir el objeto item completo
               return {
                   product: item.product, // Mantener ID o objeto poblado si viene
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

       // Normalizar fechas si están presentes
       if (updateData.date) {
           updateData.date = normalizeDate(updateData.date);
       }
       if (updateData.hasOwnProperty('expiryDate')) { // Permitir borrar fecha de expiración
           updateData.expiryDate = updateData.expiryDate ? normalizeDate(updateData.expiryDate) : null;
       }


       // Evitar que se cambien campos clave
       delete updateData.documentNumber;
       delete updateData.type;
       delete updateData.companyId;
       delete updateData.convertedInvoice; // No se puede 'desconvertir' aquí

        // Llamar al servicio de actualización pasando id, datos y companyId
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
 */
exports.deleteDocument = async (req, res) => {
   try {
        const { id } = req.params; // ID del documento
        const companyId = req.user?.companyId; // ID de la compañía

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

       res.status(204).end(); // Éxito, sin contenido

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
 */
exports.updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params; // ID del documento
        const { status } = req.body; // Nuevo estado
        const companyId = req.user?.companyId; // ID de la compañía

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

        // Validar que el estado sea uno de los permitidos por el modelo
        const allowedStatuses = Document.schema.path('status').enumValues;
        const upperStatus = status.toUpperCase(); // Comparar en mayúsculas
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
 */
exports.convertToInvoice = async (req, res) => {
    try {
        const { id } = req.params; // ID del documento a convertir
        const invoiceModalData = req.body; // Datos adicionales del modal
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

        // 1. Obtener el documento original (filtrado por compañía)
        const originalDocument = await documentService.getDocumentById(id, companyId);

        // 2. Verificar si ya está convertido o no es convertible
        if (originalDocument.status === 'CONVERTED') {
            return res.status(400).json({ message: 'Este documento ya ha sido convertido a factura.' });
        }
        // Añadir más validaciones si es necesario (ej. solo convertir QUOTE)

        // 3. Generar número único de factura POR COMPAÑÍA
        const invoicePrefix = 'INV';
        const lastInvoice = await Invoice.findOne({ companyId: companyId }).sort({ createdAt: -1 });
        let nextInvoiceNumber = 1;
        if (lastInvoice && lastInvoice.number) {
            const match = lastInvoice.number.match(/^[A-Z]+(?:-[A-Z]+)*-(\d+)$/); // Ajustar regex si el prefijo cambia
            if (match && match[1]) {
                nextInvoiceNumber = parseInt(match[1], 10) + 1;
            }
        }
        const generatedInvoiceNumber = `${invoicePrefix}-${String(nextInvoiceNumber).padStart(5, '0')}`;
        // Verificar si el número generado ya existe
        const existingInvoiceNumber = await invoiceService.getInvoiceByNumber(generatedInvoiceNumber, companyId);
         if (existingInvoiceNumber) {
             console.error(`Controller [convertToInvoice] - Error: Número de factura generado ${generatedInvoiceNumber} ya existe para CompanyId ${companyId}`);
             return res.status(500).json({ message: 'Error al generar número de factura único. Intente nuevamente.' });
         }
        // --- Fin Generación Número Factura ---

        // 4. Preparar datos para la nueva factura
        const invoiceToCreate = {
            number: generatedInvoiceNumber,
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
            moneda: originalDocument.currency,
            notes: originalDocument.notes,
            terms: originalDocument.terms,
            status: invoiceModalData?.status?.toLowerCase() || 'pending', // Usar estado del modal o 'pending'
            date: normalizeDate(new Date()), // Fecha de creación de la factura
            paymentTerms: invoiceModalData?.paymentTerms || 'Contado',
            creditDays: invoiceModalData?.creditDays !== undefined ? invoiceModalData.creditDays : 0,
            // companyId será añadido por el servicio
            // originalDocument: originalDocument._id // Referencia opcional
        };

        // 5. Crear la factura usando el SERVICIO de facturas
        const newInvoice = await invoiceService.createInvoice(invoiceToCreate, companyId);

        // 6. Actualizar el documento original usando el SERVICIO de documentos
        const updatedDocument = await documentService.convertToInvoice(id, newInvoice._id, companyId);

        res.status(200).json({
            message: 'Documento convertido a factura exitosamente.',
            document: updatedDocument,
            invoice: newInvoice
        });

    } catch (error) {
        console.error(`Controller [convertToInvoice] - Error convirtiendo documento ${req.params.id} a factura:`, error.message);
        if (error.message.startsWith('Documento no encontrado') || error.message.startsWith('Factura no encontrada')) {
             return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('ya ha sido convertido')) {
             return res.status(400).json({ message: error.message });
        }
        if (error.name === 'ValidationError') {
             const errors = Object.values(error.errors).map(el => el.message);
             return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Error interno al convertir el documento a factura.' });
    }
};


// Función auxiliar para obtener prefijo (se mantiene)
function getDocumentPrefix(type) {
    switch (type?.toUpperCase()) { // Usar toUpperCase para ser insensible a mayúsculas/minúsculas
        case 'QUOTE': return 'COT';
        case 'PROFORMA': return 'PRO';
        case 'DELIVERY_NOTE': return 'ALB'; // Nota de Entrega / Albarán
        case 'OTHER': return 'DOC'; // Otros
        default: return 'DOC'; // Prefijo por defecto
    }
}

// Exportar todas las funciones definidas en este archivo
module.exports = exports;
