// services/stock-monitor.service.js
const Product = require('../models/product.model');
const Notification = require('../models/notification.model');
const notificationService = require('./notification.service');

const stockMonitorService = {
    /**
     * Verificar si un producto tiene stock bajo después de una actualización
     * y crear notificación si es necesario y no existe una activa.
     * @param {object} product - El objeto producto actualizado.
     * @returns {Promise<object|null>} La notificación creada o null.
     */
    checkProductStockAfterUpdate: async (product) => {
        try {
            // --- Validaciones Rigurosas ---
            if (!product) {
                console.log('[Stock Monitor] Producto no proporcionado');
                return null;
            }
            if (product.tipo !== 'producto') {
                // console.log(`[Stock Monitor] El elemento no es de tipo producto: ${product.tipo}`); // Log opcional
                return null;
            }
            if (typeof product.stock !== 'number') {
                console.warn(`[Stock Monitor] Stock no es un número para producto ${product._id}: ${product.stock}`);
                return null;
            }
            if (!product.companyId) {
                console.warn(`[Stock Monitor] Producto ${product._id} (${product.nombre}) no tiene companyId. No se puede verificar notificación.`);
                return null;
            }

            // Convertir IDs a string para consistencia
            const companyId = product.companyId.toString ? product.companyId.toString() : product.companyId;
            const productId = product._id.toString ? product._id.toString() : product._id;

            console.log(`[Stock Monitor] Verificando producto: ${product.nombre}, ID: ${productId}, CompanyId: ${companyId}, Stock: ${product.stock}`);

            // --- Umbrales y Verificación de Stock ---
            const lowStockThreshold = 5; // Umbral general para considerar bajo stock
            const warningStockThreshold = 3; // Umbral para severidad 'warning'

            if (product.stock <= lowStockThreshold && product.stock > 0) {
                console.log(`[Stock Monitor] Producto con stock bajo detectado: ${product.nombre} (${product.stock} unidades)`);

                // --- Buscar Notificación Activa Existente ---
                console.log(`[Stock Monitor] Buscando notificaciones existentes para producto ${productId} en compañía ${companyId}`);
                try {
                    const existingNotifications = await Notification.find({
                        companyId: companyId,
                        type: 'inventario_bajo',
                        referenceId: productId,
                        read: false
                    }).lean(); // Usar lean para eficiencia

                    console.log(`[Stock Monitor] Notificaciones activas existentes encontradas: ${existingNotifications.length}`);

                    // --- Crear Nueva Notificación si no hay activa ---
                    if (existingNotifications.length === 0) {
                        console.log(`[Stock Monitor] Creando nueva notificación para producto ${product.nombre}`);

                        // --- SEVERITY ACTUALIZADO ---
                        const severity = product.stock <= warningStockThreshold ? 'warning' : 'info';

                        const notificationData = {
                            companyId: companyId,
                            type: 'inventario_bajo',
                            title: `Stock bajo: ${product.nombre}`,
                            message: `El producto ${product.nombre} (Código: ${product.codigo || 'N/A'}) tiene solo ${product.stock} unidades disponibles.`,
                            severity: severity, // <-- Lógica de severity actualizada
                            referenceId: productId,
                            referenceType: 'product', // Asegúrate que 'product' sea válido en el enum
                            link: `/products/${productId}` // Revisa la ruta del frontend
                        };

                        // Crear notificación usando el servicio
                        const newNotification = await notificationService.createNotification(notificationData);
                        console.log(`[Stock Monitor] Nueva notificación creada con ID: ${newNotification._id}`);

                        // --- Emitir en Tiempo Real ---
                        if (global.emitCompanyNotification && typeof global.emitCompanyNotification === 'function') {
                            global.emitCompanyNotification(companyId, newNotification);
                            console.log(`[Stock Monitor] Notificación emitida en tiempo real`);
                        } else {
                            console.warn(`[Stock Monitor] ADVERTENCIA: No se pudo emitir en tiempo real (emitCompanyNotification no está disponible)`);
                        }

                        return newNotification; // Devolver la notificación creada
                    } else {
                        console.log(`[Stock Monitor] Ya existe una notificación activa para ${product.nombre}. No se crea una nueva.`);
                    }
                } catch (err) {
                    console.error(`[Stock Monitor] Error buscando o creando notificación para ${productId}:`, err);
                    // Considerar si se debe continuar o no. Por ahora, no se crea notificación si falla la búsqueda.
                }
            } else {
                // console.log(`[Stock Monitor] Producto ${product.nombre} tiene stock suficiente (${product.stock} unidades)`); // Log opcional
                // Podría añadirse lógica para marcar como leídas notificaciones antiguas si el stock ya no es bajo
            }

            return null; // No se creó notificación

        } catch (error) {
            console.error('[Stock Monitor] Error general en checkProductStockAfterUpdate:', error);
            return null; // No propagar el error para no interrumpir flujos principales
        }
    },

    /**
     * Verificar productos con stock bajo (ejecución periódica).
     * @returns {Promise<Array<object>>} Array de notificaciones creadas.
     */
    checkLowStockProducts: async () => {
        const createdNotifications = []; // Almacenar notificaciones creadas
        try {
            console.log('[Stock Monitor] Iniciando verificación programada de productos con stock bajo...');

            // --- Umbrales ---
            const lowStockThreshold = 5; // Buscar productos con stock <= 5
            const warningStockThreshold = 3; // Umbral para severidad 'warning'

            // --- Obtener Productos ---
            const lowStockProducts = await Product.find({
                tipo: 'producto',
                stock: { $lte: lowStockThreshold, $gt: 0 } // Stock entre 1 y 5 inclusive
            })
            // No poblar aquí si solo necesitas el ID de companyId, es más eficiente
            .select('_id nombre codigo stock companyId'); // Seleccionar solo campos necesarios

            console.log(`[Stock Monitor] Se encontraron ${lowStockProducts.length} productos con stock bajo para verificar.`);

            // --- Procesar cada producto ---
            for (const product of lowStockProducts) {
                // Validar datos del producto
                if (!product.companyId) {
                    console.warn(`[Stock Monitor] Producto ${product._id} (${product.nombre}) no tiene companyId definido. Omitiendo.`);
                    continue;
                }
                if (!product._id) {
                     console.warn(`[Stock Monitor] Producto encontrado sin ID. Omitiendo.`);
                     continue;
                }

                const companyId = product.companyId.toString(); // Asegurar que sea string
                const productId = product._id.toString(); // Asegurar que sea string

                console.log(`[Stock Monitor] Verificando producto periódico: ${product.nombre}, ID: ${productId}, Stock: ${product.stock}`);

                try {
                    // --- Verificar Notificación Activa Existente ---
                    const existingNotification = await Notification.findOne({
                        companyId: companyId,
                        type: 'inventario_bajo',
                        referenceId: productId,
                        read: false
                    }).lean(); // Usar lean y findOne es más eficiente aquí

                    // --- Crear Nueva Notificación si no hay activa ---
                    if (!existingNotification) {
                        console.log(`[Stock Monitor] Creando notificación periódica para ${product.nombre} (${product.stock} unidades)`);

                        // --- SEVERITY ACTUALIZADO ---
                        const severity = product.stock <= warningStockThreshold ? 'warning' : 'info';

                        // Crear instancia directa de Notification (como en el snippet)
                        const notification = new Notification({
                            companyId: companyId,
                            type: 'inventario_bajo',
                            title: `Stock bajo: ${product.nombre}`,
                            message: `El producto ${product.nombre} (Código: ${product.codigo || 'Sin código'}) tiene solo ${product.stock} unidades disponibles.`,
                            severity: severity, // <-- Lógica de severity actualizada
                            referenceId: productId,
                            referenceType: 'product', // Asegúrate que 'product' sea válido en el enum
                            link: `/products/${productId}` // Revisa la ruta del frontend
                        });

                        await notification.save(); // Guardar la nueva notificación
                        createdNotifications.push(notification); // Añadir al array de creadas

                        // --- Emitir en Tiempo Real ---
                        if (global.emitCompanyNotification && typeof global.emitCompanyNotification === 'function') {
                            global.emitCompanyNotification(companyId, notification);
                            console.log(`[Stock Monitor] Notificación periódica emitida en tiempo real para compañía ${companyId}`);
                        } else {
                            console.warn(`[Stock Monitor] ADVERTENCIA: No se pudo emitir en tiempo real (emitCompanyNotification no disponible)`);
                        }
                    } else {
                        // console.log(`[Stock Monitor] Ya existe una notificación activa para ${product.nombre} (verificación periódica)`); // Log opcional
                    }
                } catch (notificationError) {
                    console.error(`[Stock Monitor] Error procesando notificación periódica para producto ${productId}:`, notificationError);
                    // Continuar con el siguiente producto
                }
            } // Fin del bucle for

            console.log(`[Stock Monitor] Verificación periódica completada. Se crearon ${createdNotifications.length} nuevas notificaciones.`);
            return createdNotifications; // Devolver las notificaciones creadas

        } catch (error) {
            console.error('[Stock Monitor] Error general en checkLowStockProducts:', error);
            // En la ejecución periódica, es mejor no lanzar el error para no detener el intervalo,
            // pero sí loguearlo. Devolver array vacío o las que se hayan podido crear.
            return createdNotifications;
        }
    }
};

module.exports = stockMonitorService;