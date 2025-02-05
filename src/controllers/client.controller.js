// controllers/client.controller.js  
const mongoose = require('mongoose'); // Importar mongoose  
const {  
  getAllClients,  
  createClient,  
  getClientById,  
  updateClient,  
  deleteClient,  
} = require('../services/client.service');  

// Función para validar ObjectId  
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);  

// Obtener todos los clientes  
const getClients = async (req, res) => {  
  try {  
    const clients = await getAllClients();  
    res.status(200).json(clients); // Establecer status 200 explícitamente  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  

// Crear un nuevo cliente  
const createClientController = async (req, res) => {  
  try {  
    const { nombre, email, rif, direccion, telefono } = req.body;  

    if (!nombre || !email) {  
      return res.status(400).json({ error: 'Nombre y email son requeridos.' });  
    }  

    const newClient = await createClient({ nombre, email, rif, direccion, telefono });  
    res.status(201).json(newClient);  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  

// Obtener un cliente por ID  
const getClientByIdController = async (req, res) => {  
  try {  
    const { id } = req.params;  

    if (!isValidObjectId(id)) {  
      return res.status(400).json({ error: 'ID inválido.' });  
    }  

    const client = await getClientById(id);  
    if (!client) {  
      return res.status(404).json({ error: 'Cliente no encontrado.' });  
    }  

    res.status(200).json(client);  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  

// Actualizar un cliente  
const updateClientController = async (req, res) => {  
  try {  
    const { id } = req.params;  

    if (!isValidObjectId(id)) {  
      return res.status(400).json({ error: 'ID inválido.' });  
    }  

    const { nombre, email, rif, direccion, telefono } = req.body;  

    // Validación básica  
    if (!nombre || !email) {  
      return res.status(400).json({ error: 'Nombre y email son requeridos.' });  
    }  

    const updatedClient = await updateClient(id, { nombre, email, rif, direccion, telefono });  
    
    if (!updatedClient) {  
      return res.status(404).json({ error: 'Cliente no encontrado.' });  
    }  

    res.status(200).json(updatedClient);  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  

// Eliminar un cliente  
const deleteClientController = async (req, res) => {  
  try {  
    const { id } = req.params; // Extraer el ID de los parámetros de la URL  

    console.log('ID recibido en el backend:', id); // Agregar este log para depuración  

    if (!isValidObjectId(id)) {  
      return res.status(400).json({ error: 'ID inválido' });  
    }  

    const deletedClient = await deleteClient(id);  
    
    if (!deletedClient) {  
      return res.status(404).json({ error: 'Cliente no encontrado.' });  
    }  

    res.status(204).end(); // Respuesta sin contenido para eliminación exitosa  
  } catch (error) {  
    console.error('Error al eliminar el cliente:', error.message); // Log para depuración  
    res.status(500).json({ error: 'Error interno del servidor' });  
  }  
};  

module.exports = {  
  getClients,  
  createClientController,  
  getClientByIdController,  
  updateClientController,  
  deleteClientController,  
};
