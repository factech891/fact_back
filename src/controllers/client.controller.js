// controllers/client.controller.js
const {
    getAllClients,
    createClient,
    getClientById,
    updateClient,
    deleteClient,
  } = require('../services/client.service');
  
  // Obtener todos los clientes
  const getClients = async (req, res) => {
    try {
      const clients = await getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // Crear un nuevo cliente
  const createClientController = async (req, res) => {
    try {
      const { nombre, email, rif, direccion, telefono } = req.body;
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
      const client = await getClientById(id);
      res.json(client);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };
  
  // Actualizar un cliente
  const updateClientController = async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, email, rif, direccion, telefono } = req.body;
      const updatedClient = await updateClient(id, { nombre, email, rif, direccion, telefono });
      res.json(updatedClient);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };
  
  // Eliminar un cliente
const deleteClientController = async (req, res) => {
    try {
      const { id } = req.params;
      const deletedClient = await deleteClient(id);
  
      if (!deletedClient) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
  
      res.status(204).end(); // Respuesta sin contenido para eliminación exitosa
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  module.exports = {
    getClients,
    createClientController,
    getClientByIdController,
    updateClientController,
    deleteClientController,
  };