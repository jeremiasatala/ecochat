document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const chat = document.getElementById('chat');
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');

  const registerBtn = document.getElementById('registerBtn');
  const loginBtn = document.getElementById('loginBtn');

  let userEmail = '';
  let token = '';
  let userId = '';
  let userAvatar = '';

  // --- Funciones para mostrar mensajes ---
  function agregarMensaje(m) {
    const div = document.createElement('div');
    div.classList.add('comment');
    div.dataset.usuario = m.usuario;

    const avatarImg = document.createElement('img');
    avatarImg.src = m.avatar || 'assets/default-avatar.png';
    avatarImg.alt = m.usuario;
    avatarImg.classList.add('avatar');

    const contenido = document.createElement('div');
    const hora = new Date(m.fecha).toLocaleTimeString();
    contenido.textContent = `[${hora}] ${m.usuario}: ${m.texto}`;

    div.appendChild(avatarImg);
    div.appendChild(contenido);
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  // Escuchar mensajes
  socket.on('cargar-mensajes', (mensajes) => mensajes.forEach(agregarMensaje));
  socket.on('nuevo-mensaje', (m) => agregarMensaje(m));
  socket.on('avatar-actualizado', ({ usuario, avatar }) => {
    document.querySelectorAll('.comment').forEach(msg => {
      if (msg.dataset.usuario === usuario) {
        const img = msg.querySelector('img');
        if (img) img.src = avatar;
      }
    });
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

      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.id;

      document.getElementById('auth').style.display = 'none';
      document.getElementById('chatContainer').style.display = 'block';
      document.getElementById('profile').classList.remove('hidden');
      document.getElementById('userEmailDisplay').textContent = userEmail;

      const userRes = await fetch(`/user/${userId}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const userData = await userRes.json();
      userAvatar = userData.avatar || '';
      if (userAvatar) document.getElementById('avatarPreview').src = userAvatar;
    } else {
      alert(data.error);
    }
  });

  // --- Enviar mensaje ---
  enviarBtn.addEventListener('click', () => {
    const texto = mensajeInput.value.trim();
    if (!texto) return;

    socket.emit('nuevo-mensaje', { usuario: userEmail, texto, token });
    mensajeInput.value = '';
    mensajeInput.focus();
  });

  // --- Subir avatar ---
  document.getElementById('subir-avatar').addEventListener('click', async () => {
    const fileInput = document.getElementById('avatar');
    const file = fileInput.files[0];
    if (!file) return alert('Selecciona una imagen');

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', userId);

    const res = await fetch('/upload-avatar', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.avatar) {
      userAvatar = data.avatar;
      document.getElementById('avatarPreview').src = userAvatar;
    }

    alert(data.message);
  });

});
