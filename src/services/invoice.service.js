// services/invoice.service.js
const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model'); // Asegúrate que la ruta sea correcta
const Product = require('../models/product.model'); // Importar modelo de Producto

// --- Helper para validar ObjectId (sin cambios) ---
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper para verificar stock y preparar actualizaciones ---
/**
 * Verifica el stock disponible para los items de tipo 'producto' y prepara las operaciones de actualización.
 * @param {Array} items - Array de items de la factura.
 * @param {string} companyId - ID de la compañía.
 * @param {mongoose.ClientSession} [session] - Sesión de Mongoose para transacción (opcional pero recomendado).
 * @returns {Promise<Array>} - Array de promesas para actualizar el stock.
 * @throws {Error} - Si no hay stock suficiente para algún producto.
 */
const checkAndPrepareStockUpdates = async (items, companyId, session) => {
    const productItems = items.filter(item => item && item.product); // Filtrar items con producto
    if (productItems.length === 0) {
        return []; // No hay productos que verificar/actualizar
    }

    const productIds = productItems.map(item => item.product);

    // Buscar todos los productos relevantes de una vez
    const products = await Product.find({
        _id: { $in: productIds },
        companyId: companyId
    }).session(session); // Ejecutar dentro de la sesión si existe

    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const stockUpdateOperations = [];

    for (const item of productItems) {
        const product = productMap.get(item.product.toString());

        // Verificar si el producto existe y pertenece a la compañía
        if (!product) {
            throw new Error(`Producto inválido (ID: ${item.product}) o no pertenece a esta compañía.`);
        }

        // Verificar stock solo si es de tipo 'producto'
        if (product.tipo === 'producto') {
            const requestedQuantity = Number(item.quantity);
            const availableStock = Number(product.stock);

            if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
                 throw new Error(`Cantidad inválida para el producto "${product.nombre}".`);
            }
            if (isNaN(availableStock)) {
                 console.warn(`Stock inválido para el producto "${product.nombre}" (ID: ${product._id}). Asumiendo 0.`);
                 // Podrías lanzar un error o tratarlo como 0
                 if (requestedQuantity > 0) {
                      throw new Error(`Stock no disponible (inválido) para el producto "${product.nombre}".`);
                 }
            }

            if (requestedQuantity > availableStock) {
                throw new Error(`STOCK_INSUFFICIENTE: Stock insuficiente para "${product.nombre}" (Código: ${product.codigo || 'N/A'}). Solicitado: ${requestedQuantity}, Disponible: ${availableStock}.`);
            }

            // Si hay stock, preparar la operación de actualización (resta)
            // Usamos $inc para operación atómica
            stockUpdateOperations.push(
                Product.findByIdAndUpdate(
                    product._id,
                    { $inc: { stock: -requestedQuantity } },
                    { new: true, session: session } // Ejecutar dentro de la sesión
                )
            );
        }
    }

    return stockUpdateOperations; // Devolver las promesas de actualización
};


/**
 * Obtener todas las facturas de una compañía específica.
 * (Sin cambios respecto a tu versión)
 */
const getAllInvoices = async (companyId) => {
   try {
       console.log('Servicio - Obteniendo todas las facturas para CompanyId:', companyId);
       if (!isValidObjectId(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }
       return await Invoice.find({ companyId: companyId })
           .populate('client')
           .populate({
                path: 'items.product',
                model: 'Product'
           })
           .sort({ date: -1 });
   } catch (error) {
       console.error('Servicio - Error al obtener las facturas:', error);
       throw new Error(`Error al obtener las facturas: ${error.message}`);
   }
};

/**
 * Obtener una factura por ID, asegurando que pertenezca a la compañía correcta.
 * (Sin cambios respecto a tu versión)
 */
const getInvoiceById = async (id, companyId) => {
   try {
       console.log('Servicio - Obteniendo factura por ID:', id, 'para CompanyId:', companyId);
       if (!isValidObjectId(id)) {
           console.warn('Servicio - ID de factura inválido:', id);
           throw new Error('ID de factura inválido');
       }
       if (!isValidObjectId(companyId)) {
           console.error('Servicio - ID de compañía inválido:', companyId);
           throw new Error('ID de compañía inválido');
       }

       const invoice = await Invoice.findOne({ _id: id, companyId: companyId })
           .populate('client')
           .populate({
                path: 'items.product',
                model: 'Product'
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
       throw error;
   }
};

/**
 * Crear una nueva factura asociada a una compañía específica.
 * CON VALIDACIÓN Y ACTUALIZACIÓN DE STOCK.
 * @param {Object} invoiceData - Datos de la factura.
 * @param {string} companyId - ID de la compañía del usuario autenticado.
 * @returns {Promise<Object>} Factura creada.
 */
const createInvoice = async (invoiceData, companyId) => {
    // --- INICIO: Transacción ---
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        console.log('Servicio - Datos recibidos para crear factura:', invoiceData, 'CompanyId:', companyId);
        if (!isValidObjectId(companyId)) {
            console.error('Servicio - ID de compañía inválido para crear factura:', companyId);
            throw new Error('ID de compañía inválido');
        }

        // Asignar el companyId a la factura
        invoiceData.companyId = companyId;

        // --- 1. Verificar Stock y Preparar Actualizaciones ---
        // Llama al helper DENTRO de la transacción
        const stockUpdatePromises = await checkAndPrepareStockUpdates(invoiceData.items, companyId, session);

        // --- 2. Crear y Guardar la Factura ---
        const newInvoice = new Invoice(invoiceData);
        // Guardar DENTRO de la transacción
        const savedInvoice = await newInvoice.save({ session });

        // --- 3. Ejecutar Actualizaciones de Stock ---
        // Solo si la factura se guardó correctamente
        await Promise.all(stockUpdatePromises); // Ejecutar todas las promesas de $inc

        // --- 4. Confirmar Transacción ---
        await session.commitTransaction();
        console.log('Servicio - Transacción completada exitosamente para factura:', savedInvoice._id);

        // --- 5. Poblar y Devolver ---
        // Poblar FUERA de la transacción (es solo lectura)
        const populatedInvoice = await getInvoiceById(savedInvoice._id, companyId);
        console.log('Servicio - Factura creada y stock actualizado:', savedInvoice._id);
        return populatedInvoice;

    } catch (error) {
        // --- Si algo falla, Abortar Transacción ---
        await session.abortTransaction();
        console.error('Servicio - Error al crear la factura (transacción abortada):', error);
        // Manejar errores específicos
        if (error.message.startsWith('STOCK_INSUFFICIENTE')) {
            throw new Error(error.message); // Re-lanzar error de stock
        }
        if (error.code === 11000 || error.message.includes('duplicate key')) {
             const field = Object.keys(error.keyPattern)[0];
             throw new Error(`Error al crear la factura: Ya existe una factura con este ${field === 'number' ? 'número' : field} en esta compañía.`);
        }
        // Re-lanzar otros errores
        throw new Error(`Error al crear la factura: ${error.message}`);
    } finally {
        // --- Siempre finalizar la sesión ---
        session.endSession();
    }
};

/**
 * Actualizar una factura, asegurando que pertenezca a la compañía correcta.
 * CON VALIDACIÓN Y ACTUALIZACIÓN DE STOCK (Lógica Compleja).
 * @param {string} id - ID de la factura.
 * @param {Object} invoiceData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura actualizada.
 */
const updateInvoice = async (id, invoiceData, companyId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        console.log('Servicio - Datos recibidos para actualizar factura:', id, 'Data:', invoiceData, 'CompanyId:', companyId);

        if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
            throw new Error('ID de factura o compañía inválido');
        }

        // --- 1. Obtener la Factura Original (DENTRO de la sesión) ---
        const originalInvoice = await Invoice.findOne({ _id: id, companyId: companyId }).session(session);
        if (!originalInvoice) {
            throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
        }

        // --- 2. Calcular Cambios en Stock ---
        const stockAdjustments = new Map(); // Map<productId, quantityChange>

        // Mapear items originales para fácil acceso
        const originalItemsMap = new Map(originalInvoice.items.map(item => [item.product.toString(), item.quantity]));
        // Mapear items nuevos
        const newItemsMap = new Map(invoiceData.items.map(item => [item.product.toString(), item.quantity]));

        // Productos que estaban y ya no están (o cantidad 0) -> Aumentar stock
        originalInvoice.items.forEach(oldItem => {
            const productId = oldItem.product.toString();
            if (!newItemsMap.has(productId) || newItemsMap.get(productId) === 0) {
                stockAdjustments.set(productId, (stockAdjustments.get(productId) || 0) + oldItem.quantity); // Sumar cantidad original
            }
        });

        // Productos nuevos o con cantidad modificada -> Ajustar stock
        invoiceData.items.forEach(newItem => {
            const productId = newItem.product.toString();
            const originalQuantity = originalItemsMap.get(productId) || 0;
            const newQuantity = newItem.quantity;
            const quantityChange = newQuantity - originalQuantity; // Negativo si se reduce, positivo si aumenta

            if (quantityChange !== 0) {
                 // Restar el cambio (si aumenta cantidad, se resta del stock; si disminuye, se suma)
                stockAdjustments.set(productId, (stockAdjustments.get(productId) || 0) - quantityChange);
            }
        });

        // --- 3. Verificar Stock Disponible para los Ajustes Negativos ---
        const productIdsToAdjust = Array.from(stockAdjustments.keys());
        if (productIdsToAdjust.length > 0) {
            const productsToUpdate = await Product.find({
                _id: { $in: productIdsToAdjust },
                companyId: companyId,
                tipo: 'producto' // Solo verificar/ajustar productos
            }).session(session);

            for (const product of productsToUpdate) {
                const productIdStr = product._id.toString();
                const stockChange = stockAdjustments.get(productIdStr); // Nota: stockChange es negativo si se necesita DECREMENTAR stock

                // Solo validamos si necesitamos DECREMENTAR el stock (stockChange es negativo)
                if (stockChange < 0) {
                    const quantityToDecrement = -stockChange; // Cantidad positiva a restar
                    if (quantityToDecrement > product.stock) {
                         throw new Error(`STOCK_INSUFFICIENTE: Stock insuficiente para "${product.nombre}". Se necesita reducir ${quantityToDecrement}, Disponible: ${product.stock}.`);
                    }
                }
            }
        }

        // --- 4. Actualizar la Factura (DENTRO de la sesión) ---
        delete invoiceData.companyId; // No permitir cambiar companyId
        const updatedInvoice = await Invoice.findOneAndUpdate(
            { _id: id, companyId: companyId },
            invoiceData,
            { new: true, runValidators: true, session: session } // Ejecutar con sesión
        );

        if (!updatedInvoice) {
             // Esto no debería pasar si la búsqueda original funcionó, pero por seguridad
            throw new Error('Factura no encontrada durante la actualización.');
        }

        // --- 5. Aplicar Ajustes de Stock (DENTRO de la sesión) ---
        const stockUpdatePromises = [];
        for (const product of productsToUpdate) { // Usar productsToUpdate que ya filtramos por tipo: 'producto'
             const productIdStr = product._id.toString();
             const stockChange = stockAdjustments.get(productIdStr); // Negativo si decrementa, positivo si incrementa
             if (stockChange !== 0) { // Solo actualizar si hay cambio
                 stockUpdatePromises.push(
                     Product.findByIdAndUpdate(
                         product._id,
                         { $inc: { stock: stockChange } }, // $inc maneja suma y resta
                         { new: true, session: session }
                     )
                 );
             }
        }
        await Promise.all(stockUpdatePromises);

        // --- 6. Confirmar Transacción ---
        await session.commitTransaction();
        console.log('Servicio - Transacción de actualización completada para factura:', updatedInvoice._id);

        // --- 7. Poblar y Devolver ---
        const populatedInvoice = await getInvoiceById(updatedInvoice._id, companyId); // Poblar fuera de sesión
        console.log('Servicio - Factura actualizada y stock ajustado:', updatedInvoice._id);
        return populatedInvoice;

    } catch (error) {
        await session.abortTransaction();
        console.error('Servicio - Error al actualizar la factura (transacción abortada):', error);
        if (error.message.startsWith('STOCK_INSUFFICIENTE')) {
            throw error; // Re-lanzar error de stock
        }
        if (error.message === 'Factura no encontrada o no tiene permiso para actualizarla') {
            throw error;
        }
        if (error.code === 11000 || error.message.includes('duplicate key')) {
             const field = Object.keys(error.keyPattern)[0];
             throw new Error(`Error al actualizar la factura: Ya existe otra factura con este ${field === 'number' ? 'número' : field} en esta compañía.`);
        }
        throw new Error(`Error al actualizar la factura: ${error.message}`);
    } finally {
        session.endSession();
    }
};


/**
 * Eliminar una factura, asegurando que pertenezca a la compañía correcta.
 * (Sin cambios respecto a tu versión - Considerar si se debe REAJUSTAR stock al eliminar)
 */
const deleteInvoice = async (id, companyId) => {
   // IMPORTANTE: Al eliminar una factura, ¿debería devolverse el stock de los productos?
   // Si es así, se necesitaría una lógica similar a la de 'updateInvoice'
   // para calcular qué cantidades devolver y actualizar el stock (idealmente en transacción).
   // Por ahora, se mantiene la lógica original que solo elimina la factura.
   try {
       console.log('Servicio - Intentando eliminar factura con ID:', id, 'para CompanyId:', companyId);
       if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
           throw new Error('ID de factura o compañía inválido');
       }

       const deletedInvoice = await Invoice.findOneAndDelete({ _id: id, companyId: companyId });

       if (!deletedInvoice) {
           console.log('Servicio - Factura no encontrada para eliminar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para eliminarla');
       }

       console.log('Servicio - Factura eliminada exitosamente:', id);
       // Aquí iría la lógica para restaurar el stock si se decide implementarla
       return deletedInvoice;
   } catch (error) {
       console.error('Servicio - Error al eliminar la factura:', error);
       throw new Error(`Error al eliminar la factura: ${error.message}`);
   }
};

/**
 * Obtener una factura por número, asegurando que pertenezca a la compañía correcta.
 * (Sin cambios respecto a tu versión)
 */
const getInvoiceByNumber = async (number, companyId) => {
    try {
        console.log('Servicio - Obteniendo factura por Número:', number, 'para CompanyId:', companyId);
        if (!number || String(number).trim() === '') {
            throw new Error('El número de factura no puede estar vacío.');
        }
        if (!isValidObjectId(companyId)) {
          console.error('Servicio - ID de compañía inválido:', companyId);
          throw new Error('ID de compañía inválido');
        }

        const invoice = await Invoice.findOne({ number: number, companyId: companyId })
            .populate('client')
            .populate({ path: 'items.product', model: 'Product' });

        if (!invoice) {
          console.log('Servicio - Factura no encontrada con Número:', number, 'para CompanyId:', companyId);
          return null;
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
 * (Sin cambios respecto a tu versión - Considerar si cambiar estado afecta stock, ej. 'cancelled')
 */
const updateInvoiceStatus = async (id, status, companyId) => {
    // IMPORTANTE: Si cambiar el estado a 'cancelled' (o similar)
    // debe restaurar el stock, se necesita lógica aquí similar a delete/update.
    // Por ahora, solo actualiza el estado.
   try {
       console.log('Servicio - Actualizando estado de factura:', id, 'a', status, 'para CompanyId:', companyId);
       if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
           throw new Error('ID de factura o compañía inválido');
       }

       const updatedInvoice = await Invoice.findOneAndUpdate(
           { _id: id, companyId: companyId },
           { status: status },
           { new: true, runValidators: true }
       ).populate('client').populate({ path: 'items.product', model: 'Product' });

       if (!updatedInvoice) {
           console.log('Servicio - Factura no encontrada para actualizar estado con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
       }

       console.log('Servicio - Estado de factura actualizado exitosamente:', updatedInvoice._id);
       return updatedInvoice;
   } catch (error) {
        console.error('Servicio - Error al actualizar estado de la factura:', error);
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