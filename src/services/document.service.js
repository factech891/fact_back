// services/document.service.js
const Document = require('../models/document.model');

const getAllDocuments = async () => {
   return Document.find()
       .populate('client')
       .populate('items.product')
       .sort({ date: -1 });
};

const getDocumentById = async (id) => {
   return Document.findById(id)
       .populate('client')
       .populate('items.product');
};

const getPendingDocuments = async (limit = 5) => {
    return Document.find({ status: { $in: ['DRAFT', 'SENT'] } })
        .populate('client')
        .sort({ date: -1 })
        .limit(limit);
};

const createDocument = async (documentData) => {
   const document = new Document(documentData);
   return document.save();
};

const updateDocument = async (id, documentData) => {
   return Document.findByIdAndUpdate(id, documentData, {
       new: true,
       runValidators: true
   }).populate('client').populate('items.product');
};

const deleteDocument = async (id) => {
   return Document.findByIdAndDelete(id);
};

const getDocumentByNumber = async (documentNumber) => {
   return Document.findOne({ documentNumber });
};

const updateDocumentStatus = async (id, status) => {
   return Document.findByIdAndUpdate(
       id,
       { status },
       { new: true, runValidators: true }
   ).populate('client').populate('items.product');
};

const convertToInvoice = async (id, invoiceId) => {
    return Document.findByIdAndUpdate(
        id,
        { 
            status: 'CONVERTED', 
            convertedInvoice: invoiceId 
        },
        { new: true, runValidators: true }
    ).populate('client').populate('items.product');
};

module.exports = {
   getAllDocuments,
   getDocumentById,
   getPendingDocuments,
   createDocument,
   updateDocument,
   deleteDocument,
   getDocumentByNumber,
   updateDocumentStatus,
   convertToInvoice
};