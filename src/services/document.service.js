// services/document.service.js
const mongoose = require('mongoose');
const Document = require('../models/document.model'); 

/**
 * Obtener todos los documentos de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Array>} Lista de documentos de esa compañía.
 */
const getAllDocuments = async (companyId) => {
   try {
       console.log('Servicio - Obteniendo todos los documentos para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }
       // Filtrar por companyId y poblar referencias
       return await Document.find({ companyId: companyId })
           .populate('client') // Asume que Client tiene companyId
           .populate({ // Mismo comentario que en facturas sobre poblar productos
                path: 'items.product',
                model: 'Product' // Asegúrate que 'Product' es el nombre correcto
           })
           .populate('convertedInvoice') // Poblar la factura si fue convertido
           .sort({ date: -1 });
   } catch (error) {
       console.error('Servicio - Error al obtener los documentos:', error);
       throw new Error(`Error al obtener los documentos: ${error.message}`);
   }
};

/**
 * Obtener un documento por ID, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del documento.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento encontrado.
 */
const getDocumentById = async (id, companyId) => {
   try {
       console.log('Servicio - Obteniendo documento por ID:', id, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de documento inválido:', id);
           throw new Error('ID de documento inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Buscar por ID y companyId, y poblar referencias
       const document = await Document.findOne({ _id: id, companyId: companyId })
           .populate('client')
           .populate({ path: 'items.product', model: 'Product' })
           .populate('convertedInvoice');

       if (!document) {
           console.log('Servicio - Documento no encontrado con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Documento no encontrado');
       }
       console.log('Servicio - Documento encontrado:', document._id);
       return document;
   } catch (error) {
       if (error.message !== 'Documento no encontrado' && error.message !== 'ID de documento inválido') {
           console.error('Servicio - Error al obtener el documento por ID:', error);
       }
       throw error; // Re-lanzar
   }
};

/**
 * Obtener documentos pendientes (DRAFT, SENT) de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @param {number} [limit=5] - Límite de documentos a devolver.
 * @returns {Promise<Array>} Lista de documentos pendientes.
 */
const getPendingDocuments = async (companyId, limit = 5) => {
    try {
        console.log('Servicio - Obteniendo documentos pendientes para CompanyId:', companyId, 'Límite:', limit);
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            console.error('Servicio - ID de compañía inválido:', companyId);
            throw new Error('ID de compañía inválido');
        }
        // Filtrar por status y companyId
        return await Document.find({
                status: { $in: ['DRAFT', 'SENT'] }, // Ajusta los estados según tu modelo
                companyId: companyId
            })
            .populate('client')
            .sort({ date: -1 })
            .limit(limit);
    } catch (error) {
        console.error('Servicio - Error al obtener documentos pendientes:', error);
        throw new Error(`Error al obtener documentos pendientes: ${error.message}`);
    }
};


/**
 * Crear un nuevo documento asociado a una compañía específica.
 * @param {Object} documentData - Datos del documento.
 * @param {string} companyId - ID de la compañía del usuario autenticado.
 * @returns {Promise<Object>} Documento creado.
 */
const createDocument = async (documentData, companyId) => {
   try {
       console.log('Servicio - Datos recibidos para crear documento:', documentData, 'CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para crear documento:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Asignar el companyId al documento
       documentData.companyId = companyId;

       const newDocument = new Document(documentData);
       const savedDocument = await newDocument.save();

       // Poblar el documento guardado antes de devolverlo
       const populatedDocument = await getDocumentById(savedDocument._id, companyId);

       console.log('Servicio - Documento guardado exitosamente:', savedDocument._id, 'para CompanyId:', companyId);
       return populatedDocument; // Devolver documento poblado
   } catch (error) {
       console.error('Servicio - Error al crear el documento:', error);
        // Manejar errores específicos, como duplicados de 'documentNumber' si hay índice
       if (error.code === 11000 || error.message.includes('duplicate key')) {
            const field = Object.keys(error.keyPattern)[0];
            throw new Error(`Error al crear el documento: Ya existe un documento con este ${field === 'documentNumber' ? 'número' : field} en esta compañía.`);
       }
       throw new Error(`Error al crear el documento: ${error.message}`);
   }
};

/**
 * Actualizar un documento, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del documento.
 * @param {Object} documentData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento actualizado.
 */
const updateDocument = async (id, documentData, companyId) => {
   try {
       console.log('Servicio - Datos recibidos para actualizar documento:', id, 'Data:', documentData, 'CompanyId:', companyId);

       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de documento inválido para actualizar:', id);
           throw new Error('ID de documento inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para actualizar:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Asegurarse de no cambiar el companyId durante la actualización
       delete documentData.companyId;

       // Validación opcional de cliente/productos si se cambian

       // Buscar y actualizar solo si el _id y companyId coinciden
       const updatedDocument = await Document.findOneAndUpdate(
           { _id: id, companyId: companyId }, // Condición de búsqueda
           documentData,
           { new: true, runValidators: true } // Opciones
       ).populate('client').populate({ path: 'items.product', model: 'Product' }).populate('convertedInvoice');

       if (!updatedDocument) {
           console.log('Servicio - Documento no encontrado para actualizar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Documento no encontrado o no tiene permiso para actualizarlo');
       }

       console.log('Servicio - Documento actualizado exitosamente:', updatedDocument._id);
       return updatedDocument;
   } catch (error) {
       if (error.message !== 'Documento no encontrado o no tiene permiso para actualizarlo' && error.message !== 'ID de documento inválido') {
           console.error('Servicio - Error al actualizar el documento:', error);
       }
        // Manejar errores de duplicados (ej. número de documento)
       if (error.code === 11000 || error.message.includes('duplicate key')) {
            const field = Object.keys(error.keyPattern)[0];
            throw new Error(`Error al actualizar el documento: Ya existe otro documento con este ${field === 'documentNumber' ? 'número' : field} en esta compañía.`);
       }
       throw new Error(`Error al actualizar el documento: ${error.message}`);
   }
};

/**
 * Eliminar un documento, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del documento.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento eliminado.
 */
const deleteDocument = async (id, companyId) => {
   try {
       console.log('Servicio - Intentando eliminar documento con ID:', id, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de documento inválido para eliminar:', id);
           throw new Error('ID de documento inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para eliminar:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Buscar y eliminar solo si el _id y companyId coinciden
       const deletedDocument = await Document.findOneAndDelete({ _id: id, companyId: companyId });

       if (!deletedDocument) {
           console.log('Servicio - Documento no encontrado para eliminar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Documento no encontrado o no tiene permiso para eliminarlo');
       }

       console.log('Servicio - Documento eliminado exitosamente:', id);
       return deletedDocument;
   } catch (error) {
       if (error.message !== 'Documento no encontrado o no tiene permiso para eliminarlo' && error.message !== 'ID de documento inválido') {
           console.error('Servicio - Error al eliminar el documento:', error);
       }
       throw new Error(`Error al eliminar el documento: ${error.message}`);
   }
};

/**
 * Obtener un documento por número, asegurando que pertenezca a la compañía correcta.
 * @param {string} documentNumber - Número del documento.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento encontrado.
 */
const getDocumentByNumber = async (documentNumber, companyId) => {
    try {
        console.log('Servicio - Obteniendo documento por Número:', documentNumber, 'para CompanyId:', companyId);
        if (!documentNumber || String(documentNumber).trim() === '') {
            throw new Error('El número de documento no puede estar vacío.');
        }
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
          console.error('Servicio - ID de compañía inválido:', companyId);
          throw new Error('ID de compañía inválido');
        }

        // Buscar por número y companyId
        const document = await Document.findOne({ documentNumber: documentNumber, companyId: companyId })
            .populate('client')
            .populate({ path: 'items.product', model: 'Product' })
            .populate('convertedInvoice');

        if (!document) {
          console.log('Servicio - Documento no encontrado con Número:', documentNumber, 'para CompanyId:', companyId);
          return null; // O lanzar error
        }
        console.log('Servicio - Documento encontrado por número:', document._id);
        return document;
    } catch (error) {
        console.error('Servicio - Error al obtener el documento por número:', error);
        if (error.message === 'ID de compañía inválido') {
             throw new Error('Error interno del servidor.');
        }
        throw new Error(`Error al buscar documento por número: ${error.message}`);
    }
};

/**
 * Actualizar el estado de un documento, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del documento.
 * @param {string} status - Nuevo estado.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento actualizado.
 */
const updateDocumentStatus = async (id, status, companyId) => {
   try {
       console.log('Servicio - Actualizando estado de documento:', id, 'a', status, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de documento inválido para actualizar estado:', id);
           throw new Error('ID de documento inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para actualizar estado:', companyId);
           throw new Error('ID de compañía inválido');
       }
     
       const updatedDocument = await Document.findOneAndUpdate(
           { _id: id, companyId: companyId }, // Condición
           { status: status }, // Datos a actualizar
           { new: true, runValidators: true } // Opciones
       ).populate('client').populate({ path: 'items.product', model: 'Product' }).populate('convertedInvoice');

       if (!updatedDocument) {
           console.log('Servicio - Documento no encontrado para actualizar estado con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Documento no encontrado o no tiene permiso para actualizarlo');
       }

       console.log('Servicio - Estado de documento actualizado exitosamente:', updatedDocument._id);
       return updatedDocument;
   } catch (error) {
        if (error.message !== 'Documento no encontrado o no tiene permiso para actualizarlo' && error.message !== 'ID de documento inválido') {
           console.error('Servicio - Error al actualizar estado del documento:', error);
       }
       // Considerar errores de validación del estado
       if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            throw new Error(`Error de validación: ${errors.join(', ')}`);
       }
       throw new Error(`Error al actualizar estado del documento: ${error.message}`);
   }
};

/**
 * Marcar un documento como convertido a factura, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del documento a marcar.
 * @param {string} invoiceId - ID de la factura creada a partir del documento.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Documento actualizado.
 */
const convertToInvoice = async (id, invoiceId, companyId) => {
    try {
        console.log('Servicio - Marcando documento como convertido:', id, 'a Factura ID:', invoiceId, 'para CompanyId:', companyId);
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(invoiceId)) {
            console.warn('Servicio - ID de documento o factura inválido para conversión:', id, invoiceId);
            throw new Error('ID de documento o factura inválido');
        }
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            console.error('Servicio - ID de compañía inválido para conversión:', companyId);
            throw new Error('ID de compañía inválido');
        }
        // Opcional: Validar que la factura 'invoiceId' también pertenezca a 'companyId'

        // Buscar y actualizar estado y referencia a factura solo si el _id y companyId coinciden
        const updatedDocument = await Document.findOneAndUpdate(
            { _id: id, companyId: companyId, status: { $ne: 'CONVERTED' } }, // Condición (evitar convertir dos veces)
            {
                status: 'CONVERTED', // O el estado que uses para 'convertido'
                convertedInvoice: invoiceId
            },
            { new: true, runValidators: true } // Opciones
        ).populate('client').populate({ path: 'items.product', model: 'Product' }).populate('convertedInvoice');

        if (!updatedDocument) {
            console.log('Servicio - Documento no encontrado, ya convertido, o sin permiso para convertir con ID:', id, 'para CompanyId:', companyId);
            // Podrías querer buscar el documento sin el filtro de status para dar un mensaje más específico
            const docExists = await Document.findOne({ _id: id, companyId: companyId });
            if (!docExists) {
                 throw new Error('Documento no encontrado o no tiene permiso para convertirlo');
            } else if (docExists.status === 'CONVERTED') {
                 throw new Error('Este documento ya ha sido convertido a factura.');
            } else {
                 throw new Error('No se pudo marcar el documento como convertido.'); // Error genérico
            }
        }

        console.log('Servicio - Documento marcado como convertido exitosamente:', updatedDocument._id);
        return updatedDocument;
    } catch (error) {
        if (!error.message.includes('Documento no encontrado') && !error.message.includes('ya ha sido convertido')) {
            console.error('Servicio - Error al marcar documento como convertido:', error);
        }
        throw new Error(`Error al convertir documento a factura: ${error.message}`);
    }
};


module.exports = {
   getAllDocuments,
   getDocumentById,
   getPendingDocuments,
   createDocument,
   updateDocument,
   deleteDocument,
   getDocumentByNumber,
   updateDocumentStatus,
   convertToInvoice
};