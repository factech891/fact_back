// controllers/platform-admin.controller.js
const Company = require('../models/company.model');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const Invoice = require('../models/invoice.model');
const Client = require('../models/client.model');
const Product = require('../models/product.model');
const notificationService = require('../services/notification.service');
const socketService = require('../services/socket.service');
const mongoose = require('mongoose'); // Añadido para trabajar con ObjectId

const platformAdminController = {
    // Obtener estadísticas globales - CORREGIDO
    getDashboardStats: async (req, res) => {
        try {
            // ID de la compañía del sistema a excluir
            const systemCompanyId = '6810bdec7555a357cabbe6b0';

            // Consulta para contar empresas excluyendo la del sistema
            const companiesCount = await Company.countDocuments({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) } // Corregido
            });

            // Contar por estado de suscripción - excluyendo Sistema FactTech
            const trialCompanies = await Company.countDocuments({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) }, // Corregido
                'subscription.status': 'trial'
            });

            const activeCompanies = await Company.countDocuments({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) }, // Corregido
                'subscription.status': 'active' // Solo empresas con suscripción activa
            });

            const expiredCompanies = await Company.countDocuments({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) }, // Corregido
                'subscription.status': 'expired'
            });

            const cancelledCompanies = await Company.countDocuments({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) }, // Corregido
                'subscription.status': 'cancelled'
            });

            // Obtener usuarios (excluyendo al admin si es necesario)
            const usersCount = await User.countDocuments();

            // Períodos de prueba por expirar
            const now = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(now.getDate() + 7);

            const expiringTrials = await Company.find({
                _id: { $ne: new mongoose.Types.ObjectId(systemCompanyId) }, // Corregido
                'subscription.status': 'trial',
                'subscription.trialEndDate': { $gte: now, $lt: nextWeek }
            }).select('nombre _id subscription.trialEndDate').lean();

            // Logs para depuración
            console.log(`[Stats] Total empresas (sin sistema): ${companiesCount}`);
            console.log(`[Stats] Empresas en trial: ${trialCompanies}`);
            console.log(`[Stats] Empresas con suscripción activa: ${activeCompanies}`);
            console.log(`[Stats] Empresas expiradas: ${expiredCompanies}`);
            console.log(`[Stats] Empresas canceladas: ${cancelledCompanies}`);
            console.log(`[Stats] Total usuarios: ${usersCount}`);

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

    // Listar todas las compañías (sin cambios)
    listCompanies: async (req, res) => {
        try {
            const companies = await Company.find()
                .select('_id nombre rif email active subscription createdAt changeHistory')
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
                    status: company.subscription?.status,
                    plan: company.subscription?.plan,
                    trialEndDate: company.subscription?.trialEndDate,
                    subscriptionEndDate: company.subscription?.subscriptionEndDate,
                    createdAt: company.createdAt,
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

    // Extender o reducir período de prueba de una compañía (sin cambios)
    extendTrial: async (req, res) => {
        try {
            const { companyId, days } = req.body;
            const adminUserId = req.user.userId;
            const adminName = req.user.name || 'Admin Plataforma';

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
                newTrialEndDate = new Date();
                if (days > 0) {
                    company.subscription.status = 'trial';
                    changeType = 'Inicio/Extensión Prueba';
                }
            }
            newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

            const now = new Date();
            let trialExpiredDueToPastDate = false;

            if (newTrialEndDate < now) {
                company.subscription.status = 'expired';
                company.subscription.trialEndDate = now;
                trialExpiredDueToPastDate = true;
                message = `Suscripción de prueba de ${company.nombre} marcada como expirada (fecha resultante pasada).`;
                changeType = 'Expiración Forzada Prueba';
                newTrialEndDate = now;
            } else {
                company.subscription.trialEndDate = newTrialEndDate;
                if (days > 0) company.subscription.status = 'trial';
            }

            const historyEntry = {
                timestamp: new Date(),
                adminId: adminUserId,
                adminName: adminName,
                type: changeType,
                days: days,
                originalDate: originalTrialEndDate,
                newDate: newTrialEndDate,
                notes: trialExpiredDueToPastDate ? 'La fecha calculada estaba en el pasado.' : `Modificación manual de ${days} días.`
            };

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

    // Cambiar estado de suscripción de una compañía (sin cambios)
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

    // Activar/desactivar una compañía (sin cambios)
    toggleCompanyActive: async (req, res) => {
        try {
            const { companyId, active } = req.body;
            const adminUserId = req.user.userId;
            const adminName = req.user.name || 'Admin Plataforma';

            if (!companyId || typeof active !== 'boolean') {
                return res.status(400).json({ success: false, message: 'ID de compañía y estado de activación (true/false) requeridos' });
            }

            const companyBefore = await Company.findById(companyId).select('active nombre changeHistory').lean(); // Añadido nombre
            if (!companyBefore) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada' });
            }

            if (companyBefore.active === active) {
                 // Añadido nombre a mensaje y respuesta
                return res.json({
                    success: true,
                    message: `La compañía ${companyBefore.nombre} ya estaba ${active ? 'activada' : 'desactivada'}.`,
                    company: { id: companyId, name: companyBefore.nombre, active: active }
                });
            }

            const historyEntry = {
                timestamp: new Date(),
                adminId: adminUserId,
                adminName: adminName,
                type: `Cambio Acceso: ${companyBefore.active ? 'Activada' : 'Desactivada'} → ${active ? 'Activada' : 'Desactivada'}`,
                notes: `Estado de acceso cambiado manualmente a ${active ? 'Activado' : 'Desactivado'}.`
            };
            // const currentHistory = Array.isArray(companyBefore.changeHistory) ? companyBefore.changeHistory : []; // No es necesario con $push

            const company = await Company.findByIdAndUpdate(
                companyId,
                {
                    active: active,
                    $push: { changeHistory: historyEntry }
                },
                { new: true }
            ).select('_id nombre active'); // Asegurar que se devuelve el nombre

            // Posible conflicto: El código base original no incluía 'nombre' en la respuesta aquí, pero parece lógico hacerlo.
            // Manteniendo la estructura de la base para 'message', pero añadiendo 'name' al objeto 'company' de la respuesta si es devuelto por findByIdAndUpdate.
            // Se asume que el 'company' devuelto por findByIdAndUpdate ahora incluye 'nombre' por el .select()
            if (!company) { // Chequeo de seguridad
                return res.status(404).json({success: false, message: "Compañía no encontrada después de intentar actualizar."})
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
            res.status(500).json({ success: false, message: 'Error al cambiar estado de activación de la compañía' });
        }
    },

    // Enviar notificación (sin cambios)
    sendNotificationToCompany: async (req, res) => {
        try {
            const { companyId } = req.params;
            const { title, message, type = 'info' } = req.body;
            const adminUserId = req.user.userId;

            if (!companyId || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere ID de compañía, título y mensaje para la notificación.'
                });
            }

            const companyExists = await Company.findById(companyId).select('nombre').lean();
            if (!companyExists) {
                return res.status(404).json({ success: false, message: 'Compañía no encontrada.' });
            }

            const notificationData = {
                companyId,
                title: `[FactTech] ${title}`,
                message,
                type,
                createdBy: adminUserId,
                isPlatformAdminNotification: true
            };

            const newNotification = await notificationService.createNotification(notificationData);

            if (socketService.isInitialized()) {
                socketService.emitCompanyNotification(companyId.toString(), newNotification);
                console.log(`Notificación enviada por admin ${adminUserId} a compañía ${companyId}`);
            } else {
                console.warn('Servicio de Socket no inicializado. No se pudo emitir la notificación en tiempo real.');
            }

            res.json({
                success: true,
                message: `Notificación enviada correctamente a la compañía ${companyExists.nombre}.`,
                notification: newNotification
            });

        } catch (error) {
            console.error('Error enviando notificación desde admin:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno al enviar la notificación.'
            });
        }
    }
};

module.exports = platformAdminController;