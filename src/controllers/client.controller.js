// controllers/client.controller.js
const mongoose = require('mongoose');
const {
  getAllClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  searchClients // Asegúrate que searchClients esté exportado desde el servicio
} = require('../services/client.service');

/**
 * Validar ObjectId
 * @param {string} id - ID a validar
 * @returns {boolean} Es válido o no
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todos los clientes de la compañía o buscar dentro de ella.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const getClients = async (req, res) => {
  try {
    // Obtener companyId del usuario autenticado (inyectado por el middleware)
    const companyId = req.user?.companyId;
    if (!companyId) {
        console.error('Controller - Error: companyId no encontrado en req.user');
        return res.status(500).json({ error: 'Error interno: Falta información de la compañía.' });
    }
     if (!isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido en req.user:', companyId);
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }


    const searchQuery = req.query.search;
    console.log(`Controller - getClients para CompanyId: ${companyId}, SearchQuery: ${searchQuery || 'N/A'}`);

    let clients;
    if (searchQuery) {
      // Pasar companyId a searchClients
      clients = await searchClients(searchQuery, companyId);
    } else {
      // Pasar companyId a getAllClients
      clients = await getAllClients(companyId);
    }

    res.status(200).json(clients);
  } catch (error) {
    console.error('Controller - Error al obtener clientes:', error.message);
    // Devolver 500 para errores inesperados del servicio
    res.status(500).json({ error: 'Error al obtener la lista de clientes.' });
  }
};

/**
 * Crear un nuevo cliente para la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const createClientController = async (req, res) => {
  try {
    // Obtener companyId del usuario autenticado
    const companyId = req.user?.companyId;
     if (!companyId) {
        console.error('Controller - Error: companyId no encontrado en req.user para crear cliente.');
        return res.status(500).json({ error: 'Error interno: Falta información de la compañía.' });
    }
     if (!isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido en req.user para crear cliente:', companyId);
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    const clientData = req.body;
    console.log(`Controller - Datos recibidos para crear cliente para CompanyId ${companyId}:`, clientData);

    // Validación básica de campos requeridos (se mantiene)
    if (!clientData.nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!clientData.email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }
    if (!clientData.rif) {
      return res.status(400).json({ error: 'El RIF/Cédula es requerido' });
    }

    // Llamar al servicio createClient pasando clientData y companyId
    const newClient = await createClient(clientData, companyId);
    res.status(201).json(newClient);

  } catch (error) {
    console.error('Controller - Error al crear cliente:', error.message);

    // Manejar errores específicos (se mantiene, pero el servicio puede lanzar otros)
    if (error.message.includes('duplicate key')) {
      // Estos errores vienen directamente de Mongoose/MongoDB si hay índices únicos
      if (error.message.includes('email_1')) { // Asumiendo índice único en email+company
        return res.status(400).json({ error: 'Este email ya está registrado para esta compañía' });
      }
      if (error.message.includes('rif_1')) { // Asumiendo índice único en rif+company
        return res.status(400).json({ error: 'Este RIF/Cédula ya está registrado para esta compañía' });
      }
      return res.status(400).json({ error: 'Ya existe un registro con estos datos' });
    }

     // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      // Extraer mensajes de error de validación
      const errors = Object.values(error.errors).map(el => el.message);
      return res.status(400).json({ error: `Error de validación: ${errors.join(', ')}` });
    }

    // Error genérico del servicio o BD
    res.status(500).json({ error: 'Error al crear el cliente.' });
  }
};

/**
 * Obtener un cliente por ID, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const getClientByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

     if (!companyId) {
        console.error('Controller - Error: companyId no encontrado en req.user para obtener cliente por ID.');
        return res.status(500).json({ error: 'Error interno: Falta información de la compañía.' });
    }
     if (!isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido en req.user para obtener cliente por ID:', companyId);
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    console.log(`Controller - getClientById: ClientID ${id}, CompanyId ${companyId}`);

    if (!isValidObjectId(id)) {
      console.warn(`Controller - ID de cliente inválido: ${id}`);
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    // Llamar al servicio pasando el ID del cliente y el companyId
    const client = await getClientById(id, companyId);

    // El servicio ahora lanza error si no lo encuentra o no pertenece a la company
    // Ya no es necesario el chequeo if (!client) aquí si el servicio maneja el error.
    // Sin embargo, por claridad, podemos mantenerlo o confiar en el catch.
    // Confiemos en el catch para manejar el error lanzado por el servicio.

    res.status(200).json(client);

  } catch (error) {
    console.error('Controller - Error al obtener cliente por ID:', error.message);
    // Mapear errores específicos del servicio a respuestas HTTP
    if (error.message === 'Cliente no encontrado') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (error.message === 'ID de cliente inválido' || error.message === 'ID de compañía inválido') {
        return res.status(400).json({ error: error.message }); // Podría ser 400 o 500 dependiendo del contexto
    }
    // Error genérico
    res.status(500).json({ error: 'Error al obtener el cliente.' });
  }
};

/**
 * Actualizar un cliente, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const updateClientController = async (req, res) => {
  try {
    const { id } = req.params; // ID del cliente a actualizar
    const clientData = req.body; // Datos para actualizar
    const companyId = req.user?.companyId; // ID de la compañía del usuario

     if (!companyId) {
        console.error('Controller - Error: companyId no encontrado en req.user para actualizar cliente.');
        return res.status(500).json({ error: 'Error interno: Falta información de la compañía.' });
    }
     if (!isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido en req.user para actualizar cliente:', companyId);
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    console.log(`Controller - Datos recibidos para actualizar cliente ${id} para CompanyId ${companyId}:`, clientData);

    if (!isValidObjectId(id)) {
      console.warn(`Controller - ID de cliente inválido para actualizar: ${id}`);
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    // Validaciones básicas (se mantienen)
    if (!clientData.nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!clientData.email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }
    if (!clientData.rif) {
      return res.status(400).json({ error: 'El RIF/Cédula es requerido' });
    }

    // Llamar al servicio updateClient pasando id, datos y companyId
    const updatedClient = await updateClient(id, clientData, companyId);

    // El servicio lanza error si no lo encuentra o no pertenece a la company.
    // No es necesario el chequeo if (!updatedClient) aquí.

    res.status(200).json(updatedClient);

  } catch (error) {
    console.error('Controller - Error al actualizar cliente:', error.message);

    // Manejar errores específicos (duplicados, validación, no encontrado)
    if (error.message.includes('duplicate key')) {
       if (error.message.includes('email_1')) {
        return res.status(400).json({ error: 'Este email ya está registrado para otro cliente de esta compañía' });
      }
      if (error.message.includes('rif_1')) {
        return res.status(400).json({ error: 'Este RIF/Cédula ya está registrado para otro cliente de esta compañía' });
      }
      return res.status(400).json({ error: 'Ya existe un registro con estos datos' });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(el => el.message);
      return res.status(400).json({ error: `Error de validación: ${errors.join(', ')}` });
    }
     if (error.message.startsWith('Cliente no encontrado') || error.message.startsWith('ID de cliente inválido')) {
        // El servicio ya lanza un error específico si no lo encuentra *para esa compañía*
        return res.status(404).json({ error: 'Cliente no encontrado o no tiene permiso para actualizarlo' });
    }
     if (error.message === 'ID de compañía inválido') {
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    // Error genérico
    res.status(500).json({ error: 'Error al actualizar el cliente.' });
  }
};

/**
 * Eliminar un cliente, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const deleteClientController = async (req, res) => {
  try {
    const { id } = req.params; // ID del cliente a eliminar
    const companyId = req.user?.companyId; // ID de la compañía del usuario

     if (!companyId) {
        console.error('Controller - Error: companyId no encontrado en req.user para eliminar cliente.');
        return res.status(500).json({ error: 'Error interno: Falta información de la compañía.' });
    }
     if (!isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido en req.user para eliminar cliente:', companyId);
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    console.log(`Controller - ID recibido para eliminar cliente: ${id} para CompanyId ${companyId}`);

    if (!isValidObjectId(id)) {
      console.warn(`Controller - ID de cliente inválido para eliminar: ${id}`);
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    // Llamar al servicio deleteClient pasando id y companyId
    await deleteClient(id, companyId);

    // El servicio lanza error si no lo encuentra o no pertenece a la company.
    // No es necesario el chequeo if (!deletedClient) aquí.

    res.status(204).end(); // Éxito, sin contenido

  } catch (error) {
    console.error('Controller - Error al eliminar cliente:', error.message);

    // Mapear errores específicos del servicio a respuestas HTTP
    if (error.message.startsWith('Cliente no encontrado') || error.message.startsWith('ID de cliente inválido')) {
        // El servicio ya lanza un error específico si no lo encuentra *para esa compañía*
        return res.status(404).json({ error: 'Cliente no encontrado o no tiene permiso para eliminarlo' });
    }
     if (error.message === 'ID de compañía inválido') {
        return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
    }

    // Error genérico
    res.status(500).json({ error: 'Error al eliminar el cliente.' });
  }
};

module.exports = {
  getClients,
  createClientController,
  getClientByIdController,
  updateClientController,
  deleteClientController
  // Asegúrate de que las rutas usen estos nombres de controlador actualizados si cambiaste alguno
};
