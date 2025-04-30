// controllers/platform-admin.controller.js
const Company = require('../models/company.model');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que estos modelos existan y las rutas sean correctas
const Invoice = require('../models/invoice.model');
const Client = require('../models/client.model');
const Product = require('../models/product.model');
// --- Inicio Modificación: Importar dependencias para notificación ---
const notificationService = require('../services/notification.service');
// Acceder a la función global de forma segura
// const emitCompanyNotification = global.emitCompanyNotification; // Eliminado según modificación
const socketService = require('../services/socket.service'); // Añadido según modificación
// --- Fin Modificación: Importar dependencias para notificación ---


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
                .select('_id nombre rif email active subscription createdAt changeHistory') // Incluir changeHistory si se usa DetailPanel
                .sort('-createdAt')
                .lean();

            res.json({
                success: true,
                // Mapear para asegurar estructura consistente y añadir historial si existe
                companies: companies.map(company => ({
                    id: company._id,
                    name: company.nombre,
                    rif: company.rif,
                    email: company.email,
                    active: company.active,
                    status: company.subscription?.status,
                    plan: company.subscription?.plan,
                    trialEndDate: company.subscription?.trialEndDate,
                    subscriptionEndDate: company.subscription?.subscriptionEndDate,
                    createdAt: company.createdAt,
                    // Pasar historial para DetailPanel (si existe)
                    changeHistory: company.changeHistory || []
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
            const adminUserId = req.user.userId; // Obtener ID del admin autenticado
            const adminName = req.user.name || 'Admin Plataforma'; // Obtener nombre del admin

            // Validación
            if (!companyId || days === undefined || !Number.isInteger(days) || days === 0) {
                return res.status(400).json({ success: false, message: 'ID de compañía y número de días diferente de cero requeridos' });
            }

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada' });
            }

            if (!company.subscription) company.subscription = {};

            const originalTrialEndDate = company.subscription.trialEndDate ? new Date(company.subscription.trialEndDate) : new Date();
            let newTrialEndDate;
            let message = '';
            let changeType = days > 0 ? 'Extensión Prueba' : 'Reducción Prueba';

            if (company.subscription.status === 'trial' && company.subscription.trialEndDate) {
                newTrialEndDate = new Date(company.subscription.trialEndDate);
            } else {
                newTrialEndDate = new Date(); // Base calculation on today if not in trial
                if (days > 0) {
                    company.subscription.status = 'trial'; // Mark as trial if extending from non-trial state
                    changeType = 'Inicio/Extensión Prueba';
                }
            }
            newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

            const now = new Date();
            let trialExpiredDueToPastDate = false;

            if (newTrialEndDate < now) {
                company.subscription.status = 'expired';
                company.subscription.trialEndDate = now; // Set expiration to now
                trialExpiredDueToPastDate = true;
                message = `Suscripción de prueba de ${company.nombre} marcada como expirada (fecha resultante pasada).`;
                changeType = 'Expiración Forzada Prueba'; // Specific type for this case
                newTrialEndDate = now; // The actual end date is now
            } else {
                company.subscription.trialEndDate = newTrialEndDate;
                if (days > 0) company.subscription.status = 'trial'; // Ensure status is trial if days > 0
            }

            // Añadir registro al historial de cambios
            const historyEntry = {
                timestamp: new Date(),
                adminId: adminUserId,
                adminName: adminName,
                type: changeType,
                days: days, // Guardar los días añadidos/quitados
                originalDate: originalTrialEndDate,
                newDate: newTrialEndDate,
                notes: trialExpiredDueToPastDate ? 'La fecha calculada estaba en el pasado.' : `Modificación manual de ${days} días.`
            };

            // Inicializar changeHistory si no existe
            if (!Array.isArray(company.changeHistory)) {
                company.changeHistory = [];
            }
            company.changeHistory.push(historyEntry);

            await company.save();

            if (!trialExpiredDueToPastDate) {
                message = days > 0 ? `Período de prueba extendido ${days} días para ${company.nombre}` : `Período de prueba reducido ${Math.abs(days)} días para ${company.nombre}`;
            }

            res.json({
                success: true,
                message: message,
                company: {
                    id: company._id,
                    name: company.nombre,
                    status: company.subscription.status,
                    trialEndDate: company.subscription.trialEndDate
                }
            });
        } catch (error) {
            console.error('Error modificando período de prueba:', error);
            res.status(500).json({ success: false, message: 'Error al modificar período de prueba' });
        }
    },

    // Cambiar estado de suscripción de una compañía (puede necesitar historial también)
    changeSubscriptionStatus: async (req, res) => {
        try {
            const { companyId, status } = req.body;
            const adminUserId = req.user.userId;
            const adminName = req.user.name || 'Admin Plataforma';

            if (!companyId || !status || !['trial', 'active', 'expired', 'cancelled'].includes(status)) {
                return res.status(400).json({ success: false, message: 'ID de compañía y estado válido requerido' });
            }

            const company = await Company.findById(companyId);
            if (!company) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada' });
            }

            if (!company.subscription) company.subscription = {};

            const originalStatus = company.subscription.status;
            const originalTrialEndDate = company.subscription.trialEndDate;
            const originalSubEndDate = company.subscription.subscriptionEndDate;

            company.subscription.status = status;

             if (status === 'active') {
                if (!company.subscription.subscriptionStartDate) company.subscription.subscriptionStartDate = new Date();
                if (!company.subscription.subscriptionEndDate) {
                    const endDate = new Date(); endDate.setFullYear(endDate.getFullYear() + 1);
                    company.subscription.subscriptionEndDate = endDate;
                }
                company.subscription.trialEndDate = undefined;
            } else if (status === 'trial') {
                 if (!company.subscription.trialEndDate || company.subscription.trialEndDate < new Date()) {
                      const trialEndDate = new Date(); trialEndDate.setDate(trialEndDate.getDate() + 7);
                      company.subscription.trialEndDate = trialEndDate;
                 }
                 company.subscription.subscriptionStartDate = undefined;
                 company.subscription.subscriptionEndDate = undefined;
            }

             // Añadir historial
             if (originalStatus !== status) {
                 const historyEntry = {
                     timestamp: new Date(),
                     adminId: adminUserId,
                     adminName: adminName,
                     type: `Cambio Estado: ${originalStatus || 'Ninguno'} → ${status}`,
                     originalDate: status === 'active' ? originalSubEndDate : originalTrialEndDate,
                     newDate: status === 'active' ? company.subscription.subscriptionEndDate : company.subscription.trialEndDate,
                     notes: `Estado de suscripción cambiado manualmente a ${status}.`
                 };
                 if (!Array.isArray(company.changeHistory)) company.changeHistory = [];
                 company.changeHistory.push(historyEntry);
             }


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
            res.status(500).json({ success: false, message: 'Error al cambiar estado de suscripción' });
        }
    },

    // Activar/desactivar una compañía (puede necesitar historial también)
    toggleCompanyActive: async (req, res) => {
        try {
            const { companyId, active } = req.body;
            const adminUserId = req.user.userId;
            const adminName = req.user.name || 'Admin Plataforma';

            if (!companyId || typeof active !== 'boolean') {
                return res.status(400).json({ success: false, message: 'ID de compañía y estado de activación (true/false) requeridos' });
            }

            // Obtener estado actual antes de actualizar
            const companyBefore = await Company.findById(companyId).select('active changeHistory').lean();
            if (!companyBefore) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada' });
            }

            // Solo actualizar si el estado es diferente
            if (companyBefore.active === active) {
                 return res.json({
                     success: true,
                     message: `La compañía ${companyId} ya estaba ${active ? 'activada' : 'desactivada'}.`,
                     company: { id: companyId, active: active }
                 });
            }

            // Añadir historial
             const historyEntry = {
                 timestamp: new Date(),
                 adminId: adminUserId,
                 adminName: adminName,
                 type: `Cambio Acceso: ${companyBefore.active ? 'Activada' : 'Desactivada'} → ${active ? 'Activada' : 'Desactivada'}`,
                 notes: `Estado de acceso cambiado manualmente a ${active ? 'Activado' : 'Desactivado'}.`
             };
             // Asegurar que changeHistory es un array
             const currentHistory = Array.isArray(companyBefore.changeHistory) ? companyBefore.changeHistory : [];

            // Actualizar el estado y añadir el historial
            const company = await Company.findByIdAndUpdate(
                companyId,
                {
                    active: active,
                    $push: { changeHistory: historyEntry } // Añadir al array de historial
                },
                { new: true }
            );

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
            res.status(500).json({ success: false, message: 'Error al cambiar estado de activación de la compañía' });
        }
    },

    // --- Inicio Modificación: Nueva función para enviar notificación ---
    sendNotificationToCompany: async (req, res) => {
        try {
            const { companyId } = req.params; // Obtener ID de la URL
            const { title, message, type = 'info' } = req.body; // Obtener datos del cuerpo
            const adminUserId = req.user.userId; // ID del admin que envía (asumiendo que está en req.user por el middleware)

            // Validación básica
            if (!companyId || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere ID de compañía, título y mensaje para la notificación.'
                });
            }

            // Verificar si la compañía existe (opcional pero recomendado)
            const companyExists = await Company.findById(companyId).select('nombre').lean(); // Solo necesitamos saber si existe y el nombre
            if (!companyExists) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada.' });
            }

            // Crear la notificación usando el servicio
            // Pasamos el ID del admin como 'createdBy' para saber quién la envió
            const notificationData = {
                companyId,
                title: `[FactTech] ${title}`, // Prefijo para identificar notificaciones de admin
                message,
                type, // 'info', 'warning', 'success', 'error', etc.
                createdBy: adminUserId, // Guardar quién la creó
                isPlatformAdminNotification: true // Marcarla como notificación del admin
            };

            const newNotification = await notificationService.createNotification(notificationData);

            // Emitir la notificación a la sala de la compañía vía Socket.IO
            // Reemplazado según modificación
            if (socketService.isInitialized()) {
                socketService.emitCompanyNotification(companyId.toString(), newNotification);
                console.log(`Notificación enviada por admin ${adminUserId} a compañía ${companyId}`);
            } else {
                console.warn('Servicio de Socket no inicializado. No se pudo emitir la notificación en tiempo real.');
            }

            // Responder al frontend
            res.json({
                success: true,
                message: `Notificación enviada correctamente a la compañía ${companyExists.nombre}.`,
                notification: newNotification // Devolver la notificación creada
            });

        } catch (error) {
            console.error('Error enviando notificación desde admin:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno al enviar la notificación.'
            });
        }
    }
    // --- Fin Modificación: Nueva función para enviar notificación ---
};

module.exports = platformAdminController;