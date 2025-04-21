// backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const operadorRoutes = require('./routes/operador');

app.use(cors());
app.use(express.json());
app.use('/api/operador', operadorRoutes);

app.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});
