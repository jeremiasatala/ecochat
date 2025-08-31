document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const chat = document.getElementById('chat');
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const userList = document.getElementById('userList');

  const registerBtn = document.getElementById('registerBtn');
  const loginBtn = document.getElementById('loginBtn');

  let username = '';
  let userEmail = '';
  let token = '';
  let userId = '';
  let userAvatar = 'assets/default-avatar.png';
  let userCover = 'assets/default-cover.png';

  // --- Debug socket ---
  socket.on('connect', () => console.log('socket conectado', socket.id));
  socket.on('connect_error', (err) => console.error('socket connect_error', err));

  // contador de caracteres
  const charCountEl = document.getElementById('charCount');
  mensajeInput?.addEventListener('input', () => {
    charCountEl && (charCountEl.textContent = `${mensajeInput.value.length}/200`);
  });

  // --- Render lista de usuarios ---
  socket.on('actualizar-usuarios', (usuarios = []) => {
    userList.innerHTML = '';
    usuarios.forEach(u => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.flexDirection = 'column';
      li.style.gap = '6px';
      li.style.marginBottom = '8px';
      li.style.borderRadius = '8px';
      li.style.overflow = 'hidden';
      li.style.background = '#fafafa';
      li.style.padding = '6px';

      const coverDiv = document.createElement('div');
      coverDiv.style.height = '60px';
      coverDiv.style.backgroundImage = `url(${u.cover || 'assets/default-cover.png'})`;
      coverDiv.style.backgroundSize = 'cover';
      coverDiv.style.backgroundPosition = 'center';
      coverDiv.style.position = 'relative';
      coverDiv.style.borderRadius = '6px';

      const avatar = document.createElement('img');
      avatar.src = u.avatar || 'assets/default-avatar.png';
      avatar.alt = u.username || u.email || 'Invitado'; // <--- cambio mínimo
      avatar.style.width = '48px';
      avatar.style.height = '48px';
      avatar.style.borderRadius = '50%';
      avatar.style.position = 'absolute';
      avatar.style.left = '50%';
      avatar.style.transform = 'translateX(-50%)';
      avatar.style.bottom = '-20px';
      avatar.style.border = '3px solid #fff';
      avatar.style.objectFit = 'cover';

      coverDiv.appendChild(avatar);

      const info = document.createElement('div');
      info.style.marginTop = '26px';
      info.style.textAlign = 'center';
      info.style.fontSize = '13px';
      info.textContent = u.username?.trim() ? u.username : u.email; // <--- cambio mínimo

      li.appendChild(coverDiv);
      li.appendChild(info);
      userList.appendChild(li);
    });
  });

  // --- Mostrar mensajes ---
  function scrollAbajo() {
    chat.scrollTop = chat.scrollHeight;
  }

  function eliminarMensaje(div) {
    div.classList.add('removing');
    setTimeout(() => div.remove(), 300);
  }

  function agregarMensaje(m) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.style.display = 'flex';
    div.style.alignItems = 'flex-start';
    div.style.gap = '10px';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '8px';
    div.style.background = '#fff';
    div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    const avatarImg = document.createElement('img');
    avatarImg.src = m.avatar || 'assets/default-avatar.png';
    avatarImg.alt = m.username || m.usuario || m.email || 'Invitado'; // <--- cambio mínimo
    avatarImg.style.width = '40px';
    avatarImg.style.height = '40px';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.objectFit = 'cover';

    const contenido = document.createElement('div');
    const hora = new Date(m.fecha).toLocaleTimeString();
    const who = document.createElement('div');
    who.style.fontSize = '13px';
    who.style.fontWeight = '600';
    who.textContent = `${m.username || m.usuario || m.email || 'Invitado'} • ${hora}`; // <--- cambio mínimo
    const text = document.createElement('div');
    text.style.marginTop = '4px';
    text.textContent = m.texto;

    contenido.appendChild(who);
    contenido.appendChild(text);

    div.appendChild(avatarImg);
    div.appendChild(contenido);

    chat.appendChild(div);
    scrollAbajo();

    const ahora = Date.now();
    const fecha = new Date(m.fecha).getTime();
    const restante = Math.max(0, 60000 - (ahora - fecha));
    setTimeout(() => eliminarMensaje(div), restante);
  }

  socket.on('cargar-mensajes', (mensajes = []) => {
    chat.innerHTML = '';
    mensajes.forEach(agregarMensaje);
    scrollAbajo();
  });

  socket.on('nuevo-mensaje', (m) => agregarMensaje(m));

  socket.on('avatar-actualizado', ({ usuario, username, avatar }) => {
    document.querySelectorAll('#chat img[alt]').forEach(img => {
      if (img.alt === username || img.alt === usuario) img.src = avatar || 'assets/default-avatar.png';
    });
  });

  // --- Registro ---
  registerBtn?.addEventListener('click', async () => {
    try {
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value.trim();
      const newUsername = document.getElementById('registerUsername').value.trim();
      if (!email || !password || !newUsername) return alert('Completa todos los campos');

      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username: newUsername })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Registrado. Iniciá sesión.');
      } else {
        alert(data.error || 'Error al registrar');
      }
    } catch (err) {
      console.error('register error', err);
      alert('Error en registro, mira la consola');
    }
  });

  // --- Login ---
  loginBtn?.addEventListener('click', async () => {
    try {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      if (!email || !password) return alert('Completa todos los campos');

      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        token = data.token;
        userEmail = email;

        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.id;
          username = payload.username || email;
        } catch (e) {
          console.warn('No se pudo extraer userId del token', e);
        }

        // UI
        document.getElementById('auth').style.display = 'none';
        document.getElementById('profile').classList.remove('hidden');
        document.getElementById('chatContainer').style.display = 'flex';
        document.getElementById('usernameDisplay').textContent = username;

        // obtener datos usuario
        const userRes = await fetch(`/user/${userId}`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const userData = await userRes.json();

        userAvatar = userData.avatar || 'assets/default-avatar.png';
        userCover = userData.cover || 'assets/default-cover.png';
        username = userData.username || username; // <--- asegurarse de usar username real

        document.getElementById('avatarPreview').src = userAvatar;
        document.getElementById('coverPreview').src = userCover;
        document.getElementById('usernameDisplay').textContent = username;

        // actualizar estado en socket
        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover
        });
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      console.error('login error', err);
      alert('Error en login, mira la consola');
    }
  });

  // --- Enviar mensaje ---
  enviarBtn?.addEventListener('click', () => {
    const texto = mensajeInput.value.trim();
    if (!texto) return;
    if (!socket || !socket.connected) return alert('Socket no conectado, recarga la página');

    socket.emit('nuevo-mensaje', {
      usuario: userEmail || '',
      username: username || userEmail || '',
      texto,
      avatar: userAvatar,
      cover: userCover,
      token
    });

    mensajeInput.value = '';
    charCountEl && (charCountEl.textContent = '0/200');
  });

  mensajeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarBtn.click();
    }
  });

  // --- Subir avatar ---
  document.getElementById('subir-avatar')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('avatar');
    const file = fileInput.files[0];
    if (!file) return alert('Selecciona una imagen');
    if (!userId) return alert('Inicia sesión para subir avatar');

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', userId);

    try {
      const res = await fetch('/upload-avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.avatar) {
        userAvatar = data.avatar;
        document.getElementById('avatarPreview').src = userAvatar;

        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover
        });
      }
      alert(data.message || 'Avatar subido');
    } catch (err) {
      console.error('upload avatar error', err);
      alert('Error subiendo avatar');
    }
  });

  // --- Subir cover ---
  document.getElementById('subir-cover')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cover');
    const file = fileInput.files[0];
    if (!file) return alert('Selecciona una imagen de portada');
    if (!userId) return alert('Inicia sesión para subir portada');

    const formData = new FormData();
    formData.append('cover', file);
    formData.append('userId', userId);

    try {
      const res = await fetch('/upload-cover', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.cover) {
        userCover = data.cover;
        document.getElementById('coverPreview').src = userCover;

        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover
        });
      }
      alert(data.message || 'Cover subido');
    } catch (err) {
      console.error('upload cover error', err);
      alert('Error subiendo cover');
    }
  });
});
