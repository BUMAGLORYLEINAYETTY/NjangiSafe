const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const njangiRoutes = require('./src/routes/njangiRoutes');

const app = express();
app.use(express.json());

app.use('/api/njangi', njangiRoutes);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("NjangiSafe DB Connected (Simulation Mode)");
        app.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));
    })
    .catch(err => console.error("Erreur DB:", err));