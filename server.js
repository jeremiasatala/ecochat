const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

mongoose.connect('mongodb+srv://jeruxo:cMD9Jc0BR1SGZLg8@cluster0.h1dg0y8.mongodb.net/chatGlobal?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error conectando a MongoDB:', err));

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
    const mensaje = new Mensaje(data);
    await mensaje.save();
    io.emit('nuevo-mensaje', mensaje);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
