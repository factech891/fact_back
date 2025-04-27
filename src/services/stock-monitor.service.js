// services/stock-monitor.service.js
const Product = require('../models/product.model');
const notificationService = require('./notification.service');

const stockMonitorService = {
    /**
     * Verificar si un producto tiene stock bajo después de una actualización
     */
    checkProductStockAfterUpdate: async (product) => {
        try {
            // Si no es un producto, o es un servicio, o no tiene stock definido, no continuar
            if (!product || product.tipo !== 'producto' || typeof product.stock !== 'number') {
                return null;
            }
            
            // Umbral de stock bajo (podría ser configurable por empresa en el futuro)
            const lowStockThreshold = 10;
            
            // Verificar si el stock está bajo pero mayor que cero
            if (product.stock <= lowStockThreshold && product.stock > 0) {
                // Buscar si ya existe una notificación activa para este producto
                const companyId = product.companyId;
                const productId = product._id;
                
                const existingNotification = await notificationService.findActiveNotification(
                    companyId,
                    'inventario_bajo',
                    productId
                );
                
                // Si no existe una notificación activa, crear una nueva
                if (!existingNotification) {
                    const notification = await notificationService.createNotification({
                        companyId,
                        type: 'inventario_bajo',
                        title: `Stock bajo: ${product.nombre}`,
                        message: `El producto ${product.nombre} (${product.codigo}) tiene solo ${product.stock} unidades disponibles.`,
                        severity: product.stock <= 5 ? 'warning' : 'info',
                        referenceId: productId,
                        referenceType: 'product',
                        link: `/products/${productId}`
                    });
                    
                    // Emitir notificación en tiempo real si está disponible la función global
                    if (global.emitCompanyNotification) {
                        global.emitCompanyNotification(companyId, notification);
                    }
                    
                    return notification;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error al verificar stock de producto:', error);
            throw error;
        }
    }
};

module.exports = stockMonitorService;