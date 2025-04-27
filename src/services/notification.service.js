// services/notification.service.js
const Notification = require('../models/notification.model');
const Product = require('../models/product.model'); // Asegúrate que la ruta es correcta

const notificationService = {
    /**
     * Crear una nueva notificación
     * @param {object} notificationData - Datos de la notificación.
     * @returns {Promise<object>} La notificación creada.
     */
    createNotification: async (notificationData) => {
        try {
            const notification = new Notification(notificationData);
            return await notification.save();
        } catch (error) {
            // Loguear el error de validación de forma más detallada si ocurre aquí
            if (error.name === 'ValidationError') {
                console.error('Error de validación al crear notificación:', JSON.stringify(error.errors, null, 2));
            } else {
                console.error('Error inesperado al crear notificación:', error);
            }
            throw error; // Re-lanzar el error para manejo superior
        }
    },

    /**
     * Obtener notificaciones por compañía con paginación y filtro
     * @param {string} companyId - ID de la compañía.
     * @param {number} [page=1] - Número de página.
     * @param {number} [limit=20] - Límite de resultados por página.
     * @param {object} [filter={}] - Filtros adicionales para la consulta.
     * @returns {Promise<object>} Objeto con notificaciones y datos de paginación.
     */
    getNotificationsByCompany: async (companyId, page = 1, limit = 20, filter = {}) => {
        const skip = (page - 1) * limit;
        const query = { companyId, ...filter };

        try {
            const [notifications, total] = await Promise.all([
                Notification.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Notification.countDocuments(query)
            ]);

            return {
                notifications,
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            throw error;
        }
    },

    /**
     * Marcar notificación como leída
     * @param {string} notificationId - ID de la notificación.
     * @param {string} userId - ID del usuario que la marcó como leída.
     * @returns {Promise<object|null>} La notificación actualizada o null si no se encuentra.
     */
    markAsRead: async (notificationId, userId) => {
        try {
            return await Notification.findByIdAndUpdate(
                notificationId,
                { read: true, readAt: new Date(), readBy: userId }, // Guardar quién y cuándo leyó
                { new: true } // Devolver el documento actualizado
            ).lean();
        } catch (error) {
            console.error('Error al marcar notificación como leída:', error);
            throw error;
        }
    },

    /**
     * Marcar todas las notificaciones no leídas de una compañía como leídas
     * @param {string} companyId - ID de la compañía.
     * @returns {Promise<object>} Objeto indicando cuántas notificaciones fueron modificadas.
     */
    markAllAsRead: async (companyId) => {
        try {
            const result = await Notification.updateMany(
                { companyId, read: false },
                { $set: { read: true, readAt: new Date() } } // Usar $set es buena práctica
            );
            // Devolver el resultado de la operación de MongoDB
            return { modifiedCount: result.modifiedCount };
        } catch (error) {
            console.error('Error al marcar todas las notificaciones como leídas:', error);
            throw error;
        }
    },

    /**
     * Eliminar una notificación específica
     * @param {string} notificationId - ID de la notificación a eliminar.
     * @returns {Promise<object|null>} El documento eliminado o null si no se encontró.
     */
    deleteNotification: async (notificationId) => {
        try {
            return await Notification.findByIdAndDelete(notificationId).lean();
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            throw error;
        }
    },

    /**
     * Buscar una notificación activa (no leída) por tipo y referencia
     * @param {string} companyId - ID de la compañía.
     * @param {string} type - Tipo de notificación (e.g., 'inventario_bajo').
     * @param {string} referenceId - ID del objeto referenciado (e.g., ID del producto).
     * @returns {Promise<object|null>} La notificación activa encontrada o null.
     */
    findActiveNotification: async (companyId, type, referenceId) => {
        try {
            return await Notification.findOne({
                companyId,
                type,
                referenceId,
                read: false // Clave para que sea "activa"
            }).lean();
        } catch (error) {
            console.error('Error al buscar notificación activa:', error);
            throw error;
        }
    },

    /**
     * Verificar productos con stock bajo y crear notificaciones si es necesario.
     * Se ejecuta periódicamente.
     * @returns {Promise<Array<object>>} Un array de las nuevas notificaciones creadas.
     */
    checkLowStockProducts: async () => {
        const createdNotifications = []; // Mover aquí para devolver siempre un array
        try {
            const lowStockThreshold = 10;
            const criticalStockThreshold = 5;

            const lowStockProducts = await Product.find({
                tipo: 'producto',
                stock: { $lte: lowStockThreshold, $gt: 0 }
            }).populate('companyId', '_id'); // Solo poblar _id de company

            // Usar Promise.allSettled para manejar errores individuales sin detener todo el proceso
            const results = await Promise.allSettled(lowStockProducts.map(async (product) => {
                // Verificar si la compañía existe
                if (!product.companyId || !product.companyId._id) {
                    console.warn(`Producto ${product._id} (${product.nombre}) no tiene companyId válido. Omitiendo notificación.`);
                    return null; // Omitir este producto
                }
                const companyId = product.companyId._id;

                // Verificar si ya existe una notificación activa
                const existingNotification = await notificationService.findActiveNotification(
                    companyId,
                    'inventario_bajo',
                    product._id
                );

                if (!existingNotification) {
                    const severity = product.stock <= criticalStockThreshold ? 'warning' : 'info';
                    const notificationData = {
                        companyId: companyId,
                        type: 'inventario_bajo',
                        title: `Stock bajo: ${product.nombre}`,
                        message: `El producto ${product.nombre} (Código: ${product.codigo || 'N/A'}) tiene solo ${product.stock} unidades disponibles.`,
                        severity: severity,
                        referenceId: product._id,
                        // --- CORRECCIÓN AQUÍ ---
                        // Asegúrate que 'product' (minúscula) sea un valor válido en el enum
                        // de referenceType en tu NotificationSchema (models/notification.model.js)
                        referenceType: 'product',
                        link: `/inventory/products/${product._id}` // Ajusta el link si es necesario
                    };

                    // Intentar crear la notificación
                    const newNotification = await notificationService.createNotification(notificationData);
                    return newNotification; // Devolver la notificación creada
                }
                return null; // No se creó notificación nueva
            }));

            // Recolectar notificaciones creadas exitosamente
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    createdNotifications.push(result.value);
                } else if (result.status === 'rejected') {
                    // Loguear errores individuales que ocurrieron dentro del map
                    console.error('Error procesando un producto para stock bajo:', result.reason);
                }
            });

            console.log(`Verificación de stock bajo: ${createdNotifications.length} nuevas notificaciones creadas.`);
            return createdNotifications;

        } catch (error) {
            // Error general al buscar productos o un error inesperado
            console.error('Error general en checkLowStockProducts:', error);
            // No lanzar error aquí para no detener el job, pero sí loggearlo.
            // Devolver array vacío en caso de error general.
            return createdNotifications; // Devolver las que se hayan podido crear hasta el error
        }
    }
};

module.exports = notificationService;