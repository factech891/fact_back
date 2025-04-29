// middleware/platform-admin.middleware.js
const platformAdminMiddleware = {
    // Middleware para verificar si el usuario es platform_admin
    isPlatformAdmin: (req, res, next) => {
        // --- LOG INICIAL ---
        console.log(`>>> platformAdminMiddleware.isPlatformAdmin ejecutado para: ${req.method} ${req.originalUrl}`);
        // --- FIN LOG ---
        try {
            if (!req.user) {
                // Este log es útil si authenticateToken falla o no se ejecuta antes
                console.log('<<< Acceso denegado por platformAdminMiddleware: req.user no definido (falta autenticación previa).');
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            if (req.user.role !== 'platform_admin') {
                // --- LOG ACCESO DENEGADO ---
                console.log(`<<< Acceso denegado por platformAdminMiddleware. Rol del usuario: ${req.user?.role}`);
                // --- FIN LOG ---
                return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere ser administrador de plataforma.' });
            }

            // Si es platform_admin, permitir acceso
            console.log(`Acceso de platform_admin concedido: ${req.user.id} para ${req.method} ${req.originalUrl}`);
            next();
        } catch (error) {
            console.error('Error en isPlatformAdmin middleware:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
        }
    },

    // Bypass para saltarse verificación de suscripción si es platform_admin
    bypassSubscriptionCheck: (req, res, next) => {
        // --- LOG INICIAL ---
        console.log(`>>> platformAdminMiddleware.bypassSubscriptionCheck ejecutado para: ${req.method} ${req.originalUrl}`);
        // --- FIN LOG ---
        try {
            if (req.user && req.user.role === 'platform_admin') {
                console.log(`Bypass de verificación de suscripción para platform_admin: ${req.user.id}`);
                // Importante: Llamar a next() para que el flujo continúe,
                // pero este middleware no bloquea, solo decide si otros deben actuar.
                // No se retorna aquí, solo se loguea el bypass.
            }
            // Siempre llamar a next() para que otros middlewares o la ruta final se ejecuten
            next();
        } catch (error) {
            console.error('Error en bypassSubscriptionCheck middleware:', error);
            // En caso de error en este middleware (poco probable), continuar igual para no bloquear
            next();
        }
    }
};

module.exports = platformAdminMiddleware;