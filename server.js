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

// Asegurar que la carpeta de uploads existe
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Carpeta uploads creada:', uploadsDir);
}

// Configuración mejorada de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/';
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);


// Servir archivos estáticos CORREGIDO
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

mongoose.connect(
  'mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority'
)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

const JWT_SECRET = 'TU_SECRET_SUPER_SEGURA!123';

// Middleware de autenticación CORREGIDO
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

// Registro - MODIFICADO
app.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body; // ← Añadir username
    const user = new User({ email, password, username }); // ← Pasar username
    await user.save();
    res.json({ message: 'Usuario creado correctamente' });
  } catch (err) {
    res.status(400).json({ error: 'Email ya registrado o datos inválidos' });
  }
});

// Login - MEJORADO
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
        bio: user.bio || 'Bienvenido a EcoChat' // ← AÑADIR
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Verificar token - MEJORADO
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
      username: user.username || '', // ← Añadir username
      avatar: user.avatar || '/assets/default-avatar.png',
      cover: user.cover || '/assets/default-cover.png',
      bio: user.bio || 'Bienvenido a EcoChat' // ← AÑADIR
    });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido', valid: false });
  }
});

// Obtener usuario por ID
app.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ 
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png', 
      cover: user.cover || '/assets/default-cover.png',
      bio: user.bio || 'Bienvenido a EcoChat' // ← AÑADIR
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Obtener perfil del usuario autenticado
app.get('/profile', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json({ 
      email: user.email,
      username: user.username || '',
      avatar: user.avatar || '/assets/default-avatar.png', 
      cover: user.cover || '/assets/default-cover.png',
      bio: user.bio || 'Bienvenido a EcoChat', // ← AÑADIR
      messageCount: 0,
      lastSeen: new Date().toLocaleString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
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
      bio: user.bio || 'Bienvenido a EcoChat', // ← AÑADIR
      messageCount: 0,
      lastSeen: new Date().toLocaleString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Actualizar username
app.post('/set-username', autenticar, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.username = username;
    await user.save();

    res.json({ message: 'Username actualizado', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar username' });
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

// Mensajes  ⟵ REEMPLAZAR COMPLETO ESTE BLOQUE
const mensajeSchema = new mongoose.Schema({
  // ⬇️ NUEVO: guardamos el email del autor como clave estable
  email: { type: String, required: true },

  // 'usuario' queda como nombre visible (username o email para mostrar)
  usuario: String,
  texto: String,
  avatar: String,

  // TTL 60s para autolimpieza
  fecha: { type: Date, default: Date.now, expires: 60 }
});

const Mensaje = mongoose.model('Mensaje', mensajeSchema);

// Subir avatar - CORREGIDO  ⟵ REEMPLAZAR COMPLETO ESTE HANDLER
app.post('/upload-avatar', autenticar, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.avatar = '/uploads/' + req.file.filename;
    await user.save();

    // ⬇️ CAMBIO: actualizamos mensajes por email (clave estable).
    // Incluimos OR por 'usuario' para mensajes antiguos (compatibilidad hacia atrás).
    await Mensaje.updateMany(
      { $or: [
          { email: user.email },
          { usuario: user.username || '__never__' }, // fallback por si hubo mensajes sin email
          { usuario: user.email }                    // otro posible valor antiguo
      ]},
      { $set: { avatar: user.avatar } }
    );

    io.emit('avatar-actualizado', { 
      // mantenemos 'usuario' por compatibilidad con el cliente actual
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

// Subir cover - CORREGIDO
app.post('/upload-cover', autenticar, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    user.cover = '/uploads/' + req.file.filename;
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
// Logout (limpiar token del lado del cliente)
app.post('/logout', autenticar, (req, res) => {
  res.json({ message: 'Sesión cerrada correctamente' });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // ⬇️ CAMBIO: simplificamos y usamos email como clave
  (async () => {
    try {
      const mensajes = await Mensaje.find().sort({ fecha: 1 }).limit(100);
      socket.emit('cargar-mensajes', mensajes);

      // Guardamos todos los emails que aparecen en los mensajes
      const emailsSet = new Set();
      mensajes.forEach(m => {
        if (m.email) emailsSet.add(m.email); // ⬅️ NUEVO: usamos email en vez de usuario
      });

      // Buscamos usuarios en la base de datos por email
      const usuariosDB = await User.find({ email: { $in: Array.from(emailsSet) } });

      // Preparamos el array de usuarios para emitir al cliente
      const usuariosAEmitir = usuariosDB.map(u => ({
        usuario: u.username || u.email,                       // nombre visible
        email: u.email,                                       // clave estable
        username: u.username || '',
        avatar: u.avatar || '/assets/default-avatar.png',
        cover: u.cover || '/assets/default-cover.png',
        bio: u.bio || 'Bienvenido a EcoChat',                 // ⬅️ bio real desde DB
        messageCount: 0,
        lastSeen: 'En línea'
      }));

      // Emitimos la lista de usuarios actualizada
      socket.emit('actualizar-usuarios', usuariosAEmitir);
    } catch (err) {
      console.error('Error al cargar mensajes iniciales:', err);
    }
  })();


  socket.on('nuevo-mensaje', async (data) => {
    try {
      const { texto, token } = data;
      let userAvatar = '/assets/default-avatar.png';
      let userCover = '/assets/default-cover.png';
      let displayName = 'Invitado';
      let userEmail = 'invitado@ejemplo.com';

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
          console.log('Token inválido para mensaje:', tokenError.message);
        }
      }

      const mensaje = new Mensaje({ 
        usuario: displayName, 
        texto, 
        avatar: userAvatar 
      });
      
      await mensaje.save();
      io.emit('nuevo-mensaje', { ...mensaje.toObject(), email: userEmail });

      // Actualizar lista de usuarios
      const mensajesActuales = await Mensaje.find();
      const usuariosMap = {};
      const usuariosInfo = {};
      
      mensajesActuales.forEach(m => {
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
        
        usuariosInfo[key] = {
          email: u.email,
          username: u.username || '',
          avatar: u.avatar || '/assets/default-avatar.png',
          cover: u.cover || '/assets/default-cover.png',
          bio: u.bio || 'Bienvenido a EcoChat', // ← AÑADIR
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
          bio: usuariosInfo[usuario]?.bio || 'Bienvenido a EcoChat', // ← AÑADE ESTA LÍNEA
          messageCount: usuariosInfo[usuario]?.messageCount || 0,
          lastSeen: usuariosInfo[usuario]?.lastSeen || 'Desconocido'
        }))
      );
    } catch (err) {
      console.log('Error al crear mensaje:', err.message);
    }
  });

  // Solicitar información de usuario para el inspector
  socket.on('solicitar-info-usuario', async (email) => {
    try {
      const user = await User.findOne({ email });
      if (user) {
        socket.emit('info-usuario', {
          email: user.email,
          username: user.username || '',
          avatar: user.avatar || '/assets/default-avatar.png',
          cover: user.cover || '/assets/default-cover.png',
          bio: user.bio || 'Bienvenido a EcoChat', // ← AÑADIR
          messageCount: 0,
          lastSeen: new Date().toLocaleString()
        });
      }
    } catch (err) {
      console.log('Error al obtener info de usuario:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

// Actualizar periódicamente
setInterval(async () => {
  try {
    const mensajes = await Mensaje.find().sort({ fecha: 1 });
    io.emit('cargar-mensajes', mensajes);

    const usuariosMap = {};
    const usuariosInfo = {};
    
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
      
      usuariosInfo[key] = {
        email: u.email,
        username: u.username || '',
        avatar: u.avatar || '/assets/default-avatar.png',
        cover: u.cover || '/assets/default-cover.png',
        bio: u.bio || 'Bienvenido a EcoChat', // ← AÑADIR
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
        bio: usuariosInfo[usuario]?.bio || 'Bienvenido a EcoChat', // ← AÑADE ESTA LÍNEA
        messageCount: usuariosInfo[usuario]?.messageCount || 0,
        lastSeen: usuariosInfo[usuario]?.lastSeen || 'Desconocido'
      }))
    );
  } catch (err) {
    console.error('Error en actualización periódica:', err);
  }
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));