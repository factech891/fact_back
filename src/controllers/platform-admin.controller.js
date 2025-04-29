// controllers/platform-admin.controller.js
const Company = require('../models/company.model');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que estos modelos existan y las rutas sean correctas
const Invoice = require('../models/invoice.model');
const Client = require('../models/client.model');
const Product = require('../models/product.model');

const platformAdminController = {
    // Obtener estadísticas globales
    getDashboardStats: async (req, res) => {
        try {
            // Contar compañías por estado de suscripción
            const companiesCount = await Company.countDocuments();
            const trialCompanies = await Company.countDocuments({'subscription.status': 'trial'});
            const activeCompanies = await Company.countDocuments({'subscription.status': 'active'});
            const expiredCompanies = await Company.countDocuments({'subscription.status': 'expired'});
            const cancelledCompanies = await Company.countDocuments({'subscription.status': 'cancelled'});

            // Contar usuarios
            const usersCount = await User.countDocuments();

            // Obtener compañías con trial por expirar (próximos 7 días)
            const now = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(now.getDate() + 7);

            const expiringTrials = await Company.find({
                'subscription.status': 'trial',
                'subscription.trialEndDate': { $gte: now, $lt: nextWeek } // Corregido: usar $gte para incluir hoy
            }).select('nombre _id subscription.trialEndDate').lean();

            res.json({
                success: true,
                stats: {
                    companies: {
                        total: companiesCount,
                        trial: trialCompanies,
                        active: activeCompanies,
                        expired: expiredCompanies,
                        cancelled: cancelledCompanies,
                    },
                    users: {
                        total: usersCount
                    },
                    expiringTrials: expiringTrials.map(company => ({
                        id: company._id,
                        name: company.nombre,
                        expiryDate: company.subscription.trialEndDate
                    }))
                }
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas de plataforma:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de la plataforma'
            });
        }
    },

    // Listar todas las compañías
    listCompanies: async (req, res) => {
        try {
            const companies = await Company.find()
                .select('_id nombre rif email active subscription createdAt')
                .sort('-createdAt')
                .lean();

            res.json({
                success: true,
                companies: companies.map(company => ({
                    id: company._id,
                    name: company.nombre,
                    rif: company.rif,
                    email: company.email,
                    active: company.active,
                    // Acceder a los campos anidados de subscription de forma segura
                    status: company.subscription?.status,
                    plan: company.subscription?.plan,
                    trialEndDate: company.subscription?.trialEndDate,
                    subscriptionEndDate: company.subscription?.subscriptionEndDate,
                    createdAt: company.createdAt
                }))
            });
        } catch (error) {
            console.error('Error listando compañías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al listar compañías'
            });
        }
    },

    // Extender o reducir período de prueba de una compañía
    extendTrial: async (req, res) => {
        try {
            const { companyId, days } = req.body;

            // Validación: Permitir días negativos, pero no cero.
            if (!companyId || days === undefined || !Number.isInteger(days) || days === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un ID de compañía válido y un número de días (entero) diferente de cero'
                });
            }

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: 'Compañía no encontrada'
                });
            }

            // Asegurarse que la estructura de subscription exista
            if (!company.subscription) {
                 company.subscription = {}; // Inicializar si no existe
            }


            // Calcular nueva fecha de fin de trial
            let newTrialEndDate;
            let message = ''; // Inicializar mensaje

            if (company.subscription.status === 'trial' && company.subscription.trialEndDate) {
                // Si está en trial, extender/reducir desde la fecha actual de fin
                newTrialEndDate = new Date(company.subscription.trialEndDate);
            } else {
                // Si no está en trial o no tiene fecha de fin, empezar/reducir desde hoy
                newTrialEndDate = new Date();
                // Si se añaden días (extensión) a una suscripción no 'trial', cambiarla a 'trial'
                if (days > 0) {
                    company.subscription.status = 'trial';
                }
            }

            // Añadir o restar los días según el signo
            newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

            const now = new Date();
            let trialExpiredDueToPastDate = false;

            // Verificar si la nueva fecha calculada es en el pasado
            if (newTrialEndDate < now) {
                // Opción: Marcar como expirada si la fecha resultante es pasada
                company.subscription.status = 'expired';
                company.subscription.trialEndDate = now; // Establecer la fecha de expiración a ahora
                trialExpiredDueToPastDate = true;
                // Mensaje específico para este caso
                message = `La suscripción de prueba de ${company.nombre} ha sido marcada como expirada porque la nueva fecha (${newTrialEndDate.toISOString().split('T')[0]}) estaría en el pasado.`;
            } else {
                // Si la fecha es futura o hoy, actualizarla normalmente
                company.subscription.trialEndDate = newTrialEndDate;
                 // Si se extendió/redujo pero sigue en trial, asegurar que el status sea 'trial'
                 // (Podría haberse calculado desde hoy si no estaba en trial antes)
                 if (days > 0) { // Solo tiene sentido marcar como trial si se extienden días
                     company.subscription.status = 'trial';
                 }
            }

            // Guardar cambios
            await company.save();

            // Mensaje de respuesta dinámico
            // Si no expiró por fecha pasada, usar el mensaje de extensión/reducción
            if (!trialExpiredDueToPastDate) {
                 message = days > 0
                    ? `Período de prueba extendido por ${days} días para ${company.nombre}`
                    : `Período de prueba reducido en ${Math.abs(days)} días para ${company.nombre}`;
            }

            res.json({
                success: true,
                message: message, // Usar el mensaje determinado
                company: {
                    id: company._id,
                    name: company.nombre,
                    status: company.subscription.status,
                    trialEndDate: company.subscription.trialEndDate // Devolver la fecha final guardada
                }
            });
        } catch (error) {
            console.error('Error modificando período de prueba:', error);
            res.status(500).json({
                success: false,
                message: 'Error al modificar período de prueba'
            });
        }
    },

    // Cambiar estado de suscripción de una compañía
    changeSubscriptionStatus: async (req, res) => {
        try {
            const { companyId, status } = req.body;

            if (!companyId || !status || !['trial', 'active', 'expired', 'cancelled'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un ID de compañía válido y un estado válido (trial, active, expired, cancelled)'
                });
            }

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: 'Compañía no encontrada'
                });
            }

             // Asegurarse que la estructura de subscription exista
            if (!company.subscription) {
                 company.subscription = {}; // Inicializar si no existe
            }

            // Actualizar estado
            company.subscription.status = status;

            // Si es active y no hay fecha de inicio/fin, establecerla
            if (status === 'active') {
                if (!company.subscription.subscriptionStartDate) {
                    company.subscription.subscriptionStartDate = new Date();
                }
                if (!company.subscription.subscriptionEndDate) {
                    // Por defecto, suscripción de 1 año
                    const endDate = new Date();
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    company.subscription.subscriptionEndDate = endDate;
                }
                // Al activar, limpiar fechas de trial si existieran
                company.subscription.trialEndDate = undefined;
            } else if (status === 'trial') {
                 // Si se pone en trial manualmente, establecer fecha fin por defecto (ej: 7 días) si no existe
                 if (!company.subscription.trialEndDate || company.subscription.trialEndDate < new Date()) {
                      const trialEndDate = new Date();
                      trialEndDate.setDate(trialEndDate.getDate() + 7); // Trial por defecto de 7 días
                      company.subscription.trialEndDate = trialEndDate;
                 }
                 // Limpiar fechas de suscripción activa
                 company.subscription.subscriptionStartDate = undefined;
                 company.subscription.subscriptionEndDate = undefined;
            } else {
                 // Para expired/cancelled, limpiar fechas si es necesario o mantenerlas como registro
                 // (Aquí se decide mantenerlas, pero se podrían limpiar)
                 // company.subscription.trialEndDate = undefined;
                 // company.subscription.subscriptionStartDate = undefined;
                 // company.subscription.subscriptionEndDate = undefined;
            }


            // Guardar cambios
            await company.save();

            res.json({
                success: true,
                message: `Estado de suscripción cambiado a "${status}" para ${company.nombre}`,
                company: {
                    id: company._id,
                    name: company.nombre,
                    status: company.subscription.status,
                    trialEndDate: company.subscription.trialEndDate,
                    subscriptionStartDate: company.subscription.subscriptionStartDate,
                    subscriptionEndDate: company.subscription.subscriptionEndDate
                }
            });
        } catch (error) {
            console.error('Error cambiando estado de suscripción:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado de suscripción'
            });
        }
    },

    // Activar/desactivar una compañía (afecta el login, no la suscripción)
    toggleCompanyActive: async (req, res) => {
        try {
            const { companyId, active } = req.body;

            // Validar que 'active' sea un booleano
            if (!companyId || typeof active !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un ID de compañía válido y un estado de activación (true/false)'
                });
            }

            const company = await Company.findByIdAndUpdate(
                companyId,
                { active: active }, // Usar directamente el booleano recibido
                { new: true } // Devuelve el documento actualizado
            );

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: 'Compañía no encontrada'
                });
            }

            res.json({
                success: true,
                message: `Compañía ${company.nombre} ${company.active ? 'activada' : 'desactivada'} correctamente`,
                company: {
                    id: company._id,
                    name: company.nombre,
                    active: company.active
                }
            });
        } catch (error) {
            console.error('Error cambiando estado de activación de la compañía:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado de activación de la compañía'
            });
        }
    }
};

module.exports = platformAdminController;