// services/client.service.js  
const mongoose = require('mongoose');  
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
    if (!mongoose.Types.ObjectId.isValid(id)) {  
      throw new Error('ID inválido');  
    }  
    
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
    if (!mongoose.Types.ObjectId.isValid(id)) {  
      throw new Error('ID inválido');  
    }  
    
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
    if (!mongoose.Types.ObjectId.isValid(id)) {  
      throw new Error('ID inválido');  
    }  

    console.log('Intentando eliminar cliente con ID:', id); // Log para depurar  
    const deletedClient = await Client.findByIdAndDelete(id);  
    
    if (!deletedClient) {  
      throw new Error('Cliente no encontrado');  
    }  
    
    return deletedClient;  
  } catch (error) {  
    console.error('Error en el servicio al eliminar el cliente:', error.message); // Log para depurar  
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