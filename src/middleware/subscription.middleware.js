// middleware/subscription.middleware.js (solución permanente simplificada)
const platformAdminMiddleware = require('./platform-admin.middleware');
const Company = require('../models/company.model');

const subscriptionMiddleware = {
    // Middleware para verificar si la suscripción está activa
    checkSubscriptionStatus: async (req, res, next) => {
        try {
            // Bypass para platform_admin
            if (req.user && req.user.role === 'platform_admin') {
                console.log(`Bypass de verificación de suscripción para platform_admin: ${req.user.id}`);
                return next();
            }

            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            const company = await Company.findById(req.user.companyId);

            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
            }

            const subscriptionInfo = company.subscription;

            if (!subscriptionInfo) {
                console.error(`Error crítico: No se encontró información de suscripción para la compañía ${req.user.companyId}`);
                return res.status(403).json({
                    success: false,
                    message: 'No se encontró información de suscripción asociada a esta empresa.',
                    subscriptionStatus: 'missing'
                });
            }

            const now = new Date();
            
            // Lógica para suscripciones trial
            if (subscriptionInfo.status === 'trial') {
                if (!subscriptionInfo.trialEndDate) {
                    console.log(`Advertencia: Compañía ${req.user.companyId} tiene trial sin fecha de finalización.`);
                    return res.status(403).json({
                        success: false,
                        message: 'Período de prueba sin fecha de finalización. Contacte al administrador.',
                        subscriptionStatus: 'invalid_trial'
                    });
                }
                
                const trialEndDate = new Date(subscriptionInfo.trialEndDate);
                console.log(`Compañía ${req.user.companyId} - Trial hasta: ${trialEndDate.toISOString()}, Fecha actual: ${now.toISOString()}`);
                
                if (trialEndDate > now) {
                    console.log(`Acceso permitido: Compañía ${req.user.companyId} en periodo de prueba vigente.`);
                    return next();
                } else {
                    console.log(`Trial expirado para compañía ${req.user.companyId}. Actualizando estado.`);
                    // Actualizar estado a expired
                    await Company.findByIdAndUpdate(req.user.companyId, { $set: { 'subscription.status': 'expired' } });
                    return res.status(403).json({
                        success: false,
                        message: 'Su período de prueba ha expirado. Contacte a soporte para extender su prueba o adquirir una suscripción.',
                        subscriptionStatus: 'trial_expired'
                    });
                }
            }

            if (subscriptionInfo.status !== 'active') {
                console.log(`Acceso denegado: Compañía ${req.user.companyId} con suscripción ${subscriptionInfo.status}.`);
                return res.status(403).json({
                    success: false,
                    message: 'La suscripción no está activa (expirada, cancelada o en prueba finalizada).',
                    subscriptionStatus: subscriptionInfo.status
                });
            }

            if (subscriptionInfo.subscriptionEndDate && new Date(subscriptionInfo.subscriptionEndDate) < now) {
                if (company.subscription.status === 'active') {
                    console.log(`Suscripción expirada para compañía ${req.user.companyId}. Actualizando estado.`);
                    await Company.findByIdAndUpdate(req.user.companyId, { $set: { 'subscription.status': 'expired' } });
                }
                return res.status(403).json({
                    success: false,
                    message: 'La suscripción ha expirado.',
                    subscriptionStatus: 'expired'
                });
            }

            console.log(`Acceso permitido: Compañía ${req.user.companyId} con suscripción activa.`);
            next();
        } catch (error) {
            console.error('Error en checkSubscriptionStatus:', error);
            return res.status(500).json({ success: false, message: 'Error interno al verificar estado de suscripción.' });
        }
    },

    // Función simplificada que reemplaza a checkPlanLimits
    // Ya no verifica límites, sólo pasa al siguiente middleware
    checkPlanLimits: (resourceType) => {
        return async (req, res, next) => {
            console.log(`Sistema simplificado: Sin verificación de límites para ${resourceType}`);
            return next();
        };
    }
};

module.exports = subscriptionMiddleware;