// middleware/platform-admin.middleware.js
const platformAdminMiddleware = {
    // Middleware para verificar si el usuario es platform_admin
    isPlatformAdmin: (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            if (req.user.role !== 'platform_admin') {
                return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere ser administrador de plataforma.' });
            }

            // Si es platform_admin, permitir acceso
            console.log(`Acceso de platform_admin concedido: ${req.user.id}`);
            next();
        } catch (error) {
            console.error('Error en isPlatformAdmin middleware:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
        }
    },
    
    // Bypass para saltarse verificación de suscripción si es platform_admin
    bypassSubscriptionCheck: (req, res, next) => {
        try {
            if (req.user && req.user.role === 'platform_admin') {
                console.log(`Bypass de verificación de suscripción para platform_admin: ${req.user.id}`);
                return next();
            }
            // Si no es platform_admin, continuar con el flujo normal
            next();
        } catch (error) {
            console.error('Error en bypassSubscriptionCheck middleware:', error);
            next();
        }
    }
};

module.exports = platformAdminMiddleware;