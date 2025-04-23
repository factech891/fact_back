// middleware/subscription.middleware.js (Corregido para devolver 403 en lugar de 404)
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que la ruta sea correcta

const subscriptionMiddleware = {
    // Middleware para verificar si la suscripción está activa (sin cambios)
    checkSubscriptionStatus: async (req, res, next) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            // Buscar la compañía y su suscripción embebida o referenciada
            // Es más eficiente buscar la compañía que ya tiene la info de suscripción
            // si está embebida o populada correctamente.
            const company = await Company.findById(req.user.companyId).populate('subscription'); // Intentar popular si es referencia

            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
            }

            // Acceder a la información de suscripción (embebidda o populada)
            const subscriptionInfo = company.subscription;

            if (!subscriptionInfo) {
                 // Si no hay información de suscripción asociada a la compañía
                 // Esto indica un problema de datos, debería existir siempre.
                 console.error(`Error crítico: No se encontró información de suscripción para la compañía ${req.user.companyId}`);
                 return res.status(403).json({
                     success: false,
                     message: 'No se encontró información de suscripción asociada a esta empresa.',
                     subscriptionStatus: 'missing'
                 });
            }


            // Verificar si está en periodo de prueba
            const now = new Date();
            if (subscriptionInfo.status === 'trial' && subscriptionInfo.trialEndDate && new Date(subscriptionInfo.trialEndDate) > now) {
                // Aún está en periodo de prueba, permitir acceso
                console.log(`Acceso permitido: Compañía ${req.user.companyId} en periodo de prueba.`);
                return next();
            }

            // Verificar si la suscripción está activa
            if (subscriptionInfo.status !== 'active') {
                 console.log(`Acceso denegado: Compañía ${req.user.companyId} con suscripción ${subscriptionInfo.status}.`);
                return res.status(403).json({
                    success: false,
                    message: 'La suscripción no está activa (expirada, cancelada o en prueba finalizada).',
                    subscriptionStatus: subscriptionInfo.status
                });
            }

            // Verificar fecha de vencimiento si existe y el estado es 'active'
            if (subscriptionInfo.subscriptionEndDate && new Date(subscriptionInfo.subscriptionEndDate) < now) {
                // Actualizar estado a expirado si corresponde
                if (company.subscription.status === 'active') { // Solo actualizar si estaba activa
                    console.log(`Suscripción expirada para compañía ${req.user.companyId}. Actualizando estado.`);
                    company.subscription.status = 'expired';
                    // Guardar el cambio en el documento Company
                    await Company.findByIdAndUpdate(req.user.companyId, { $set: { 'subscription.status': 'expired' } });
                }

                return res.status(403).json({
                    success: false,
                    message: 'La suscripción ha expirado.',
                    subscriptionStatus: 'expired'
                });
            }

            // Todo está bien, continuar
            console.log(`Acceso permitido: Compañía ${req.user.companyId} con suscripción activa.`);
            next();
        } catch (error) {
            console.error('Error en checkSubscriptionStatus:', error);
            return res.status(500).json({ success: false, message: 'Error interno al verificar estado de suscripción.' });
        }
    },

    // Middleware para verificar límites según el plan
    checkPlanLimits: (resourceType) => {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.companyId) {
                    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
                }

                // Si es una solicitud GET, generalmente no se aplican límites de creación
                // Podrías querer verificar límites de lectura si tu plan los tiene.
                // if (req.method === 'GET') {
                //     return next();
                // }

                // Buscar la información de suscripción directamente
                // Es importante que este documento exista para cada compañía
                const subscription = await Subscription.findOne({ companyId: req.user.companyId });

                if (!subscription) {
                    // --- CORRECCIÓN AQUÍ ---
                    // Cambiar 404 a 403 (Forbidden)
                    console.warn(`Límite no verificado: No se encontró suscripción para compañía ${req.user.companyId}.`);
                    return res.status(403).json({ // <-- CAMBIADO DE 404 a 403
                        success: false,
                        message: 'Acceso denegado. No se encontró información de suscripción válida para verificar los límites del plan.'
                    });
                }

                 // Si la suscripción no está activa (ej. trial expirado, cancelada), no permitir crear/modificar
                 if (subscription.status !== 'active' && subscription.status !== 'trial') {
                    // Podríamos verificar si el trial aún es válido aquí también por redundancia
                    const now = new Date();
                    if (subscription.status === 'trial' && subscription.trialEndDate && new Date(subscription.trialEndDate) > now) {
                       // Si está en trial válido, continuar para verificar límites específicos si los hay para trial
                       console.log(`Usuario en trial (${req.user.companyId}), verificando límites para ${resourceType}...`);
                    } else {
                       console.log(`Acción denegada: Suscripción no activa (${subscription.status}) para compañía ${req.user.companyId}.`);
                       return res.status(403).json({
                           success: false,
                           message: `La suscripción (${subscription.status}) no permite crear o modificar ${resourceType}.`,
                           subscriptionStatus: subscription.status
                       });
                    }
                 }


                // Verificar límites según el tipo de recurso
                let limit = Infinity; // Límite por defecto (infinito)
                let currentCount = 0;
                let limitReached = false;

                // Usar un bloque switch para manejar los diferentes tipos de recursos
                switch(resourceType) {
                    case 'users':
                        // Asegurarse de que features y maxUsers existen
                        limit = subscription.features?.maxUsers;
                        if (typeof limit !== 'number') {
                             console.warn(`Límite de usuarios no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity; // Permitir si no está definido
                        } else {
                            currentCount = await require('../models/user.model').countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'clients':
                        limit = subscription.features?.maxClients;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de clientes no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                        } else {
                            currentCount = await require('../models/client.model').countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'products':
                        limit = subscription.features?.maxProducts;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de productos no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                        } else {
                            currentCount = await require('../models/product.model').countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'invoices':
                         limit = subscription.features?.maxInvoicesPerMonth;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de facturas mensuales no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                         } else {
                            const startOfMonth = new Date();
                            startOfMonth.setDate(1);
                            startOfMonth.setHours(0, 0, 0, 0);
                            currentCount = await require('../models/invoice.model').countDocuments({
                                companyId: req.user.companyId,
                                createdAt: { $gte: startOfMonth } // Asegúrate que tus facturas tengan createdAt
                            });
                            limitReached = currentCount >= limit;
                         }
                        break;
                    // Añadir más casos si tienes otros límites (ej: 'documents')
                    default:
                        console.warn(`Tipo de recurso desconocido para límite de plan: ${resourceType}`);
                        // Por defecto, no aplicar límite si el tipo no se reconoce
                        break;
                }

                // Si se alcanzó el límite (y no es infinito)
                if (limitReached && limit !== Infinity) {
                    console.log(`Límite alcanzado para ${resourceType}: ${currentCount}/${limit} para compañía ${req.user.companyId}`);
                    return res.status(403).json({
                        success: false,
                        message: `Ha alcanzado el límite de ${resourceType} (${limit}) para su plan actual.`,
                        limit: limit,
                        current: currentCount
                    });
                }

                // Todo está bien, continuar
                console.log(`Límite OK para ${resourceType}: ${currentCount}/${limit === Infinity ? 'Ilimitado' : limit} para compañía ${req.user.companyId}`);
                next();
            } catch (error) {
                console.error(`Error en checkPlanLimits para ${resourceType}:`, error);
                return res.status(500).json({ success: false, message: 'Error interno al verificar límites de suscripción.' });
            }
        };
    }
};

module.exports = subscriptionMiddleware;