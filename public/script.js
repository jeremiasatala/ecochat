const socket = io();
const chat = document.getElementById('chat');
const usuarioInput = document.getElementById('usuario');
const mensajeInput = document.getElementById('mensaje');
const enviarBtn = document.getElementById('enviar');

function agregarMensaje(m) {
  const div = document.createElement('div');
  const hora = new Date(m.fecha).toLocaleTimeString();
  div.textContent = `[${hora}] ${m.usuario}: ${m.texto}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

socket.on('cargar-mensajes', (mensajes) => {
  mensajes.forEach(agregarMensaje);
});

socket.on('nuevo-mensaje', (m) => {
  agregarMensaje(m);
});

enviarBtn.addEventListener('click', () => {
  const usuario = usuarioInput.value.trim();
  const texto = mensajeInput.value.trim();
  if (!usuario || !texto) return;

  socket.emit('nuevo-mensaje', { usuario, texto });
  mensajeInput.value = '';
  mensajeInput.focus();
});
