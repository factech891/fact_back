const Document = require('../models/document.model');
const Invoice = require('../models/invoice.model');
const mongoose = require('mongoose');

class DocumentService {
  // Get all documents
  async getDocuments(filter = {}) {
    return await Document.find(filter)
      .populate('client', 'name email taxId')
      .sort({ createdAt: -1 });
  }

  // Get document by ID
  async getDocumentById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    const document = await Document.findById(id)
      .populate('client')
      .populate('company');
      
    if (!document) {
      throw new Error('Document not found');
    }
    
    return document;
  }

  // Create new document
  async createDocument(documentData, userId) {
    try {
      const document = new Document({
        ...documentData,
        createdBy: userId,
        updatedBy: userId
      });
      
      // Save the document
      await document.save();
      
      return document;
    } catch (error) {
      throw new Error(`Error creating document: ${error.message}`);
    }
  }

  // Update existing document
  async updateDocument(id, documentData, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    // Check if document exists
    const document = await Document.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Check if document can be updated (not in CONVERTED status)
    if (document.status === 'CONVERTED') {
      throw new Error('Cannot update a document that has been converted to invoice');
    }
    
    // Update document
    const updatedDocument = await Document.findByIdAndUpdate(
      id,
      {
        ...documentData,
        updatedBy: userId
      },
      { new: true, runValidators: true }
    );
    
    return updatedDocument;
  }

  // Delete document
  async deleteDocument(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    // Check if document exists
    const document = await Document.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Check if document can be deleted (not in CONVERTED status)
    if (document.status === 'CONVERTED') {
      throw new Error('Cannot delete a document that has been converted to invoice');
    }
    
    // Delete document
    await Document.findByIdAndDelete(id);
    
    return { message: 'Document deleted successfully' };
  }

  // Get pending documents (for dashboard)
  async getPendingDocuments(limit = 5) {
    return await Document.find({
      status: { $in: ['DRAFT', 'SENT', 'APPROVED'] }
    })
    .populate('client', 'name email taxId')
    .sort({ createdAt: -1 })
    .limit(limit);
  }

  // Convert document to invoice
  async convertToInvoice(id, invoiceData, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    // Check if document exists
    const document = await Document.findById(id).populate('client');
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Check if document is already converted
    if (document.status === 'CONVERTED') {
      throw new Error('Document has already been converted to invoice');
    }
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Create invoice from document
      const documentData = document.toObject();
      
      // Create new invoice
      const invoice = new Invoice({
        client: documentData.client._id,
        items: documentData.items,
        subtotal: documentData.subtotal,
        taxAmount: documentData.taxAmount,
        total: documentData.total,
        currency: documentData.currency,
        notes: documentData.notes,
        terms: documentData.terms,
        relatedDocument: document._id,
        // Add any additional data from invoiceData
        date: invoiceData.invoiceDate || new Date(),
        series: invoiceData.series || null,
        createdBy: userId,
        updatedBy: userId
      });
      
      // Save the invoice
      await invoice.save({ session });
      
      // Update the document status to converted and link to invoice
      document.status = 'CONVERTED';
      document.convertedToInvoice = invoice._id;
      document.updatedBy = userId;
      await document.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return { document, invoice };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw new Error(`Error converting document to invoice: ${error.message}`);
    } finally {
      // End session
      session.endSession();
    }
  }

  // Update document status
  async updateDocumentStatus(id, status, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    // Check if document exists
    const document = await Document.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Check if document is already converted (can't change status)
    if (document.status === 'CONVERTED') {
      throw new Error('Cannot update status of a document that has been converted to invoice');
    }
    
    // Update document status
    document.status = status;
    document.updatedBy = userId;
    await document.save();
    
    return document;
  }

  // Check and update expired documents
  async checkExpiredDocuments() {
    const now = new Date();
    
    // Find documents with expiry date in the past that are not already marked as expired
    const expiredDocs = await Document.find({
      expiryDate: { $lt: now },
      status: { $nin: ['EXPIRED', 'CONVERTED'] }
    });
    
    // Update their status to EXPIRED
    for (const doc of expiredDocs) {
      doc.status = 'EXPIRED';
      await doc.save();
    }
    
    return { updatedCount: expiredDocs.length };
  }

  // Generate PDF for document
  async generateDocumentPDF(id) {
    // This would integrate with your PDF generation service
    // For now, we'll just return a placeholder
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    const document = await this.getDocumentById(id);
    
    // Here you would generate the actual PDF
    // For example, using PDFKit or another library
    
    return {
      message: 'PDF generation would happen here',
      document
    };
  }

  // Send document by email
  async sendDocumentByEmail(id, emailData) {
    // This would integrate with your email service
    // For now, we'll just return a placeholder
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID');
    }
    
    const document = await this.getDocumentById(id);
    
    // Here you would generate the PDF and send the email
    // For example, using Nodemailer
    
    // Update document status to SENT
    document.status = 'SENT';
    await document.save();
    
    return {
      message: 'Email sending would happen here',
      document,
      emailData
    };
  }
}

module.exports = new DocumentService();