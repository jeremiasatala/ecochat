const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Modelo de usuario que creamos

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect('mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

// --- Rutas de autenticación ---

const JWT_SECRET = 'TU_SECRET_SUPER_SEGURA!123'; // Cambia esto por algo seguro

// Registro de usuario
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = new User({ email, password });
    await user.save();

    res.json({ message: 'Usuario creado correctamente' });
  } catch (err) {
    res.status(400).json({ error: 'Email ya registrado o datos inválidos' });
  }
});

// Login de usuario
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const isValid = await user.comparePassword(password);
  if (!isValid) return res.status(400).json({ error: 'Contraseña incorrecta' });

  // Crear token JWT
  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

  res.json({ message: 'Login correcto', token });
});

// Middleware para autenticar con token
const autenticar = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// --- Chat en tiempo real ---
const mensajeSchema = new mongoose.Schema({
  usuario: String,
  texto: String,
  fecha: { type: Date, default: Date.now }
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

io.on('connection', (socket) => {
  console.log('Usuario conectado');

  Mensaje.find().sort({ fecha: 1 }).limit(100).then(mensajes => {
    socket.emit('cargar-mensajes', mensajes);
  });

  socket.on('nuevo-mensaje', async (data) => {
    const { usuario, texto, token } = data;

    if (!token) return;

    try {
      const decoded = jwt.verify(token.split(' ')[1] || token, JWT_SECRET); // Validar token
      const mensaje = new Mensaje({
        usuario,
        texto
      });
      await mensaje.save();
      io.emit('nuevo-mensaje', mensaje);
    } catch (err) {
      console.log('Token inválido, mensaje rechazado');
    }
  });

}); // <- Cierre de io.on('connection')

// Servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
