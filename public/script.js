const socket = io();
const chat = document.getElementById('chat');
const mensajeInput = document.getElementById('mensaje');
const enviarBtn = document.getElementById('enviar');

const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');

let userEmail = '';
let token = '';
let userId = ''; // Guarda el id del usuario después del login

// --- Funciones para mostrar mensajes ---
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

// --- Registro ---
registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  alert(data.message || data.error);
});

// --- Login ---
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.token) {
    token = data.token;
    userEmail = email;

    // Extraemos userId desde el token JWT
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.id;

    document.getElementById('auth').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'block';
  } else {
    alert(data.error);
  }
});

// --- Enviar mensaje ---
enviarBtn.addEventListener('click', () => {
  const texto = mensajeInput.value.trim();
  if (!texto) return;

  socket.emit('nuevo-mensaje', {
    usuario: userEmail,
    texto,
    token
  });

  mensajeInput.value = '';
  mensajeInput.focus();
});

// --- Subir avatar --- <--- AQUI VA
document.getElementById('subir-avatar').addEventListener('click', async () => {
  const fileInput = document.getElementById('avatar');
  const file = fileInput.files[0];
  if (!file) return alert('Selecciona una imagen');

  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('userId', userId); // identificamos al usuario con su id

  const res = await fetch('/upload-avatar', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  alert(data.message);
});
