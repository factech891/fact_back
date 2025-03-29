const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentSchema = new Schema({
  // Document information
  type: {
    type: String,
    enum: ['QUOTE', 'PROFORMA', 'ORDER', 'DELIVERY_NOTE', 'CREDIT_NOTE', 'RECEIPT', 'OTHER'],
    required: true
  },
  documentNumber: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
    default: 'DRAFT'
  },
  
  // Client information
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  
  // Line items
  items: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    }
  }],
  
  // Totals
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  taxAmount: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    trim: true
  },
  
  // Extra information
  notes: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    trim: true
  },
  
  // Invoice reference (if converted)
  convertedToInvoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  
  // Company information
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company'
  },
  
  // Tracking
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-generate document number based on type
DocumentSchema.pre('save', async function(next) {
  try {
    // Only generate number if it's not set already
    if (!this.documentNumber) {
      const typePrefix = getTypePrefix(this.type);
      const currentYear = new Date().getFullYear().toString();
      
      // Find last document of this type for the current year
      const lastDocument = await this.constructor.findOne({
        type: this.type,
        documentNumber: { $regex: `^${typePrefix}${currentYear}` }
      }).sort({ documentNumber: -1 });
      
      let newNumber = 1;
      if (lastDocument && lastDocument.documentNumber) {
        // Extract the number part and increment
        const lastNumber = parseInt(lastDocument.documentNumber.replace(`${typePrefix}${currentYear}`, ''));
        if (!isNaN(lastNumber)) {
          newNumber = lastNumber + 1;
        }
      }
      
      // Format: PREFIX-YEAR-NUMBER (e.g., PRE-2023-0001)
      this.documentNumber = `${typePrefix}${currentYear}-${newNumber.toString().padStart(4, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Helper function to get prefix based on document type
function getTypePrefix(type) {
  switch(type) {
    case 'QUOTE': return 'PRE-';
    case 'PROFORMA': return 'PRO-';
    case 'ORDER': return 'ORD-';
    case 'DELIVERY_NOTE': return 'ALB-';
    case 'CREDIT_NOTE': return 'NCR-';
    case 'RECEIPT': return 'REC-';
    case 'OTHER': return 'DOC-';
    default: return 'DOC-';
  }
}

// Method to check if document is expired
DocumentSchema.methods.isExpired = function() {
  return this.expiryDate && new Date() > this.expiryDate;
};

// Method to convert to invoice data
DocumentSchema.methods.toInvoiceData = function() {
  return {
    client: this.client,
    items: this.items,
    subtotal: this.subtotal,
    taxAmount: this.taxAmount,
    total: this.total,
    currency: this.currency,
    notes: this.notes,
    terms: this.terms,
    relatedDocument: this._id
  };
};

const Document = mongoose.model('Document', DocumentSchema);

module.exports = Document;