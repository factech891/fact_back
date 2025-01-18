let invoices = [
    { id: 1, client: 'Juan Pérez', total: 1000 },
    { id: 2, client: 'María López', total: 1500 },
];

const getInvoices = async (req, res) => res.json(invoices);

const createInvoices = async (req, res) => {
    const newInvoice = {
        id: invoices.length + 1,
        client: req.body.client,
        total: req.body.total,
    };
    invoices.push(newInvoice);
    res.json(newInvoice);
};

const updateInvocies = async (req, res) => {
    const { id } = req.params;
    const { client, total } = req.body;
    const index = invoices.findIndex(invoice => invoice.id === parseInt(id));

    if (index !== -1) {
        invoices[index] = { id: parseInt(id), client, total };
        res.json(invoices[index]);
    } else {
        res.status(404).json({ message: 'Invoice not found' });
    }
};

const deleteInvoices = async (req, res) => {
    invoices = invoices.filter(invoice => invoice.id !== parseInt(req.params.id));
    res.status(204).end();
};

module.exports = {
    getInvoices,
    createInvoices,
    updateInvocies,
    deleteInvoices,
};
