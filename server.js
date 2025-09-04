const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const User = require('./models/user');

// Configuración inicial
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

const JWT_SECRET = 'TU_SECRET_SUPER_SEGURA!123';

// ⭐⭐ NUEVO: Mapa para usuarios conectados
const usuariosConectados = new Map();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority'
)
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error conectando a MongoDB:', err));

// Y REEMPLAZAR con Cloudinary:
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para avatares
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecochat/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 200, height: 200, crop: 'fill' }]
  }
});

// Configurar almacenamiento para portadas
const coverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecochat/covers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 800, height: 300, crop: 'fill' }]
  }
});

// Y cambiar la configuración de multer:
const uploadAvatar = multer({ storage: avatarStorage });
const uploadCover = multer({ storage: coverStorage });

// CONFIGURACIÓN MULTER PARA SUBIDAS GENERALES (si aún la necesitas)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// Middleware de autenticación
const autenticar = (req, res, next) => {
  let token = req.headers['authorization'] || req.body.token || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Esquema y modelo de Mensajes
const mensajeSchema = new mongoose.Schema({
  usuario: String,
  email: String,
  texto: String,
  avatar: String,
  fecha: { type: Date, default: Date.now, expires: 60 }
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

// --- RUTAS DE LA API ---

// Registro
app.post('/register', async (req, res) => {
  try {
    const { email, password, username, bio } = req.body;
    const user = new User({ 
      email, 
      password, 
      username, 
      bio: bio || 'Bienvenido a EcoChat'
    });
    await user.save();
    res.json({ message: 'Usuario creado correctamente' });
  } catch (err) {
    res.status(400).json({ error: 'Email ya registrado o datos inválidos' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ 
      id: user._id, 
      email: user.email 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login correcto',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        avatar: user.avatar || '/assets/default-avatar.png',
        cover: user.cover || '/assets/default-cover.png',
        bio: user.bio || 'Bienvenido a EcoChat'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Verificar token
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token no proporcionado' });

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(cleanToken, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      valid: true,
      userId: user._id,
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png',
      cover: user.cover || '/assets/default-cover.png',
      bio: user.bio || 'Bienvenido a EcoChat'
    });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido', valid: false });
  }
});

// Obtener usuario por email
app.get('/user-by-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // ⭐⭐ NUEVO: Verificar si el usuario está conectado
    const estaConectado = Array.from(usuariosConectados.values()).some(
      userConectado => userConectado.email === user.email
    );
    
    res.json({ 
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png', 
      cover: user.cover || '/assets/default-cover.png',
      bio: user.bio || 'Bienvenido a EcoChat',
      messageCount: 0,
      lastSeen: estaConectado ? 'En línea' : 'Desconectado',
      online: estaConectado // ⭐⭐ NUEVO: Estado de conexión
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Actualizar bio
app.post('/set-bio', autenticar, async (req, res) => {
  try {
    const { bio } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.bio = bio;
    await user.save();

    res.json({ message: 'Descripción actualizada', bio: user.bio });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar descripción' });
  }
});

// Actualizar username
app.post('/set-username', autenticar, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    // Verificar si el username ya existe (opcional pero recomendado)
    const existingUser = await User.findOne({ username });
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    user.username = username;
    await user.save();

    res.json({ message: 'Username actualizado', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar username' });
  }
});

// Subir avatar
app.post('/upload-avatar', autenticar, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.avatar = req.file.path;
    await user.save();

    await Mensaje.updateMany(
      { $or: [
          { email: user.email },
          { usuario: user.username || '__never__' },
          { usuario: user.email }
      ]},
      { $set: { avatar: user.avatar } }
    );

    io.emit('avatar-actualizado', { 
      usuario: user.username || user.email, 
      avatar: user.avatar 
    });

    res.json({ 
      message: 'Avatar subido correctamente', 
      avatar: user.avatar 
    });
  } catch (err) {
    console.error('Error subiendo avatar:', err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// Subir cover
app.post('/upload-cover', autenticar, uploadCover.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.cover = req.file.path;
    await user.save();

    io.emit('cover-actualizado', { 
      usuario: user.username || user.email, 
      cover: user.cover 
    });

    res.json({ 
      message: 'Cover subido correctamente', 
      cover: user.cover 
    });
  } catch (err) {
    console.error('Error subiendo cover:', err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// Actualizar Instagram
app.post('/set-instagram', autenticar, async (req, res) => {
  try {
    const { instagram } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.instagram = instagram;
    await user.save();

    res.json({ message: 'Instagram actualizado', instagram: user.instagram });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar Instagram' });
  }
});

// Actualizar Twitter
app.post('/set-twitter', autenticar, async (req, res) => {
  try {
    const { twitter } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.twitter = twitter;
    await user.save();

    res.json({ message: 'Twitter actualizado', twitter: user.twitter });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar Twitter' });
  }
});

// --- SOCKET.IO HANDLERS ---

// Función para actualizar lista de usuarios
const actualizarListaUsuarios = async () => {
  try {
    const mensajes = await Mensaje.find().sort({ fecha: 1 }).limit(100);
    
    const emailsUnicos = new Set();
    mensajes.forEach(m => {
      if (m.email) emailsUnicos.add(m.email);
    });

    const usuariosDB = await User.find({ 
      email: { $in: Array.from(emailsUnicos) } 
    });

    const usuariosPorEmail = {};
    usuariosDB.forEach(u => {
      // ⭐⭐ NUEVO: Verificar si el usuario está conectado
      const estaConectado = Array.from(usuariosConectados.values()).some(
        userConectado => userConectado.email === u.email
      );
      
      usuariosPorEmail[u.email] = {
        email: u.email,
        username: u.username || u.email,
        avatar: u.avatar || '/assets/default-avatar.png',
        cover: u.cover || '/assets/default-cover.png',
        bio: u.bio || 'Bienvenido a EcoChat',
        messageCount: 0,
        lastSeen: estaConectado ? 'En línea' : 'Desconectado',
        online: estaConectado // ⭐⭐ NUEVO: Estado de conexión
      };
    });

    io.emit('actualizar-usuarios', Object.values(usuariosPorEmail));
  } catch (err) {
    console.error('Error al actualizar lista de usuarios:', err);
  }
};

// Conexiones de Socket.io
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // ⭐⭐ NUEVO: Evento para registrar usuario autenticado
  socket.on('user-authenticated', (userData) => {
    console.log('Usuario autenticado:', userData.email);
    
    // Guardar usuario en mapa de conectados
    usuariosConectados.set(socket.id, {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      socketId: socket.id,
      connectedAt: new Date()
    });
    
    // Actualizar lista de usuarios para todos
    actualizarListaUsuarios();
  });

  // Cargar mensajes iniciales
  (async () => {
    try {
      const mensajes = await Mensaje.find().sort({ fecha: 1 }).limit(100);
      socket.emit('cargar-mensajes', mensajes);
      await actualizarListaUsuarios();
    } catch (err) {
      console.error('Error al cargar mensajes iniciales:', err);
    }
  })();

  // Handler para nuevos mensajes
  socket.on('nuevo-mensaje', async (data) => {
    console.log('📨 Mensaje recibido en servidor:', {
      usuario: data.usuario,
      texto: data.texto,
      timestamp: new Date().toISOString()
    });
    
    try {
      const { texto, token } = data;
      let userAvatar = '/assets/default-avatar.png';
      let userCover = '/assets/default-cover.png';
      let displayName = 'Invitado';
      let userEmail = 'invitado@ejemplo.com';

      // Verificar token y obtener datos del usuario
      if (token) {
        try {
          const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
          const decoded = jwt.verify(cleanToken, JWT_SECRET);
          const user = await User.findById(decoded.id);
          
          if (user) {
            userAvatar = user.avatar || '/assets/default-avatar.png';
            userCover = user.cover || '/assets/default-cover.png';
            displayName = user.username || user.email;
            userEmail = user.email;
          }
        } catch (tokenError) {
          console.log('❌ Token inválido para mensaje:', tokenError.message);
        }
      }

      // Crear y guardar mensaje
      const mensaje = new Mensaje({ 
        usuario: displayName,
        email: userEmail,
        texto, 
        avatar: userAvatar 
      });
      
      await mensaje.save();
      console.log('💾 Mensaje guardado en BD:', mensaje._id);
      
      // Emitir mensaje a todos los clientes
      const mensajeParaEmitir = {
        _id: mensaje._id,
        usuario: displayName,
        email: userEmail,
        texto: texto,
        avatar: userAvatar,
        fecha: mensaje.fecha
      };
      
      io.emit('nuevo-mensaje', mensajeParaEmitir);
      console.log('📢 Mensaje emitido a todos los clientes');

      // Actualizar lista de usuarios
      await actualizarListaUsuarios();
    } catch (err) {
      console.log('❌ Error al crear mensaje:', err.message);
    }
  });

  // Solicitar información de usuario
  socket.on('solicitar-info-usuario', async (email) => {
    try {
      const user = await User.findOne({ email });
      if (user) {
        // ⭐⭐ NUEVO: Verificar si está conectado
        const estaConectado = Array.from(usuariosConectados.values()).some(
          userConectado => userConectado.email === user.email
        );
        
        socket.emit('info-usuario', {
          email: user.email,
          username: user.username || '',
          avatar: user.avatar || '/assets/default-avatar.png',
          cover: user.cover || '/assets/default-cover.png',
          bio: user.bio || 'Bienvenido a EcoChat',
          messageCount: 0,
          lastSeen: estaConectado ? 'En línea' : 'Desconectado',
          online: estaConectado
        });
      }
    } catch (err) {
      console.log('Error al obtener info de usuario:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    // ⭐⭐ NUEVO: Remover usuario de conectados
    usuariosConectados.delete(socket.id);
    actualizarListaUsuarios(); // Actualizar lista para todos
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));