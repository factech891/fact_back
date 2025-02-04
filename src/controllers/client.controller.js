// client.controller.js
let clients = [
    {
        id: 1,
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        rif: 'V-12345678',
        direccion: 'Caracas, Venezuela',
        telefono: '0412-1234567'
    }
 ];
 
 const getCLients = async (req, res) => res.json(clients);
 
 const createClient = async (req, res) => {
    const { nombre, email, rif, direccion, telefono } = req.body;
    const newClient = {
        id: clients.length + 1,
        nombre,
        email,
        rif,
        direccion,
        telefono
    };
    clients.push(newClient);
    //createClient(newClient);
    res.json(newClient);
 };
 
 const updateClient = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, rif, direccion, telefono } = req.body;
    const index = clients.findIndex(client => client.id === parseInt(id));
 
    if (index !== -1) {
        clients[index] = {
            id: parseInt(id),
            nombre,
            email,
            rif,
            direccion,
            telefono
        };
        res.json(clients[index]);
    } else {
        res.status(404).json({ message: 'Client not found' });
    }
 };
 
 const deleteClient = async (req, res) => {
    clients = clients.filter(client => client.id !== parseInt(req.params.id));
    res.status(204).end();
 };
 
 module.exports = {
    getCLients,
    createClient,
    updateClient,
    deleteClient
 };