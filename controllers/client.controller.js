let clients = [
    { id: 1, name: 'Juan Pérez', email: 'juan@example.com' },
    { id: 2, name: 'María López', email: 'maria@example.com' },
];


const getCLients = async (req, res) => res.json(clients);


const createClient = async (req, res) => {
    const nuevoCliente = {
        id: clients.length + 1,
        name: req.body.name,
        email: req.body.email,
    };
    clients.push(nuevoCliente);
    res.json(nuevoCliente);
};

module.exports = {
    getCLients,
    createClient
}