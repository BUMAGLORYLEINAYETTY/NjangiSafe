const mongoose = require('mongoose');

const NjangiSchema = new mongoose.Schema({
    groupName: { type: String, required: true },
    contributionAmount: { type: Number, required: true },
    currentWinnerIndex: { type: Number, default: 0 },
    members: [{
        userId: String,
        phone: String,
        hasPaid: { type: Boolean, default: false }
    }],
    escrowLedger: [{
        userId: String,
        amountHeld: { type: Number, default: 0 }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Njangi', NjangiSchema);