const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('./models/user');

const upload = multer({ dest: 'public/uploads/' });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

mongoose.connect(
  'mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority'
)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

const JWT_SECRET = 'TU_SECRET_SUPER_SEGURA!123';

// Registro
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

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const isValid = await user.comparePassword(password);
  if (!isValid) return res.status(400).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

  res.json({
    message: 'Login correcto',
    token,
    user: {
      id: user._id,
      email: user.email,
      username: user.username || '', // añadimos username
      avatar: user.avatar || '/assets/default-avatar.png',
      cover: user.cover || '/assets/default-cover.png'
    }
  });
});

// Obtener usuario
app.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ 
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png', 
      cover: user.cover || '/assets/default-cover.png' 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Obtener usuario por email (para el inspector)
app.get('/user-by-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ 
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png', 
      cover: user.cover || '/assets/default-cover.png',
      messageCount: 0, // Puedes implementar un contador real
      lastSeen: new Date().toLocaleString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Actualizar username
app.post('/set-username', async (req, res) => {
  const { username, token } = req.body;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = jwt.verify(token.split(' ')[1] || token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.username = username;
    await user.save();

    res.json({ message: 'Username actualizado', username: user.username });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Middleware de autenticación
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

// Mensajes
const mensajeSchema = new mongoose.Schema({
  usuario: String,
  texto: String,
  avatar: String,
  fecha: { type: Date, default: Date.now, expires: 60 }
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

// Subir avatar
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.avatar = '/uploads/' + req.file.filename;
    await user.save();

    await Mensaje.updateMany(
      { usuario: user.username || user.email },
      { $set: { avatar: user.avatar } }
    );

    io.emit('avatar-actualizado', { usuario: user.username || user.email, avatar: user.avatar });

    res.json({ message: 'Avatar subido y mensajes actualizados', avatar: user.avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// Subir cover
app.post('/upload-cover', upload.single('cover'), async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.cover = '/uploads/' + req.file.filename;
    await user.save();

    io.emit('cover-actualizado', { usuario: user.username || user.email, cover: user.cover });

    res.json({ message: 'Cover subido correctamente', cover: user.cover });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Usuario conectado');

  (async () => {
    const mensajes = await Mensaje.find().sort({ fecha: 1 }).limit(100);
    socket.emit('cargar-mensajes', mensajes);

    const usuariosMap = {};
    const usuariosInfo = {}; // Nuevo: almacenar info completa de usuarios
    
    mensajes.forEach(m => {
      usuariosMap[m.usuario] = { 
        avatar: m.avatar || '/assets/default-avatar.png', 
        cover: '' 
      };
    });

    const usuariosDB = await User.find({ 
      $or: Object.keys(usuariosMap).length > 0 ? [
        { username: { $in: Object.keys(usuariosMap) } },
        { email: { $in: Object.keys(usuariosMap) } }
      ] : [] 
    });
    
    usuariosDB.forEach(u => {
      const key = u.username || u.email;
      if (usuariosMap[key]) {
        usuariosMap[key].cover = u.cover || '/assets/default-cover.png';
      }
      
      // Almacenar información completa para el inspector
      usuariosInfo[key] = {
        email: u.email,
        username: u.username || '',
        avatar: u.avatar || '/assets/default-avatar.png',
        cover: u.cover || '/assets/default-cover.png',
        messageCount: 0, // Puedes implementar contador real
        lastSeen: 'En línea'
      };
    });

    // Emitir datos completos para el inspector
    socket.emit('actualizar-usuarios', 
      Object.entries(usuariosMap).map(([usuario, { avatar, cover }]) => ({
        usuario,
        avatar,
        cover,
        email: usuariosInfo[usuario]?.email || usuario,
        username: usuariosInfo[usuario]?.username || '',
        messageCount: usuariosInfo[usuario]?.messageCount || 0,
        lastSeen: usuariosInfo[usuario]?.lastSeen || 'Desconocido'
      }))
    );
  })();

  socket.on('nuevo-mensaje', async (data) => {
    const { usuario, texto, token } = data;
    try {
      let userAvatar = '/assets/default-avatar.png';
      let userCover = '/assets/default-cover.png';
      let displayName = usuario || 'Invitado';
      let userEmail = usuario;

      if (token) {
        const decoded = jwt.verify(token.split(' ')[1] || token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          userAvatar = user.avatar || '/assets/default-avatar.png';
          userCover = user.cover || '/assets/default-cover.png';
          displayName = user.username || user.email;
          userEmail = user.email;
        }
      }

      const mensaje = new Mensaje({ usuario: displayName, texto, avatar: userAvatar });
      await mensaje.save();
      io.emit('nuevo-mensaje', { ...mensaje.toObject(), email: userEmail });

      const mensajesActuales = await Mensaje.find();
      const usuariosMap = {};
      const usuariosInfo = {};
      
      mensajesActuales.forEach(m => {
        usuariosMap[m.usuario] = { avatar: m.avatar || '/assets/default-avatar.png', cover: '' };
      });

      const usuariosDB = await User.find({ 
        $or: Object.keys(usuariosMap).length > 0 ? [
          { username: { $in: Object.keys(usuariosMap) } },
          { email: { $in: Object.keys(usuariosMap) } }
        ] : [] 
      });
      
      usuariosDB.forEach(u => {
        const key = u.username || u.email;
        if (usuariosMap[key]) {
          usuariosMap[key].cover = u.cover || '/assets/default-cover.png';
        }
        
        usuariosInfo[key] = {
          email: u.email,
          username: u.username || '',
          avatar: u.avatar || '/assets/default-avatar.png',
          cover: u.cover || '/assets/default-cover.png',
          messageCount: 0,
          lastSeen: 'En línea'
        };
      });

      io.emit('actualizar-usuarios', 
        Object.entries(usuariosMap).map(([usuario, { avatar, cover }]) => ({
          usuario,
          avatar,
          cover,
          email: usuariosInfo[usuario]?.email || usuario,
          username: usuariosInfo[usuario]?.username || '',
          messageCount: usuariosInfo[usuario]?.messageCount || 0,
          lastSeen: usuariosInfo[usuario]?.lastSeen || 'Desconocido'
        }))
      );
    } catch (err) {
      console.log('Error al crear mensaje:', err.message);
    }
  });

  // Nuevo evento: solicitar información específica de usuario para el inspector
  socket.on('solicitar-info-usuario', async (email) => {
    try {
      const user = await User.findOne({ email });
      if (user) {
        socket.emit('info-usuario', {
          email: user.email,
          username: user.username || '',
          avatar: user.avatar || '/assets/default-avatar.png',
          cover: user.cover || '/assets/default-cover.png',
          messageCount: 0, // Implementar contador real si es necesario
          lastSeen: new Date().toLocaleString()
        });
      }
    } catch (err) {
      console.log('Error al obtener info de usuario:', err);
    }
  });
});

// Actualizar periódicamente
setInterval(async () => {
  const mensajes = await Mensaje.find().sort({ fecha: 1 });
  io.emit('cargar-mensajes', mensajes);

  const usuariosMap = {};
  const usuariosInfo = {};
  
  mensajes.forEach(m => {
    usuariosMap[m.usuario] = { avatar: m.avatar || '/assets/default-avatar.png', cover: '' };
  });

  const usuariosDB = await User.find({ 
    $or: Object.keys(usuariosMap).length > 0 ? [
      { username: { $in: Object.keys(usuariosMap) } },
      { email: { $in: Object.keys(usuariosMap) } }
    ] : [] 
  });
  
  usuariosDB.forEach(u => {
    const key = u.username || u.email;
    if (usuariosMap[key]) {
      usuariosMap[key].cover = u.cover || '/assets/default-cover.png';
    }
    
    usuariosInfo[key] = {
      email: u.email,
      username: u.username || '',
      avatar: u.avatar || '/assets/default-avatar.png',
      cover: u.cover || '/assets/default-cover.png',
      messageCount: 0,
      lastSeen: 'En línea'
    };
  });

  io.emit('actualizar-usuarios', 
    Object.entries(usuariosMap).map(([usuario, { avatar, cover }]) => ({
      usuario,
      avatar,
      cover,
      email: usuariosInfo[usuario]?.email || usuario,
      username: usuariosInfo[usuario]?.username || '',
      messageCount: usuariosInfo[usuario]?.messageCount || 0,
      lastSeen: usuariosInfo[usuario]?.lastSeen || 'Desconocido'
    }))
  );
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));