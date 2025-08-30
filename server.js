const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('./models/user'); // en minúscula

// Configuración de multer para subir avatars
const upload = multer({ dest: 'public/uploads/' });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority'
)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

const JWT_SECRET = 'TU_SECRET_SUPER_SEGURA!123'; // Cambia esto por algo seguro

// --- Registro ---
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

// --- Login ---
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const isValid = await user.comparePassword(password);
  if (!isValid) return res.status(400).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Login correcto', token });
});

// --- Middleware de autenticación ---
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

// --- Subir avatar ---
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.body.userId; // o extraído del token JWT
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.avatar = '/uploads/' + req.file.filename;
    await user.save();

    res.json({ message: 'Avatar subido', avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// --- Chat en tiempo real ---
const mensajeSchema = new mongoose.Schema({
  usuario: String,
  texto: String,
  avatar: String,
  fecha: { type: Date, default: Date.now }
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

io.on('connection', (socket) => {
  console.log('Usuario conectado');

  // Cargar últimos 100 mensajes
  Mensaje.find().sort({ fecha: 1 }).limit(100).then(mensajes => {
    socket.emit('cargar-mensajes', mensajes);
  });

  // Nuevo mensaje
  socket.on('nuevo-mensaje', async (data) => {
    const { usuario, texto, token } = data;
    if (!token) return;

    try {
      const decoded = jwt.verify(token.split(' ')[1] || token, JWT_SECRET);
      const user = await User.findById(decoded.id);

      const mensaje = new Mensaje({
        usuario,
        texto,
        avatar: user.avatar
      });

      await mensaje.save();
      io.emit('nuevo-mensaje', mensaje);
    } catch (err) {
      console.log('Token inválido, mensaje rechazado');
    }
  });
});

// --- Servidor ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
