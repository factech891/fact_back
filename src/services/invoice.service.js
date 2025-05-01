// services/invoice.service.js
const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model'); // Asegúrate que la ruta sea correcta
const Product = require('../models/product.model'); // Importar modelo de Producto
// Añadir esta importación nueva
const documentNumberingService = require('./document-numbering.service');

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
 * CON VALIDACIÓN Y ACTUALIZACIÓN DE STOCK Y GENERACIÓN AUTOMÁTICA DE NÚMERO.
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

        // --- NUEVO: Generar número de factura si no se proporciona ---
        if (!invoiceData.number) {
            // Obtener el tipo de documento (o 'invoice' por defecto)
            const documentType = invoiceData.documentType || 'invoice';
            // Generar el próximo número de documento (dentro de la transacción)
            invoiceData.number = await documentNumberingService.getNextDocumentNumber(
                companyId,
                documentType,
                session
            );
            console.log(`Servicio - Número de factura generado: ${invoiceData.number}`);
        } else {
            console.log(`Servicio - Usando número de factura proporcionado: ${invoiceData.number}`);
        }

        // --- Continúa con el código existente ---
        // --- 1. Verificar Stock y Preparar Actualizaciones --- (Renumerado de código existente)
        const stockUpdatePromises = await checkAndPrepareStockUpdates(invoiceData.items, companyId, session);

        // --- 2. Crear y Guardar la Factura --- (Renumerado de código existente)
        const newInvoice = new Invoice(invoiceData);
        // Guardar DENTRO de la transacción
        const savedInvoice = await newInvoice.save({ session });

        // --- 3. Ejecutar Actualizaciones de Stock --- (Renumerado de código existente)
        // Solo si la factura se guardó correctamente
        await Promise.all(stockUpdatePromises); // Ejecutar todas las promesas de $inc

        // --- 4. Confirmar Transacción --- (Renumerado de código existente)
        await session.commitTransaction();
        console.log('Servicio - Transacción completada exitosamente para factura:', savedInvoice._id);

        // --- 5. Poblar y Devolver --- (Renumerado de código existente)
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
 * Soporta tanto productos como servicios.
 * @param {string} id - ID de la factura.
 * @param {Object} invoiceData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura actualizada.
 */
const updateInvoice = async (id, invoiceData, companyId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        console.log('Servicio - Datos recibidos para actualizar factura:', id, 'CompanyId:', companyId);
        console.log('Datos de factura:', JSON.stringify(invoiceData, null, 2));

        if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
            throw new Error('ID de factura o compañía inválido');
        }

        // --- 1. Obtener la Factura Original (DENTRO de la sesión) ---
        const originalInvoice = await Invoice.findOne({ _id: id, companyId: companyId }).session(session);
        if (!originalInvoice) {
            console.error(`Servicio - Factura no encontrada con ID: ${id} para compañía: ${companyId}`);
            throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
        }

        console.log('Factura original encontrada:', originalInvoice._id);

        // --- 2. Calcular Cambios en Stock ---
        const stockAdjustments = new Map(); // Map<productId, quantityChange>

        // Verificar que los items originales existan
        if (!originalInvoice.items || !Array.isArray(originalInvoice.items)) {
            console.error('Factura original tiene items inválidos:', originalInvoice.items);
            throw new Error('La estructura de los items de la factura original es inválida');
        }

        // Verificar que los nuevos items existan
        if (!invoiceData.items || !Array.isArray(invoiceData.items)) {
            console.error('Nuevos datos de factura tienen items inválidos:', invoiceData.items);
            throw new Error('La estructura de los nuevos items es inválida');
        }

        // Mapear items originales para fácil acceso
        const originalItemsMap = new Map();
        for (const oldItem of originalInvoice.items) {
            if (!oldItem.product) {
                console.warn('Item original sin producto, ignorando:', oldItem);
                continue;
            }
            const productId = typeof oldItem.product === 'object'
                ? oldItem.product._id.toString()
                : oldItem.product.toString();
            originalItemsMap.set(productId, oldItem.quantity);
        }

        console.log('Mapa de items originales creado con', originalItemsMap.size, 'productos');

        // Mapear items nuevos
        const newItemsMap = new Map();
        for (const newItem of invoiceData.items) {
            if (!newItem.product) {
                console.warn('Nuevo item sin producto, ignorando:', newItem);
                continue;
            }
            const productId = typeof newItem.product === 'object'
                ? newItem.product._id.toString()
                : newItem.product.toString();
            newItemsMap.set(productId, newItem.quantity);
        }

        console.log('Mapa de nuevos items creado con', newItemsMap.size, 'productos');

        // Productos que estaban y ya no están (o cantidad 0) -> Aumentar stock
        for (const [productId, quantity] of originalItemsMap.entries()) {
            if (!newItemsMap.has(productId) || newItemsMap.get(productId) === 0) {
                console.log(`Producto ${productId} eliminado/cero, devolviendo ${quantity} unidades al stock`);
                stockAdjustments.set(productId, (stockAdjustments.get(productId) || 0) + quantity);
            }
        }

        // Productos nuevos o con cantidad modificada -> Ajustar stock
        for (const [productId, newQuantity] of newItemsMap.entries()) {
            const originalQuantity = originalItemsMap.get(productId) || 0;
            const quantityChange = newQuantity - originalQuantity; // Negativo si se reduce, positivo si aumenta

            if (quantityChange !== 0) {
                console.log(`Producto ${productId}: cambio de cantidad ${originalQuantity} -> ${newQuantity}, ajuste ${-quantityChange}`);
                // Restar el cambio (si aumenta cantidad, se resta del stock; si disminuye, se suma)
                stockAdjustments.set(productId, (stockAdjustments.get(productId) || 0) - quantityChange);
            }
        }

        console.log('Ajustes de stock calculados:', Object.fromEntries(stockAdjustments));

        // --- 3. Verificar todos los items (productos Y servicios) ---
        const productIdsToAdjust = Array.from(stockAdjustments.keys());
        let productsAndServicesToCheck = [];
        let productsToUpdate = [];

        if (productIdsToAdjust.length > 0) {
            console.log('Buscando items para verificar:', productIdsToAdjust);

            // Verificar que sean IDs válidos
            const validProductIds = productIdsToAdjust.filter(id => isValidObjectId(id));
            if (validProductIds.length !== productIdsToAdjust.length) {
                console.error('Algunos IDs de productos no son válidos:',
                    productIdsToAdjust.filter(id => !isValidObjectId(id)));
                throw new Error('IDs de productos inválidos detectados');
            }

            // CAMBIO IMPORTANTE: Primero buscar TODOS los items (productos Y servicios)
            productsAndServicesToCheck = await Product.find({
                _id: { $in: validProductIds },
                companyId: companyId
                // Ya no filtramos por tipo: 'producto'
            }).session(session);

            console.log(`Encontrados ${productsAndServicesToCheck.length} items para verificar de ${validProductIds.length} solicitados`);

            // Verificar que todos los items necesarios existen
            if (productsAndServicesToCheck.length !== validProductIds.length) {
                const foundIds = productsAndServicesToCheck.map(p => p._id.toString());
                const missingIds = validProductIds.filter(id => !foundIds.includes(id));
                console.error('Algunos items no fueron encontrados:', missingIds);
                throw new Error(`Items no encontrados o sin acceso: ${missingIds.join(', ')}`);
            }

            // Ahora filtrar solo los productos físicos para ajuste de inventario
            productsToUpdate = productsAndServicesToCheck.filter(item => item.tipo === 'producto');
            console.log(`De los ${productsAndServicesToCheck.length} items, ${productsToUpdate.length} son productos físicos que requieren ajuste de inventario`);

            // Verificar el stock disponible solo para productos físicos
            for (const product of productsToUpdate) {
                const productIdStr = product._id.toString();
                const stockChange = stockAdjustments.get(productIdStr);

                // Solo validamos si necesitamos DECREMENTAR el stock (stockChange es negativo)
                if (stockChange < 0) {
                    const quantityToDecrement = -stockChange; // Cantidad positiva a restar
                    console.log(`Verificando stock para ${product.nombre}: necesita ${quantityToDecrement}, disponible ${product.stock}`);
                    if (quantityToDecrement > product.stock) {
                        throw new Error(`STOCK_INSUFFICIENTE: Stock insuficiente para "${product.nombre}". Se necesita reducir ${quantityToDecrement}, Disponible: ${product.stock}.`);
                    }
                }
            }
        }

        // --- 4. Actualizar la Factura (DENTRO de la sesión) ---
        console.log('Actualizando factura con datos:', Object.keys(invoiceData));
        delete invoiceData.companyId; // No permitir cambiar companyId
        const updatedInvoice = await Invoice.findOneAndUpdate(
            { _id: id, companyId: companyId },
            invoiceData,
            { new: true, runValidators: true, session: session }
        );

        if (!updatedInvoice) {
            console.error('No se pudo actualizar la factura aunque se encontró previamente');
            throw new Error('Factura no encontrada durante la actualización.');
        }

        // --- 5. Aplicar Ajustes de Stock SOLO a productos físicos (DENTRO de la sesión) ---
        const stockUpdatePromises = [];
        for (const product of productsToUpdate) { // Solo productos físicos (tipo: 'producto')
            const productIdStr = product._id.toString();
            const stockChange = stockAdjustments.get(productIdStr);
            if (stockChange !== 0) { // Solo actualizar si hay cambio
                console.log(`Ajustando stock de ${product.nombre} (ID: ${productIdStr}) en ${stockChange} unidades`);
                stockUpdatePromises.push(
                    Product.findByIdAndUpdate(
                        product._id,
                        { $inc: { stock: stockChange } }, // $inc maneja suma y resta
                        { new: true, session: session }
                    )
                );
            }
        }

        if (stockUpdatePromises.length > 0) {
            console.log(`Ejecutando ${stockUpdatePromises.length} actualizaciones de stock`);
            await Promise.all(stockUpdatePromises);
        } else {
            console.log(`No hay actualizaciones de stock para aplicar (posiblemente solo servicios)`);
        }

        // --- 6. Confirmar Transacción ---
        await session.commitTransaction();
        console.log('Servicio - Transacción de actualización completada para factura:', updatedInvoice._id);

        // --- 7. Poblar y Devolver ---
        try {
            const populatedInvoice = await getInvoiceById(updatedInvoice._id, companyId);
            console.log('Servicio - Factura actualizada y stock ajustado exitosamente');
            return populatedInvoice;
        } catch (populateError) {
            console.error('Error al poblar la factura actualizada:', populateError);
            // Devolver la factura no poblada si hay error al poblar
            return updatedInvoice;
        }

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
            try {
                const field = Object.keys(error.keyPattern)[0];
                throw new Error(`Error al actualizar la factura: Ya existe otra factura con este ${field === 'number' ? 'número' : field} en esta compañía.`);
            } catch (keyPatternError) {
                throw new Error(`Error al actualizar la factura: ${error.message}`);
            }
        }
        throw new Error(`Error al actualizar la factura: ${error.message}`);
    } finally {
        session.endSession();
    }
};

/**
 * Eliminar una factura, asegurando que pertenezca a la compañía correcta.
 * AHORA CON RESTAURACIÓN DE STOCK.
 * @param {string} id - ID de la factura.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura eliminada.
 */
const deleteInvoice = async (id, companyId) => {
   // Usar transacción para garantizar integridad entre la eliminación y la restauración de stock
   const session = await mongoose.startSession();
   session.startTransaction();

   try {
       console.log('Servicio - Intentando eliminar factura con ID:', id, 'para CompanyId:', companyId);
       if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
           throw new Error('ID de factura o compañía inválido');
       }

       // Primero obtener la factura completa para conocer los productos y cantidades
       const invoiceToDelete = await Invoice.findOne({
           _id: id,
           companyId: companyId
       }).session(session);

       if (!invoiceToDelete) {
           console.log('Servicio - Factura no encontrada para eliminar con ID:', id, 'para CompanyId:', companyId);
           throw new Error('Factura no encontrada o no tiene permiso para eliminarla');
       }

       // Restaurar stock solo para productos (no servicios)
       const stockUpdatePromises = [];

       // Solo procesar si hay items
       if (invoiceToDelete.items && invoiceToDelete.items.length > 0) {
           // Obtener todos los IDs de productos para consultar su tipo
           const productIds = invoiceToDelete.items.map(item => item.product);

           // Buscar todos los productos relevantes
           const products = await Product.find({
               _id: { $in: productIds },
               companyId: companyId,
               tipo: 'producto' // Solo restaurar stock para tipo 'producto'
           }).session(session);

           // Crear un mapa para acceso rápido
           const productMap = new Map(products.map(p => [p._id.toString(), p]));

           // Procesar cada ítem de la factura
           for (const item of invoiceToDelete.items) {
               const productId = item.product.toString();
               const product = productMap.get(productId);

               // Solo restaurar stock si es un producto físico
               if (product) {
                   const quantityToRestore = item.quantity;

                   console.log(`Servicio - Restaurando ${quantityToRestore} unidades al stock del producto ${product.nombre} (ID: ${productId})`);

                   // Actualizar el stock sumando la cantidad
                   stockUpdatePromises.push(
                       Product.findByIdAndUpdate(
                           productId,
                           { $inc: { stock: quantityToRestore } },
                           { new: true, session: session }
                       )
                   );
               }
           }

           // Ejecutar todas las actualizaciones de stock
           await Promise.all(stockUpdatePromises);
       }

       // Finalmente eliminar la factura
       const deletedInvoice = await Invoice.findOneAndDelete({
           _id: id,
           companyId: companyId
       }).session(session);

       // Confirmar la transacción
       await session.commitTransaction();

       console.log('Servicio - Factura eliminada exitosamente y stock restaurado:', id);
       return deletedInvoice;

   } catch (error) {
       // Revertir la transacción en caso de error
       await session.abortTransaction();

       console.error('Servicio - Error al eliminar la factura (transacción abortada):', error);
       throw new Error(`Error al eliminar la factura: ${error.message}`);

   } finally {
       // Siempre finalizar la sesión
       session.endSession();
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
 * AHORA CON RESTAURACIÓN DE STOCK cuando se cancela.
 * @param {string} id - ID de la factura.
 * @param {string} status - Nuevo estado de la factura.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Factura actualizada.
 */
const updateInvoiceStatus = async (id, status, companyId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log('Servicio - Actualizando estado de factura:', id, 'a', status, 'para CompanyId:', companyId);
        if (!isValidObjectId(id) || !isValidObjectId(companyId)) {
            throw new Error('ID de factura o compañía inválido');
        }

        // Obtener la factura actual para verificar su estado actual
        const currentInvoice = await Invoice.findOne({
            _id: id,
            companyId: companyId
        }).session(session);

        if (!currentInvoice) {
            console.log('Servicio - Factura no encontrada para actualizar estado con ID:', id);
            throw new Error('Factura no encontrada o no tiene permiso para actualizarla');
        }

        // Determinar si necesitamos restaurar inventario
        // Asumimos que restauramos stock sólo si pasamos a 'cancelled'
        // y el estado actual NO es 'cancelled' o 'draft'
        const needToRestoreStock = (
            status === 'cancelled' &&
            currentInvoice.status !== 'cancelled' &&
            currentInvoice.status !== 'draft'
        );

        // Procesar restauración de stock si es necesario
        if (needToRestoreStock && currentInvoice.items && currentInvoice.items.length > 0) {
            console.log('Servicio - Restaurando stock por cancelación de factura:', id);

            // Obtener todos los IDs de productos para consultar su tipo
            const productIds = currentInvoice.items.map(item =>
                typeof item.product === 'object' ? item.product._id : item.product
            );

            // Buscar todos los productos relevantes
            const products = await Product.find({
                _id: { $in: productIds },
                companyId: companyId,
                tipo: 'producto' // Solo restaurar stock para tipo 'producto'
            }).session(session);

            // Crear un mapa para acceso rápido
            const productMap = new Map(products.map(p => [p._id.toString(), p]));

            // Procesar cada ítem de la factura
            const stockUpdatePromises = [];
            for (const item of currentInvoice.items) {
                const productId = (typeof item.product === 'object' ?
                    item.product._id : item.product).toString();
                const product = productMap.get(productId);

                // Solo restaurar stock si es un producto físico
                if (product) {
                    const quantityToRestore = item.quantity;

                    console.log(`Servicio - Restaurando ${quantityToRestore} unidades al stock del producto ${product.nombre} (ID: ${productId}) por cancelación`);

                    // Actualizar el stock sumando la cantidad
                    stockUpdatePromises.push(
                        Product.findByIdAndUpdate(
                            productId,
                            { $inc: { stock: quantityToRestore } },
                            { new: true, session: session }
                        )
                    );
                }
            }

            // Ejecutar todas las actualizaciones de stock
            await Promise.all(stockUpdatePromises);
        }

        // Actualizar el estado de la factura
        const updatedInvoice = await Invoice.findOneAndUpdate(
            { _id: id, companyId: companyId },
            { status: status },
            { new: true, runValidators: true, session: session }
        );

        // Confirmar la transacción
        await session.commitTransaction();

        // Poblar los datos para la respuesta (fuera de la transacción)
        const populatedInvoice = await Invoice.findById(updatedInvoice._id)
            .populate('client')
            .populate({ path: 'items.product', model: 'Product' });

        console.log('Servicio - Estado de factura actualizado exitosamente:', updatedInvoice._id);
        return populatedInvoice;

    } catch (error) {
        // Revertir la transacción en caso de error
        await session.abortTransaction();

        console.error('Servicio - Error al actualizar estado de la factura (transacción abortada):', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            throw new Error(`Error de validación: ${errors.join(', ')}`);
        }
        throw new Error(`Error al actualizar estado de la factura: ${error.message}`);

    } finally {
        // Siempre finalizar la sesión
        session.endSession();
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