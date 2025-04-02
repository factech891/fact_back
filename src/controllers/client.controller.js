// controllers/client.controller.js
const mongoose = require('mongoose');
const {
  getAllClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  searchClients
} = require('../services/client.service');

/**
 * Validar ObjectId
 * @param {string} id - ID a validar
 * @returns {boolean} Es válido o no
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todos los clientes
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 */
const getClients = async (req, res) => {
  try {
    // Si hay un parámetro de búsqueda, realizar búsqueda
    const searchQuery = req.query.search;
    
    let clients;
    if (searchQuery) {
      clients = await searchClients(searchQuery);
    } else {
      clients = await getAllClients();
    }
    
    res.status(200).json(clients);
  } catch (error) {
    console.error('Controller - Error al obtener clientes:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Crear un nuevo cliente
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 */
const createClientController = async (req, res) => {
  try {
    // Obtener todos los datos del cliente desde el cuerpo de la solicitud
    const clientData = req.body;
    console.log('Controller - Datos recibidos para crear cliente:', clientData);

    // Validación básica de campos requeridos
    if (!clientData.nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    
    if (!clientData.email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }
    
    if (!clientData.rif) {
      return res.status(400).json({ error: 'El RIF/Cédula es requerido' });
    }

    // Crear el cliente con todos los campos
    const newClient = await createClient(clientData);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Controller - Error al crear cliente:', error);
    
    // Manejar errores específicos
    if (error.message.includes('duplicate key')) {
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Este email ya está registrado' });
      }
      if (error.message.includes('rif')) {
        return res.status(400).json({ error: 'Este RIF/Cédula ya está registrado' });
      }
      return res.status(400).json({ error: 'Ya existe un registro con estos datos' });
    }
    
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener un cliente por ID
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 */
const getClientByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const client = await getClientById(id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error('Controller - Error al obtener cliente por ID:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Actualizar un cliente
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 */
const updateClientController = async (req, res) => {
  try {
    const { id } = req.params;
    const clientData = req.body;
    
    console.log('Controller - Datos recibidos para actualizar cliente:', clientData);

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Validaciones básicas
    if (!clientData.nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    
    if (!clientData.email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }
    
    if (!clientData.rif) {
      return res.status(400).json({ error: 'El RIF/Cédula es requerido' });
    }

    // Actualizar el cliente con todos los campos recibidos
    const updatedClient = await updateClient(id, clientData);
    
    if (!updatedClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(updatedClient);
  } catch (error) {
    console.error('Controller - Error al actualizar cliente:', error);
    
    // Manejar errores específicos
    if (error.message.includes('duplicate key')) {
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Este email ya está registrado' });
      }
      if (error.message.includes('rif')) {
        return res.status(400).json({ error: 'Este RIF/Cédula ya está registrado' });
      }
      return res.status(400).json({ error: 'Ya existe un registro con estos datos' });
    }
    
    res.status(500).json({ error: error.message });
  }
};

/**
 * Eliminar un cliente
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 */
const deleteClientController = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Controller - ID recibido para eliminar cliente:', id);

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const deletedClient = await deleteClient(id);
    
    if (!deletedClient) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(204).end(); // Respuesta sin contenido para eliminación exitosa
  } catch (error) {
    console.error('Controller - Error al eliminar cliente:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getClients,
  createClientController,
  getClientByIdController,
  updateClientController,
  deleteClientController
};