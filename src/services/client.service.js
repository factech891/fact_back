// services/client.service.js
const Client = require('../models/client.model');

// Crear un nuevo cliente
const createClient = async (clientData) => {
  try {
    const newClient = new Client(clientData);
    const savedClient = await newClient.save();
    return savedClient;
  } catch (error) {
    throw new Error(`Error al crear el cliente: ${error.message}`);
  }
};

// Obtener todos los clientes
const getAllClients = async () => {
  try {
    return await Client.find();
  } catch (error) {
    throw new Error(`Error al obtener los clientes: ${error.message}`);
  }
};

// Obtener un cliente por ID
const getClientById = async (id) => {
  try {
    const client = await Client.findById(id);
    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    return client;
  } catch (error) {
    throw new Error(`Error al obtener el cliente: ${error.message}`);
  }
};

// Actualizar un cliente
const updateClient = async (id, updatedData) => {
  try {
    const updatedClient = await Client.findByIdAndUpdate(id, updatedData, { new: true });
    if (!updatedClient) {
      throw new Error('Cliente no encontrado');
    }
    return updatedClient;
  } catch (error) {
    throw new Error(`Error al actualizar el cliente: ${error.message}`);
  }
};

// Eliminar un cliente
const deleteClient = async (id) => {
  try {
    const deletedClient = await Client.findByIdAndDelete(id);
    if (!deletedClient) {
      throw new Error('Cliente no encontrado');
    }
    return deletedClient;
  } catch (error) {
    throw new Error(`Error al eliminar el cliente: ${error.message}`);
  }
};

module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
};