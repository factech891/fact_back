// controllers/invoice.controller.js
const mongoose = require('mongoose');
// Importar funciones del servicio actualizado
const {
    getAllInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice, // Usaremos esta desde el servicio para la lógica de actualización
    deleteInvoice,
    getInvoiceByNumber,
    updateInvoiceStatus
} = require('../services/invoice.service'); // Asegúrate que la ruta sea correcta

// Importar modelo para la generación de números (podría moverse al servicio)
const Invoice = require('../models/invoice.model');
// Importar modelos relacionados para validaciones (opcional, mejor en servicio)
// const Client = require('../models/client.model');
// const Product = require('../models/product.model');

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todas las facturas de la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.getInvoices = async (req, res) => {
    try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

        console.log(`Controller - getInvoices para CompanyId: ${companyId}`);
        // Llamar al servicio con companyId
        const invoices = await getAllInvoices(companyId);
        res.status(200).json(invoices);

    } catch (error) {
        console.error('Controller - Error obteniendo facturas:', error.message);
        res.status(500).json({ message: 'Error interno al obtener facturas.' });
    }
};

/**
 * Obtener una factura por ID, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params; // ID de la factura
        const companyId = req.user?.companyId; // ID de la compañía

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller - ID de factura inválido: ${id}`);
            return res.status(400).json({ message: 'ID de factura inválido.' });
        }

        console.log(`Controller - getInvoiceById: InvoiceID ${id}, CompanyId ${companyId}`);
        // Llamar al servicio con ID de factura y companyId
        const invoice = await getInvoiceById(id, companyId);
        // El servicio lanza error si no se encuentra o no pertenece a la compañía
        res.status(200).json(invoice);

    } catch (error) {
        console.error('Controller - Error al obtener factura por ID:', error.message);
        if (error.message === 'Factura no encontrada') {
            return res.status(404).json({ message: 'Factura no encontrada.' });
        }
        if (error.message === 'ID de factura inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno al obtener la factura.' });
    }
};


/**
 * Crear o Actualizar una factura para la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.createOrUpdateInvoice = async (req, res) => {
    try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

        console.log(`Controller - createOrUpdateInvoice para CompanyId: ${companyId}`);
        console.log('Datos recibidos del frontend:', req.body);

        const { _id, ...invoiceData } = req.body;

        // --- Validación y Procesamiento Común ---
        // Asegurar que la fecha se guarde correctamente
        if (invoiceData.date) {
            if (typeof invoiceData.date === 'string' && !invoiceData.date.includes('T')) {
                invoiceData.date = `${invoiceData.date}T12:00:00.000Z`; // Usar UTC para consistencia
            }
            // Convertir a objeto Date por si acaso
            invoiceData.date = new Date(invoiceData.date);
            if (isNaN(invoiceData.date.getTime())) { // Validar si la fecha es válida
                 return res.status(400).json({ message: 'Formato de fecha inválido.' });
            }
        } else if (!_id) { // Requerir fecha solo en creación
             return res.status(400).json({ message: 'La fecha es requerida para crear una factura.' });
        }

        // Validar cliente y items básicos
        if (!invoiceData.client || !isValidObjectId(invoiceData.client)) {
             return res.status(400).json({ message: 'Cliente inválido o faltante.' });
        }
        if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
             return res.status(400).json({ message: 'Se requiere al menos un ítem en la factura.' });
        }

        // Procesar items, calcular subtotales y total (IVA 16% ejemplo)
        let calculatedSubtotal = 0;
        let calculatedTax = 0;
        const processedItems = invoiceData.items.map(item => {
            if (!item.product || !isValidObjectId(item.product) || !item.quantity || !item.price) {
                throw new Error('Cada ítem debe tener producto, cantidad y precio válidos.');
            }
            const quantity = Number(item.quantity);
            const price = Number(item.price);
            const itemSubtotal = quantity * price;
            calculatedSubtotal += itemSubtotal;
            if (!item.taxExempt) { // Aplicar impuesto si no está exento
                calculatedTax += itemSubtotal * 0.16; // Ejemplo IVA 16%
            }
            return {
                product: item.product,
                quantity: quantity,
                price: price,
                taxExempt: item.taxExempt || false,
                subtotal: itemSubtotal
            };
        });

        invoiceData.items = processedItems;
        invoiceData.subtotal = calculatedSubtotal;
        invoiceData.tax = calculatedTax;
        invoiceData.total = calculatedSubtotal + calculatedTax;

        // --- Lógica de Creación o Actualización ---
        let savedInvoice;
        if (_id) {
            // --- ACTUALIZACIÓN ---
            if (!isValidObjectId(_id)) {
                return res.status(400).json({ message: 'ID de factura inválido para actualizar.' });
            }
            console.log(`Controller - Actualizando factura ID: ${_id} para CompanyId: ${companyId}`);
            // Llamar al servicio de actualización pasando id, datos y companyId
            savedInvoice = await updateInvoice(_id, invoiceData, companyId);
            // El servicio ya maneja el populate y el error si no se encuentra/no pertenece a la compañía

        } else {
            // --- CREACIÓN ---
            console.log(`Controller - Creando nueva factura para CompanyId: ${companyId}`);

            // Generar número único de factura POR COMPAÑÍA
            const lastInvoice = await Invoice.findOne({ companyId: companyId }).sort({ createdAt: -1 }); // Buscar último por fecha de creación para esa compañía
            let nextNumber = 1;
            if (lastInvoice && lastInvoice.number && typeof lastInvoice.number === 'string') {
                 // Extraer número secuencial (asumiendo formato como 'INV-XXXX' o solo número)
                 const match = lastInvoice.number.match(/\d+$/);
                 if (match) {
                     nextNumber = parseInt(match[0], 10) + 1;
                 }
                 // Si no hay número o formato no coincide, se usará 1
            }
            // Puedes personalizar el prefijo o formato aquí
            const invoiceNumber = `F-${String(nextNumber).padStart(5, '0')}`; // Ejemplo: F-00001

            // Verificar si el número generado ya existe (poco probable pero posible en concurrencia)
            const existingNumber = await getInvoiceByNumber(invoiceNumber, companyId);
            if (existingNumber) {
                 // Podrías reintentar o devolver error
                 console.error(`Controller - Error: Número de factura generado ${invoiceNumber} ya existe para CompanyId ${companyId}`);
                 return res.status(500).json({ message: 'Error al generar número de factura único. Intente nuevamente.' });
            }
            invoiceData.number = invoiceNumber;

            // Asignar valores por defecto si no vienen
            invoiceData.status = invoiceData.status || 'draft';
            invoiceData.moneda = invoiceData.moneda || 'VES';
            invoiceData.condicionesPago = invoiceData.condicionesPago || 'Contado';
            invoiceData.diasCredito = invoiceData.diasCredito !== undefined ? invoiceData.diasCredito : 0;
            invoiceData.notes = invoiceData.notes || '';
            invoiceData.terms = invoiceData.terms || '';

            // Llamar al servicio de creación pasando datos y companyId
            // El servicio se encargará de asignar companyId y poblar
            savedInvoice = await createInvoice(invoiceData, companyId);
        }

        // Devolver la factura guardada (ya poblada por el servicio)
        res.status(_id ? 200 : 201).json(savedInvoice);

    } catch (error) {
        console.error('Controller - Error al guardar/actualizar la factura:', error.message);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `Error de validación: ${errors.join(', ')}` });
        }
        if (error.message.includes('duplicate key') || error.message.includes('Ya existe una factura con este número')) {
             return res.status(400).json({ message: 'Error: El número de factura ya existe para esta compañía.' });
        }
        if (error.message === 'Factura no encontrada o no tiene permiso para actualizarla') {
             return res.status(404).json({ message: error.message });
        }
         if (error.message.startsWith('Cliente inválido') || error.message.startsWith('Producto inválido')) {
             // Errores lanzados por validaciones de servicio (si se implementan)
             return res.status(400).json({ message: error.message });
         }
        res.status(500).json({ message: 'Error interno al procesar la factura.' });
    }
};

/**
 * Eliminar una factura, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params; // ID de la factura
        const companyId = req.user?.companyId; // ID de la compañía

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller - ID de factura inválido para eliminar: ${id}`);
            return res.status(400).json({ message: 'ID de factura inválido.' });
        }

        console.log(`Controller - deleteInvoice: InvoiceID ${id}, CompanyId ${companyId}`);
        // Llamar al servicio con ID de factura y companyId
        await deleteInvoice(id, companyId);
        // El servicio lanza error si no se encuentra o no pertenece a la compañía

        res.status(204).end(); // Éxito, sin contenido

    } catch (error) {
        console.error('Controller - Error eliminando factura:', error.message);
        if (error.message === 'Factura no encontrada o no tiene permiso para eliminarla') {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'ID de factura inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno al eliminar la factura.' });
    }
};

/**
 * Actualizar el estado de una factura, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.updateInvoiceStatus = async (req, res) => {
    try {
        const { id } = req.params; // ID de la factura
        const { status } = req.body; // Nuevo estado
        const companyId = req.user?.companyId; // ID de la compañía

        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }
        if (!isValidObjectId(id)) {
            console.warn(`Controller - ID de factura inválido para actualizar estado: ${id}`);
            return res.status(400).json({ message: 'ID de factura inválido.' });
        }
        if (!status) {
             return res.status(400).json({ message: 'El nuevo estado es requerido.' });
        }

        // Validar que el estado sea uno de los permitidos por el modelo
        const allowedStatuses = Invoice.schema.path('status').enumValues;
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Estado no válido: ${status}. Permitidos: ${allowedStatuses.join(', ')}` });
        }

        console.log(`Controller - updateInvoiceStatus: InvoiceID ${id}, Status ${status}, CompanyId ${companyId}`);
        // Llamar al servicio con id, status y companyId
        const updatedInvoice = await updateInvoiceStatus(id, status, companyId);
        // El servicio maneja errores y población

        res.status(200).json(updatedInvoice);

    } catch (error) {
        console.error('Controller - Error actualizando estado de factura:', error.message);
         if (error.message === 'Factura no encontrada o no tiene permiso para actualizarla') {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'ID de factura inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ message: error.message });
        }
         if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Error de validación: ${error.message}` });
        }
        res.status(500).json({ message: 'Error interno al actualizar el estado de la factura.' });
    }
};

/**
 * Obtener datos para el dashboard, filtrados por compañía.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
exports.getDashboardData = async (req, res) => {
    try {
        // Obtener y validar companyId
        const companyId = req.user?.companyId;
        if (!companyId || !isValidObjectId(companyId)) {
            console.error('Controller - Error: companyId inválido o no encontrado en req.user');
            return res.status(500).json({ message: 'Error interno: Información de compañía inválida o faltante.' });
        }

        console.log(`Controller - getDashboardData para CompanyId: ${companyId}`);
        // Filtrar facturas por companyId
        const invoices = await Invoice.find({ companyId: companyId }).populate('client'); // Poblar cliente si es necesario para el dashboard

        // --- Procesamiento de datos (igual que antes, pero ahora solo con facturas de la compañía) ---
        const facturacionDiaria = [];
        const facturasPorDia = {};
        const mesesAbr = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        invoices.forEach(invoice => {
            // Asegurarse que invoice.date es un objeto Date válido
            if (!(invoice.date instanceof Date) || isNaN(invoice.date.getTime())) {
                console.warn(`Factura ID ${invoice._id} tiene fecha inválida: ${invoice.date}`);
                return; // Saltar esta factura
            }

            const fecha = invoice.date;
            const dia = fecha.getDate();
            const mes = fecha.getMonth();
            const key = `${dia} ${mesesAbr[mes]}`;

            if (!facturasPorDia[key]) {
                facturasPorDia[key] = { name: key, USD: 0, VES: 0, totalGeneral: 0, facturas: 0 }; // Usar totalGeneral para evitar confusión con campo 'total'
            }

            facturasPorDia[key].facturas += 1;

            // Sumar montos según la moneda
            const totalFactura = invoice.total || 0; // Usar 0 si total es undefined/null
            if (invoice.moneda === 'USD') {
                facturasPorDia[key].USD += totalFactura;
                // Asumir que totalGeneral es en USD o moneda base
                facturasPorDia[key].totalGeneral += totalFactura;
            } else if (invoice.moneda === 'VES') {
                facturasPorDia[key].VES += totalFactura;
                // Aquí necesitarías convertir VES a la moneda base (ej. USD) si quieres un totalGeneral consistente
                // Ejemplo: facturasPorDia[key].totalGeneral += totalFactura / tasaDeCambio;
                // Por ahora, sumamos VES al totalGeneral para simplicidad, pero esto mezcla monedas.
                 facturasPorDia[key].totalGeneral += totalFactura; // ¡OJO: Mezcla monedas!
            } else {
                 // Manejar otras monedas si existen
                 facturasPorDia[key].totalGeneral += totalFactura; // Asumir moneda base o convertir
            }
        });

        // Convertir a array
        Object.values(facturasPorDia).forEach(data => {
            facturacionDiaria.push(data);
        });
        // --- Fin Procesamiento ---

        res.status(200).json({
            facturacionDiaria // Puedes añadir más datos al dashboard aquí
        });
    } catch (error) {
        console.error('Controller - Error obteniendo datos de dashboard:', error.message);
        res.status(500).json({ message: 'Error interno al obtener datos del dashboard.' });
    }
};
