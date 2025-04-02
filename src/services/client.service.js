// services/client.service.js
const mongoose = require('mongoose');
const Client = require('../models/client.model');

/**
 * Crear un nuevo cliente con todos los campos extendidos
 * @param {Object} clientData - Datos del cliente
 * @returns {Promise<Object>} Cliente creado
 */
const createClient = async (clientData) => {
  try {
    console.log('Servicio - Datos recibidos para crear cliente:', clientData);
    
    // Validar el RIF si se proporciona
    if (clientData.rif && !clientData.rif.includes('-') && clientData.rif.length > 1) {
      // Intentar corregir formato automáticamente (ej. V12345678 -> V-12345678)
      const tipoRif = clientData.rif.charAt(0);
      const numeroRif = clientData.rif.substring(1);
      clientData.rif = `${tipoRif}-${numeroRif}`;
    }

    // Validar condiciones de pago y días de crédito
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
    console.log('Servicio - Cliente guardado exitosamente:', savedClient._id);
    return savedClient;
  } catch (error) {
    console.error('Servicio - Error al crear el cliente:', error);
    throw new Error(`Error al crear el cliente: ${error.message}`);
  }
};

/**
 * Obtener todos los clientes
 * @returns {Promise<Array>} Lista de clientes
 */
const getAllClients = async () => {
  try {
    return await Client.find().sort({ createdAt: -1 }); // Ordenar por fecha de creación, más recientes primero
  } catch (error) {
    console.error('Servicio - Error al obtener los clientes:', error);
    throw new Error(`Error al obtener los clientes: ${error.message}`);
  }
};

/**
 * Obtener un cliente por ID
 * @param {string} id - ID del cliente
 * @returns {Promise<Object>} Cliente encontrado
 */
const getClientById = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID inválido');
    }
    
    const client = await Client.findById(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    return client;
  } catch (error) {
    console.error('Servicio - Error al obtener el cliente:', error);
    throw new Error(`Error al obtener el cliente: ${error.message}`);
  }
};

/**
 * Actualizar un cliente
 * @param {string} id - ID del cliente
 * @param {Object} updatedData - Datos actualizados
 * @returns {Promise<Object>} Cliente actualizado
 */
const updateClient = async (id, updatedData) => {
  try {
    console.log('Servicio - Datos recibidos para actualizar cliente:', updatedData);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID inválido');
    }
    
    // Validar el RIF si se proporciona
    if (updatedData.rif && !updatedData.rif.includes('-') && updatedData.rif.length > 1) {
      // Intentar corregir formato automáticamente (ej. V12345678 -> V-12345678)
      const tipoRif = updatedData.rif.charAt(0);
      const numeroRif = updatedData.rif.substring(1);
      updatedData.rif = `${tipoRif}-${numeroRif}`;
    }

    // Validar condiciones de pago y días de crédito
    if (updatedData.condicionesPago === 'contado') {
      updatedData.diasCredito = 0;
    }

    const updatedClient = await Client.findByIdAndUpdate(
      id, 
      updatedData, 
      { new: true, runValidators: true }
    );
    
    if (!updatedClient) {
      throw new Error('Cliente no encontrado');
    }
    
    console.log('Servicio - Cliente actualizado exitosamente:', updatedClient._id);
    return updatedClient;
  } catch (error) {
    console.error('Servicio - Error al actualizar el cliente:', error);
    throw new Error(`Error al actualizar el cliente: ${error.message}`);
  }
};

/**
 * Eliminar un cliente
 * @param {string} id - ID del cliente
 * @returns {Promise<Object>} Cliente eliminado
 */
const deleteClient = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID inválido');
    }

    console.log('Servicio - Intentando eliminar cliente con ID:', id);
    const deletedClient = await Client.findByIdAndDelete(id);
    
    if (!deletedClient) {
      throw new Error('Cliente no encontrado');
    }
    
    console.log('Servicio - Cliente eliminado exitosamente:', id);
    return deletedClient;
  } catch (error) {
    console.error('Servicio - Error al eliminar el cliente:', error.message);
    throw new Error(`Error al eliminar el cliente: ${error.message}`);
  }
};

/**
 * Buscar clientes por nombre, RIF o email
 * @param {string} query - Texto a buscar
 * @returns {Promise<Array>} Lista de clientes que coinciden
 */
const searchClients = async (query) => {
  try {
    if (!query || query.trim() === '') {
      return await getAllClients();
    }
    
    const regex = new RegExp(query, 'i'); // 'i' para hacer la búsqueda insensible a mayúsculas/minúsculas
    
    return await Client.find({
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