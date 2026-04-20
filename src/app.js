const express = require('express');
const njangiRoutes = require('./routes/njangiRoutes');

const app = express();
app.use(express.json());

app.use('/api/njangi', njangiRoutes);

module.exports = app;