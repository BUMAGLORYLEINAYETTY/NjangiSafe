const express = require('express');
const router = express.Router();
const njangiCtrl = require('../controllers/njangiController');
const Njangi = require('../models/Njangi');

// Créer une tontine
router.post('/create', async (req, res) => {
    try {
        const group = new Njangi(req.body);
        await group.save();
        res.status(201).json(group);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// Payer sa part
router.post('/pay', njangiCtrl.contribute);

// Voir l'état du coffre-fort (Escrow)
router.get('/:id/escrow', async (req, res) => {
    const group = await Njangi.findById(req.params.id);
    res.json(group.escrowLedger);
});

module.exports = router;