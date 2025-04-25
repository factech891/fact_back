// services/client.service.js
const mongoose = require('mongoose');
const Client = require('../models/client.model'); // Asegúrate que la ruta sea correcta

/**
 * Crear un nuevo cliente asociado a una compañía específica.
 * @param {Object} clientData - Datos del cliente.
 * @param {string} companyId - ID de la compañía del usuario autenticado.
 * @returns {Promise<Object>} Cliente creado.
 */
const createClient = async (clientData, companyId) => {
  try {
    console.log('Servicio - Datos recibidos para crear cliente:', clientData, 'CompanyId:', companyId);

    // Asignar el companyId al cliente usando el nombre correcto del campo: 'companyId'
    clientData.companyId = companyId; // <-- CORRECCIÓN: Usar companyId

    // Validar el RIF si se proporciona (lógica existente)
    if (clientData.rif && !clientData.rif.includes('-') && clientData.rif.length > 1) {
      const tipoRif = clientData.rif.charAt(0);
      const numeroRif = clientData.rif.substring(1);
      clientData.rif = `${tipoRif}-${numeroRif}`;
    }

    // Validar condiciones de pago y días de crédito (lógica existente)
    if (clientData.condicionesPago === 'contado') {
      clientData.diasCredito = 0;
    } else if (clientData.condicionesPago === 'credito15' && !clientData.diasCredito) {
      clientData.diasCredito = 15;
    } else if (clientData.condicionesPago === 'credito30' && !clientData.diasCredito) {
      clientData.diasCredito = 30;
    } else if (clientData.condicionesPago === 'credito60' && !clientData.diasCredito) {
      clientData.diasCredito = 60;
    }

    const newClient = new Client(clientData);
    const savedClient = await newClient.save();
    console.log('Servicio - Cliente guardado exitosamente:', savedClient._id, 'para CompanyId:', companyId);
    return savedClient;
  } catch (error) {
    console.error('Servicio - Error al crear el cliente:', error);
    throw new Error(`Error al crear el cliente: ${error.message}`);
  }
};

/**
 * Obtener todos los clientes de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Array>} Lista de clientes de esa compañía.
 */
const getAllClients = async (companyId) => {
  try {
    console.log('Servicio - Obteniendo todos los clientes para CompanyId:', companyId);
    // Filtrar por companyId usando el nombre correcto del campo: 'companyId'
    return await Client.find({ companyId: companyId }).sort({ createdAt: -1 }); // <-- CORRECCIÓN: Usar companyId
  } catch (error) {
    console.error('Servicio - Error al obtener los clientes:', error);
    throw new Error(`Error al obtener los clientes: ${error.message}`);
  }
};

/**
 * Obtener un cliente por ID, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del cliente.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Cliente encontrado.
 */
const getClientById = async (id, companyId) => {
  try {
    console.log('Servicio - Obteniendo cliente por ID:', id, 'para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Servicio - ID de cliente inválido:', id);
      throw new Error('ID de cliente inválido');
    }
     if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar por ID y companyId usando el nombre correcto del campo: 'companyId'
    const client = await Client.findOne({ _id: id, companyId: companyId }); // <-- CORRECCIÓN: Usar companyId

    if (!client) {
       console.log('Servicio - Cliente no encontrado con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Cliente no encontrado');
    }
    console.log('Servicio - Cliente encontrado:', client._id);
    return client;
  } catch (error) {
    if (error.message !== 'Cliente no encontrado' && error.message !== 'ID de cliente inválido') {
        console.error('Servicio - Error al obtener el cliente:', error);
    }
    throw error;
  }
};

/**
 * Actualizar un cliente, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del cliente.
 * @param {Object} updatedData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Cliente actualizado.
 */
const updateClient = async (id, updatedData, companyId) => {
  try {
    console.log('Servicio - Datos recibidos para actualizar cliente:', id, 'Data:', updatedData, 'CompanyId:', companyId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
       console.warn('Servicio - ID de cliente inválido para actualizar:', id);
      throw new Error('ID de cliente inválido');
    }
     if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para actualizar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Asegurarse de no cambiar el companyId durante la actualización
    delete updatedData.companyId; // <-- CORRECCIÓN: Usar companyId
    delete updatedData.company; // Eliminar también por si acaso

     // Validar el RIF si se proporciona (lógica existente)
    if (updatedData.rif && !updatedData.rif.includes('-') && updatedData.rif.length > 1) {
      const tipoRif = updatedData.rif.charAt(0);
      const numeroRif = updatedData.rif.substring(1);
      updatedData.rif = `${tipoRif}-${numeroRif}`;
    }

    // Validar condiciones de pago y días de crédito (lógica existente)
    if (updatedData.condicionesPago === 'contado') {
      updatedData.diasCredito = 0;
    }

    // Buscar y actualizar solo si el _id y companyId coinciden, usando el nombre correcto del campo: 'companyId'
    const updatedClient = await Client.findOneAndUpdate(
      { _id: id, companyId: companyId }, // <-- CORRECCIÓN: Usar companyId
      updatedData,
      { new: true, runValidators: true }
    );

    if (!updatedClient) {
      console.log('Servicio - Cliente no encontrado para actualizar con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Cliente no encontrado o no tiene permiso para actualizarlo');
    }

    console.log('Servicio - Cliente actualizado exitosamente:', updatedClient._id);
    return updatedClient;
  } catch (error) {
     if (error.message !== 'Cliente no encontrado o no tiene permiso para actualizarlo' && error.message !== 'ID de cliente inválido') {
        console.error('Servicio - Error al actualizar el cliente:', error);
    }
    // Relanzar con un mensaje más genérico o el mismo, dependiendo de la política de errores
    throw new Error(`Error al actualizar el cliente: ${error.message}`);
  }
};

/**
 * Eliminar un cliente, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del cliente.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Cliente eliminado.
 */
const deleteClient = async (id, companyId) => {
  try {
    console.log('Servicio - Intentando eliminar cliente con ID:', id, 'para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Servicio - ID de cliente inválido para eliminar:', id);
      throw new Error('ID de cliente inválido');
    }
     if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para eliminar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar y eliminar solo si el _id y companyId coinciden, usando el nombre correcto del campo: 'companyId'
    const deletedClient = await Client.findOneAndDelete({ _id: id, companyId: companyId }); // <-- CORRECCIÓN: Usar companyId

    if (!deletedClient) {
       console.log('Servicio - Cliente no encontrado para eliminar con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Cliente no encontrado o no tiene permiso para eliminarlo');
    }

    console.log('Servicio - Cliente eliminado exitosamente:', id);
    return deletedClient;
  } catch (error) {
     if (error.message !== 'Cliente no encontrado o no tiene permiso para eliminarlo' && error.message !== 'ID de cliente inválido') {
        console.error('Servicio - Error al eliminar el cliente:', error);
     }
    throw new Error(`Error al eliminar el cliente: ${error.message}`);
  }
};

/**
 * Buscar clientes por nombre, RIF o email dentro de una compañía específica.
 * @param {string} query - Texto a buscar.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Array>} Lista de clientes que coinciden.
 */
const searchClients = async (query, companyId) => {
  try {
    console.log('Servicio - Buscando clientes con query:', query, 'para CompanyId:', companyId);
     if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para buscar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Si no hay query, devolver todos los clientes de esa compañía
    if (!query || query.trim() === '') {
      // Reutiliza la función getAllClients que ya usa companyId correctamente
      return await getAllClients(companyId);
    }

    const regex = new RegExp(query, 'i');

    // Buscar dentro de la compañía específica usando el nombre correcto del campo: 'companyId'
    return await Client.find({
      companyId: companyId, // <-- CORRECCIÓN: Usar companyId
      $or: [
        { nombre: regex },
        { rif: regex },
        { email: regex }
      ]
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Servicio - Error al buscar clientes:', error);
    throw new Error(`Error al buscar clientes: ${error.message}`);
  }
};

module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients
};