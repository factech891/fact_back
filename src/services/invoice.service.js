// services/invoice.service.js
const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model'); // Asegúrate que la ruta sea correcta

/**
 * Obtener todas las facturas de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Array>} Lista de facturas de esa compañía.
 */
const getAllInvoices = async (companyId) => {
   try {
       console.log('Servicio - Obteniendo todas las facturas para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }
       // Filtrar por companyId y poblar referencias
       return await Invoice.find({ companyId: companyId })
           .populate('client') // Asegúrate que el modelo Client tenga companyId para seguridad adicional si es necesario
           // Poblar producto dentro de items requiere cuidado si los productos también son por compañía
           // Si Product model tiene companyId, Mongoose no filtrará automáticamente aquí.
           // Se necesitaría lógica adicional si solo quieres poblar productos de la misma compañía.
           // Por ahora, poblamos todos los referenciados.
           .populate({
                path: 'items.product',
                model: 'Product' // Asegúrate que 'Product' es el nombre correcto del modelo
                // Podrías añadir un match aquí si quisieras filtrar productos poblados,
                // pero puede ser complejo y afectar rendimiento.
                // match: { companyId: companyId } // ¡CUIDADO! Esto podría dejar items.product en null si el producto es de otra compañía
           })
           .sort({ date: -1 }); // Ordenar por fecha, más recientes primero
   } catch (error) {
       console.error('Servicio - Error al obtener las facturas:', error);
       throw new Error(`Error al obtener las facturas: ${error.message}`);
   }
};

/**
 * Obtener una factura por ID, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID de la factura.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura encontrada.
 */
const getInvoiceById = async (id, companyId) => {
   try {
       console.log('Servicio - Obteniendo factura por ID:', id, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de factura inválido:', id);
           throw new Error('ID de factura inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Buscar por ID y companyId, y poblar referencias
       const invoice = await Invoice.findOne({ _id: id, companyId: companyId })
           .populate('client')
           .populate({
                path: 'items.product',
                model: 'Product'
                // Mismo comentario que en getAllInvoices sobre poblar productos
           });

       if (!invoice) {
           console.log('Servicio - Factura no encontrada con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada');
       }
       console.log('Servicio - Factura encontrada:', invoice._id);
       return invoice;
   } catch (error) {
       if (error.message !== 'Factura no encontrada' && error.message !== 'ID de factura inválido') {
           console.error('Servicio - Error al obtener la factura por ID:', error);
       }
       throw error; // Re-lanzar para que el controlador lo maneje
   }
};

/**
 * Crear una nueva factura asociada a una compañía específica.
 * @param {Object} invoiceData - Datos de la factura.
 * @param {string} companyId - ID de la compañía del usuario autenticado.
 * @returns {Promise<Object>} Factura creada.
 */
const createInvoice = async (invoiceData, companyId) => {
   try {
       console.log('Servicio - Datos recibidos para crear factura:', invoiceData, 'CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para crear factura:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Asignar el companyId a la factura
       invoiceData.companyId = companyId;

       // Aquí podrías añadir validaciones extra, como verificar que el cliente
       // y los productos pertenezcan a la misma companyId antes de guardar.
       // Ejemplo (requiere buscar cliente y productos):
       // const client = await Client.findOne({ _id: invoiceData.client, companyId: companyId });
       // if (!client) throw new Error('Cliente inválido o no pertenece a esta compañía.');
       // for (const item of invoiceData.items) {
       //     const product = await Product.findOne({ _id: item.product, companyId: companyId });
       //     if (!product) throw new Error(`Producto inválido (${item.product}) o no pertenece a esta compañía.`);
       // }

       const newInvoice = new Invoice(invoiceData);
       const savedInvoice = await newInvoice.save();

       // Poblar la factura guardada antes de devolverla
       const populatedInvoice = await getInvoiceById(savedInvoice._id, companyId);

       console.log('Servicio - Factura guardada exitosamente:', savedInvoice._id, 'para CompanyId:', companyId);
       return populatedInvoice; // Devolver factura poblada
   } catch (error) {
       console.error('Servicio - Error al crear la factura:', error);
        // Manejar errores específicos, como duplicados de 'number' si hay índice
       if (error.code === 11000 || error.message.includes('duplicate key')) {
            const field = Object.keys(error.keyPattern)[0];
            throw new Error(`Error al crear la factura: Ya existe una factura con este ${field === 'number' ? 'número' : field} en esta compañía.`);
       }
       throw new Error(`Error al crear la factura: ${error.message}`);
   }
};

/**
 * Actualizar una factura, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID de la factura.
 * @param {Object} invoiceData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura actualizada.
 */
const updateInvoice = async (id, invoiceData, companyId) => {
   try {
       console.log('Servicio - Datos recibidos para actualizar factura:', id, 'Data:', invoiceData, 'CompanyId:', companyId);

       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de factura inválido para actualizar:', id);
           throw new Error('ID de factura inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para actualizar:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Asegurarse de no cambiar el companyId durante la actualización
       delete invoiceData.companyId;

       // Validar que cliente y productos pertenezcan a la compañía si se cambian (opcional pero recomendado)

       // Buscar y actualizar solo si el _id y companyId coinciden
       const updatedInvoice = await Invoice.findOneAndUpdate(
           { _id: id, companyId: companyId }, // Condición de búsqueda
           invoiceData, // Usar el objeto completo o $set dependiendo de si quieres reemplazar o fusionar
           { new: true, runValidators: true } // Opciones
       ).populate('client').populate({ path: 'items.product', model: 'Product' });

       if (!updatedInvoice) {
           console.log('Servicio - Factura no encontrada para actualizar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
       }

       console.log('Servicio - Factura actualizada exitosamente:', updatedInvoice._id);
       return updatedInvoice;
   } catch (error) {
       if (error.message !== 'Factura no encontrada o no tiene permiso para actualizarla' && error.message !== 'ID de factura inválido') {
           console.error('Servicio - Error al actualizar la factura:', error);
       }
        // Manejar errores de duplicados (ej. número de factura)
       if (error.code === 11000 || error.message.includes('duplicate key')) {
            const field = Object.keys(error.keyPattern)[0];
            throw new Error(`Error al actualizar la factura: Ya existe otra factura con este ${field === 'number' ? 'número' : field} en esta compañía.`);
       }
       throw new Error(`Error al actualizar la factura: ${error.message}`);
   }
};

/**
 * Eliminar una factura, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID de la factura.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura eliminada.
 */
const deleteInvoice = async (id, companyId) => {
   try {
       console.log('Servicio - Intentando eliminar factura con ID:', id, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de factura inválido para eliminar:', id);
           throw new Error('ID de factura inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para eliminar:', companyId);
           throw new Error('ID de compañía inválido');
       }

       // Buscar y eliminar solo si el _id y companyId coinciden
       const deletedInvoice = await Invoice.findOneAndDelete({ _id: id, companyId: companyId });

       if (!deletedInvoice) {
           console.log('Servicio - Factura no encontrada para eliminar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para eliminarla');
       }

       console.log('Servicio - Factura eliminada exitosamente:', id);
       return deletedInvoice;
   } catch (error) {
       if (error.message !== 'Factura no encontrada o no tiene permiso para eliminarla' && error.message !== 'ID de factura inválido') {
           console.error('Servicio - Error al eliminar la factura:', error);
       }
       throw new Error(`Error al eliminar la factura: ${error.message}`);
   }
};

/**
 * Obtener una factura por número, asegurando que pertenezca a la compañía correcta.
 * @param {string} number - Número de la factura.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura encontrada.
 */
const getInvoiceByNumber = async (number, companyId) => {
    try {
        console.log('Servicio - Obteniendo factura por Número:', number, 'para CompanyId:', companyId);
        if (!number || String(number).trim() === '') {
            throw new Error('El número de factura no puede estar vacío.');
        }
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
          console.error('Servicio - ID de compañía inválido:', companyId);
          throw new Error('ID de compañía inválido');
        }

        // Buscar por número y companyId
        const invoice = await Invoice.findOne({ number: number, companyId: companyId })
            .populate('client')
            .populate({ path: 'items.product', model: 'Product' });

        if (!invoice) {
          console.log('Servicio - Factura no encontrada con Número:', number, 'para CompanyId:', companyId);
          return null; // O lanzar error si se espera que exista
        }
        console.log('Servicio - Factura encontrada por número:', invoice._id);
        return invoice;
    } catch (error) {
        console.error('Servicio - Error al obtener la factura por número:', error);
        if (error.message === 'ID de compañía inválido') {
             throw new Error('Error interno del servidor.');
        }
        throw new Error(`Error al buscar factura por número: ${error.message}`);
    }
};

/**
 * Actualizar el estado de una factura, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID de la factura.
 * @param {string} status - Nuevo estado.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura actualizada.
 */
const updateInvoiceStatus = async (id, status, companyId) => {
   try {
       console.log('Servicio - Actualizando estado de factura:', id, 'a', status, 'para CompanyId:', companyId);
       if (!mongoose.Types.ObjectId.isValid(id)) {
           console.warn('Servicio - ID de factura inválido para actualizar estado:', id);
           throw new Error('ID de factura inválido');
       }
       if (!mongoose.Types.ObjectId.isValid(companyId)) {
           console.error('Servicio - ID de compañía inválido para actualizar estado:', companyId);
           throw new Error('ID de compañía inválido');
       }
       // Validar que el estado sea uno de los permitidos por el enum del modelo (si existe)
       // const validStatuses = Invoice.schema.path('status').enumValues;
       // if (!validStatuses.includes(status)) {
       //     throw new Error(`Estado inválido: ${status}`);
       // }


       // Buscar y actualizar estado solo si el _id y companyId coinciden
       const updatedInvoice = await Invoice.findOneAndUpdate(
           { _id: id, companyId: companyId }, // Condición
           { status: status }, // Datos a actualizar
           { new: true, runValidators: true } // Opciones
       ).populate('client').populate({ path: 'items.product', model: 'Product' });

       if (!updatedInvoice) {
           console.log('Servicio - Factura no encontrada para actualizar estado con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
       }

       console.log('Servicio - Estado de factura actualizado exitosamente:', updatedInvoice._id);
       return updatedInvoice;
   } catch (error) {
        if (error.message !== 'Factura no encontrada o no tiene permiso para actualizarla' && error.message !== 'ID de factura inválido') {
           console.error('Servicio - Error al actualizar estado de la factura:', error);
       }
       // Considerar errores de validación del estado
       if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            throw new Error(`Error de validación: ${errors.join(', ')}`);
       }
       throw new Error(`Error al actualizar estado de la factura: ${error.message}`);
   }
};


module.exports = {
   getAllInvoices,
   getInvoiceById,
   createInvoice,
   updateInvoice,
   deleteInvoice,
   getInvoiceByNumber,
   updateInvoiceStatus
};
