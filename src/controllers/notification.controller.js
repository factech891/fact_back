// controllers/notification.controller.js
const notificationService = require('../services/notification.service');

const notificationController = {
    /**
     * Obtener notificaciones para la compañía del usuario autenticado
     */
    getNotifications: async (req, res) => {
        try {
            const companyId = req.user.companyId;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const filter = {};
            
            // Aplicar filtros opcionales
            if (req.query.read === 'true') filter.read = true;
            if (req.query.read === 'false') filter.read = false;
            if (req.query.type) filter.type = req.query.type;
            
            const result = await notificationService.getNotificationsByCompany(companyId, page, limit, filter);
            
            res.json({
                success: true,
                data: result.notifications,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones.',
                error: error.message
            });
        }
    },
    
    /**
     * Marcar notificación como leída
     */
    markAsRead: async (req, res) => {
        try {
            const notificationId = req.params.id;
            const userId = req.user.id;
            
            const updatedNotification = await notificationService.markAsRead(notificationId, userId);
            
            if (!updatedNotification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada.'
                });
            }
            
            res.json({
                success: true,
                data: updatedNotification
            });
        } catch (error) {
            console.error('Error al marcar notificación como leída:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificación como leída.',
                error: error.message
            });
        }
    },
    
    /**
     * Marcar todas las notificaciones como leídas
     */
    markAllAsRead: async (req, res) => {
        try {
            const companyId = req.user.companyId;
            
            const result = await notificationService.markAllAsRead(companyId);
            
            res.json({
                success: true,
                message: `${result.modified} notificaciones marcadas como leídas.`
            });
        } catch (error) {
            console.error('Error al marcar todas las notificaciones como leídas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar todas las notificaciones como leídas.',
                error: error.message
            });
        }
    },
    
    /**
     * Eliminar notificación
     */
    deleteNotification: async (req, res) => {
        try {
            const notificationId = req.params.id;
            
            const deletedNotification = await notificationService.deleteNotification(notificationId);
            
            if (!deletedNotification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada.'
                });
            }
            
            res.json({
                success: true,
                message: 'Notificación eliminada correctamente.'
            });
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar notificación.',
                error: error.message
            });
        }
    },
    
    /**
     * Verificar manualmente productos con stock bajo
     * (Útil para testing o para forzar la verificación)
     */
    checkLowStockProducts: async (req, res) => {
        try {
            const notifications = await notificationService.checkLowStockProducts();
            
            res.json({
                success: true,
                message: `Se verificaron productos con stock bajo. ${notifications.length} nuevas notificaciones creadas.`,
                data: notifications
            });
        } catch (error) {
            console.error('Error al verificar productos con stock bajo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar productos con stock bajo.',
                error: error.message
            });
        }
    }
};

module.exports = notificationController;