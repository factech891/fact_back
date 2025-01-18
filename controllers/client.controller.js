let clients = [
    { id: 1, name: 'Juan Pérez', email: 'juan@example.com' },
    { id: 2, name: 'María López', email: 'maria@example.com' },
];

const getCLients = async (req, res) => res.json(clients);

const createClient = async (req, res) => {
    const newClient = {
        id: clients.length + 1,
        name: req.body.name,
        email: req.body.email,
    };
    clients.push(newClient);
    res.json(newClient);
};

const updateClient = async (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    const index = clients.findIndex(client => client.id === parseInt(id));

    if (index !== -1) {
        clients[index] = { id: parseInt(id), name, email };
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
    deleteClient,
};
