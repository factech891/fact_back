// models/subscription.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true
    },
    plan: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free'
    },
    status: {
        type: String,
        enum: ['trial', 'active', 'expired', 'cancelled'],
        default: 'trial'
    },
    features: {
        maxUsers: {
            type: Number,
            default: 3
        },
        maxClients: {
            type: Number,
            default: 50
        },
        maxProducts: {
            type: Number,
            default: 50
        },
        maxInvoicesPerMonth: {
            type: Number,
            default: 30
        },
        advancedReports: {
            type: Boolean,
            default: false
        },
        customBranding: {
            type: Boolean,
            default: false
        },
        supportIncluded: {
            type: Boolean,
            default: false
        }
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: false
    },
    paymentHistory: [{
        amount: Number,
        currency: {
            type: String,
            default: 'USD'
        },
        paymentMethod: String,
        paymentDate: Date,
        paymentId: String,
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded']
        }
    }],
    billingInfo: {
        name: String,
        address: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        taxId: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);