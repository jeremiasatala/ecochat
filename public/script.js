document.addEventListener('DOMContentLoaded', async () => {
  const socket = io();

  const chat = document.getElementById('chat');
  const mensajeInput = document.getElementById('mensaje');
  const enviarBtn = document.getElementById('enviar');
  const userList = document.getElementById('userList');
  
  // Nuevos elementos de la interfaz
  const authButtons = document.getElementById('auth-buttons');
  const authForms = document.getElementById('auth-forms');
  const profileActions = document.getElementById('profile-actions');
  const profileEdit = document.getElementById('profile-edit');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const cancelLoginBtn = document.getElementById('cancelLoginBtn');
  const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');

  const registerBtn = document.getElementById('registerBtn');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  let username = '';
  let userEmail = '';
  let token = '';
  let userId = '';
  let userAvatar = 'assets/default-avatar.png';
  let userCover = 'assets/default-cover.png';
  let userBio = 'Bienvenido a EcoChat';
  let usersData = {};

  let puedeEnviar = true;

  function enviarMensaje(e) {
    console.log('🔵 Función enviarMensaje llamada', new Date().toISOString());
    if (e) {
      e.preventDefault();
      console.log('✅ Evento prevenido');
    }
    
    if (!puedeEnviar) {
      console.log('🚫 Envío bloqueado: puedeEnviar = false');
      return;
    }
    
    puedeEnviar = false;
    enviarBtn.disabled = true;
    console.log('🔒 Bloqueando envíos adicionales');
    
    const texto = mensajeInput.value.trim();
    console.log('📝 Texto a enviar:', texto);
    
    if (!texto) {
      console.log('❌ Texto vacío, cancelando envío');
      puedeEnviar = true;
      enviarBtn.disabled = false;
      return;
    }
    
    if (!socket || !socket.connected) {
      console.log('❌ Socket no conectado');
      alert('Socket no conectado, recarga la página');
      puedeEnviar = true;
      enviarBtn.disabled = false;
      return;
    }
    
    console.log('📤 Emitiendo mensaje via socket');
    socket.emit('nuevo-mensaje', {
      usuario: userEmail || 'Invitado',
      username: username || 'Invitado',
      texto,
      avatar: userAvatar,
      cover: userCover,
      token
    });

    mensajeInput.value = '';
    const charCountEl = document.getElementById('charCount');
    if (charCountEl) {
      charCountEl.textContent = '0/200';
    }
    console.log('✅ Mensaje enviado, limpiando campo');
    
    setTimeout(() => {
      puedeEnviar = true;
      enviarBtn.disabled = false;
      console.log('🔓 Envíos habilitados nuevamente');
    }, 1000);
  }

  // --- FUNCIONES DE INTERFAZ ---
  function showLoginForm() {
    authButtons.classList.add('hidden');
    authForms.classList.remove('hidden');
    document.querySelectorAll('.form-section').forEach(form => {
      form.style.display = 'none';
    });
    document.querySelectorAll('.form-section')[1].style.display = 'block';
  }

  function showRegisterForm() {
    authButtons.classList.add('hidden');
    authForms.classList.remove('hidden');
    document.querySelectorAll('.form-section').forEach(form => {
      form.style.display = 'none';
    });
    document.querySelectorAll('.form-section')[0].style.display = 'block';
  }

  function hideAuthForms() {
    authForms.classList.add('hidden');
    authButtons.classList.remove('hidden');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerUsername').value = '';
  }

  function showProfileEdit() {
    profileEdit.classList.remove('hidden');
    authButtons.classList.add('hidden');
    authForms.classList.add('hidden');
    profileActions.classList.add('hidden');
    document.getElementById('editBioInput').value = userBio;
  }

  function hideProfileEdit() {
    profileEdit.classList.add('hidden');
    profileActions.classList.remove('hidden');
  }

  async function actualizarBio() {
    const nuevaBio = document.getElementById('editBioInput').value.trim();
    if (!nuevaBio) return alert('La descripción no puede estar vacía');
    if (!token) return alert('Inicia sesión para editar tu descripción');

    try {
      const res = await fetch('/set-bio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ bio: nuevaBio })
      });
      
      const data = await res.json();
      if (res.ok) {
        userBio = nuevaBio;
        console.log('Bio actualizada:', userBio);
        document.getElementById('bio').textContent = userBio;
        
        const updatedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
        updatedUser.bio = userBio;
        localStorage.setItem('ecochat_user', JSON.stringify(updatedUser));
        
        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover,
          bio: userBio
        });
        
        alert('Descripción actualizada correctamente');
        hideProfileEdit();
      } else {
        alert(data.error || 'Error al actualizar descripción');
      }
    } catch (err) {
      console.error('Error actualizando bio:', err);
      alert('Error al actualizar descripción');
    }
  }

// ⭐⭐ NUEVO: Función para actualizar username (AGREGAR ESTO)
async function actualizarUsername() {
  const nuevoUsername = document.getElementById('editUsername').value.trim();
  if (!nuevoUsername) return alert('El nombre de usuario no puede estar vacío');
  if (!token) return alert('Inicia sesión para editar tu usuario');

  try {
    const res = await fetch('/set-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ username: nuevoUsername })
    });
    
    const data = await res.json();
    if (res.ok) {
      username = nuevoUsername;
      document.getElementById('usernameDisplay').textContent = username;
      
      // Actualizar localStorage
      const updatedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
      updatedUser.username = username;
      localStorage.setItem('ecochat_user', JSON.stringify(updatedUser));
      
      // Actualizar estado en socket
      socket.emit('actualizar-estado', {
        id: userId,
        email: userEmail,
        username,
        avatar: userAvatar,
        cover: userCover,
        bio: userBio
      });
      
      alert('Nombre de usuario actualizado correctamente');
    } else {
      alert(data.error || 'Error al actualizar usuario');
    }
  } catch (err) {
    console.error('Error actualizando username:', err);
    alert('Error al actualizar nombre de usuario');
  }
}


  // --- Event listeners ---
  showLoginBtn?.addEventListener('click', showLoginForm);
  showRegisterBtn?.addEventListener('click', showRegisterForm);
  cancelLoginBtn?.addEventListener('click', hideAuthForms);
  cancelRegisterBtn?.addEventListener('click', hideAuthForms);
  editProfileBtn?.addEventListener('click', showProfileEdit);
  cancelEditBtn?.addEventListener('click', hideProfileEdit);
  document.getElementById('guardarBioBtn')?.addEventListener('click', actualizarBio);
  document.getElementById('guardarUsernameBtn')?.addEventListener('click', actualizarUsername)

  // --- AUTO-LOGIN ---
  const savedToken = localStorage.getItem('ecochat_token');
  const savedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
  
  if (savedToken) {
    try {
      await autoLogin(savedToken, savedUser);
    } catch (error) {
      console.error('Error en auto-login:', error);
      logout();
    }
  }

  async function autoLogin(savedToken, savedUser) {
    try {
      const verifyRes = await fetch('/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      });

      if (!verifyRes.ok) {
        throw new Error('Token inválido');
      }

      const verifyData = await verifyRes.json();
      
      token = savedToken;
      userId = verifyData.userId;
      userEmail = verifyData.email;
      username = verifyData.username || userEmail;
      userAvatar = verifyData.avatar || 'assets/default-avatar.png';
      userCover = verifyData.cover || 'assets/default-cover.png';
      userBio = verifyData.bio || 'Bienvenido a EcoChat';

      authButtons.classList.add('hidden');
      authForms.classList.add('hidden');
      profileActions.classList.remove('hidden');
      profileEdit.classList.add('hidden');
      
      document.getElementById('usernameDisplay').textContent = username;
      document.getElementById('avatarPreview').src = userAvatar;
      document.getElementById('coverPreview').src = userCover;
      document.getElementById('bio').textContent = userBio;
      document.getElementById('editUsername').value = username || '';
      document.getElementById('editBioInput').value = userBio;

      // ⭐⭐ NUEVO: Emitir evento de usuario autenticado
      socket.emit('user-authenticated', {
        id: userId,
        email: userEmail,
        username: username,
        avatar: userAvatar,
        cover: userCover,
        bio: userBio
      });

      socket.emit('actualizar-estado', {
        id: userId,
        email: userEmail,
        username,
        avatar: userAvatar,
        cover: userCover,
        bio: userBio
      });

      console.log('Sesión restaurada automáticamente');

    } catch (error) {
      console.error('Error en auto-login:', error);
      throw error;
    }
  }

  function logout() {
    token = '';
    userId = '';
    userEmail = '';
    username = '';
    
    localStorage.removeItem('ecochat_token');
    localStorage.removeItem('ecochat_user');
    
    authButtons.classList.remove('hidden');
    authForms.classList.add('hidden');
    profileActions.classList.add('hidden');
    profileEdit.classList.add('hidden');
    
    document.getElementById('usernameDisplay').textContent = 'Invitado';
    document.getElementById('avatarPreview').src = 'assets/default-avatar.png';
    document.getElementById('coverPreview').src = 'assets/default-cover.png';
    document.getElementById('editUsername').value = '';
    document.getElementById('editBioInput').value = '';
    document.getElementById('bio').textContent = 'Bienvenido a EcoChat';
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerUsername').value = '';
    
    console.log('Sesión cerrada');
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  document.querySelectorAll('.input-modern').forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', () => {
      if (!input.value) {
        input.parentElement.classList.remove('focused');
      }
    });
    
    if (input.value) {
      input.parentElement.classList.add('focused');
    }
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  document.getElementById('close-inspector')?.addEventListener('click', () => {
    document.querySelector('[data-tab="users"]').click();
  });

  socket.on('connect', () => console.log('socket conectado', socket.id));
  socket.on('connect_error', (err) => console.error('socket connect_error', err));

  mensajeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('⌨️ Tecla Enter presionada');
      e.preventDefault();
      enviarMensaje(e);
    }
  });

  // ⭐⭐ NUEVO: Renderizado de usuarios con estado de conexión
  socket.on('actualizar-usuarios', (usuarios = []) => {
    userList.innerHTML = '';
    usersData = {};

    const usuariosConectados = usuarios.filter(u => u.online).length;
    const tituloUsuarios = document.querySelector('#users-tab h3');
    
    if (tituloUsuarios) {
        tituloUsuarios.innerHTML = `Usuarios Conectados 👤(${usuariosConectados})`;
    }
    
    usuarios.forEach(u => {
      const userKey = u.email;
      usersData[userKey] = u;

      if (u.username) {
        usersData[u.username] = u;
      }
      
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.flexDirection = 'column';
      li.style.gap = '6px';
      li.style.marginBottom = '8px';
      li.style.borderRadius = '8px';
      li.style.overflow = 'hidden';
      li.style.background = u.online ? '#f0f9ff' : '#fafafa';
      li.style.padding = '6px';
      li.style.cursor = 'pointer';
      li.style.borderLeft = u.online ? '4px solid #28a745' : '4px solid #6c757d';

      li.addEventListener('click', () => {
        inspeccionarPerfil(userKey);
      });

      const coverDiv = document.createElement('div');
      coverDiv.style.height = '60px';
      coverDiv.style.backgroundImage = `url(${u.cover || 'assets/default-cover.png'})`;
      coverDiv.style.backgroundSize = 'cover';
      coverDiv.style.backgroundPosition = 'center';
      coverDiv.style.position = 'relative';
      coverDiv.style.borderRadius = '6px';

      // ⭐⭐ NUEVO: Indicador de estado en línea
      if (u.online) {
        const onlineIndicator = document.createElement('div');
        onlineIndicator.style.width = '12px';
        onlineIndicator.style.height = '12px';
        onlineIndicator.style.backgroundColor = '#28a745';
        onlineIndicator.style.borderRadius = '50%';
        onlineIndicator.style.position = 'absolute';
        onlineIndicator.style.top = '8px';
        onlineIndicator.style.right = '8px';
        onlineIndicator.style.border = '2px solid #fff';
        onlineIndicator.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
        coverDiv.appendChild(onlineIndicator);
      }

      const avatar = document.createElement('img');
      avatar.src = u.avatar || 'assets/default-avatar.png';
      avatar.alt = u.username || u.email || 'Invitado';
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
      
      const nameDiv = document.createElement('div');
      nameDiv.textContent = u.username?.trim() ? u.username : u.email;
      nameDiv.style.fontWeight = '600';
      nameDiv.style.marginBottom = '5px';
      info.appendChild(nameDiv);

      // ⭐⭐ NUEVO: Mostrar estado de conexión
      const statusDiv = document.createElement('div');
      statusDiv.style.fontSize = '11px';
      statusDiv.style.fontWeight = '500';
      statusDiv.textContent = u.online ? '🟢 En línea' : '⚫ Desconectado';
      statusDiv.style.color = u.online ? '#28a745' : '#6c757d';
      info.appendChild(statusDiv);

      if (u.bio && u.bio !== 'Bienvenido a EcoChat') {
        const bio = document.createElement('div');
        bio.style.fontSize = '11px';
        bio.style.color = '#666';
        bio.style.marginTop = '5px';
        bio.style.fontStyle = 'italic';
        bio.textContent = u.bio.length > 30 ? u.bio.substring(0, 30) + '...' : u.bio;
        info.appendChild(bio);
      }

      li.appendChild(coverDiv);
      li.appendChild(info);
      userList.appendChild(li);
    });
  });

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
    div.style.cursor = 'pointer';

    div.addEventListener('click', () => {
      inspeccionarPerfil(m.usuario || m.email);
    });

    const avatarImg = document.createElement('img');
    avatarImg.src = m.avatar || 'assets/default-avatar.png';
    avatarImg.alt = m.username || m.usuario || m.email || 'Invitado';
    avatarImg.style.width = '40px';
    avatarImg.style.height = '40px';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.objectFit = 'cover';

    const contenido = document.createElement('div');
    const hora = new Date(m.fecha).toLocaleTimeString();
    const who = document.createElement('div');
    who.style.fontSize = '13px';
    who.style.fontWeight = '600';
    who.textContent = `${m.username || m.usuario || m.email || 'Invitado'} • ${hora}`;
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

  async function inspeccionarPerfil(usernameOrEmail) {
    let user = usersData[usernameOrEmail];
    
    if (!user) {
      user = Object.values(usersData).find(u => 
        u.email === usernameOrEmail || u.usuario === usernameOrEmail
      );
    }
    
    if (!user && usernameOrEmail.includes('@')) {
      try {
        const response = await fetch(`/user-by-email/${encodeURIComponent(usernameOrEmail)}`);
        if (response.ok) {
          user = await response.json();
          usersData[user.email] = user;
          usersData[user.username || user.email] = user;
        }
      } catch (error) {
        console.error('Error al obtener info del usuario:', error);
      }
    }
    
    if (user) {
      document.getElementById('inspector-username').textContent = user.username || user.usuario || user.email;
      document.getElementById('inspector-email').textContent = user.email || 'No disponible';
      document.getElementById('inspector-avatar').src = user.avatar || 'assets/default-avatar.png';
      document.getElementById('inspector-cover').src = user.cover || 'assets/default-cover.png';
      document.getElementById('inspector-messages').textContent = user.messageCount || '0';
      document.getElementById('inspector-lastseen').textContent = user.online ? 'En línea' : 'Desconectado';
      
      let bioElement = document.getElementById('inspector-bio');
      if (!bioElement) {
        bioElement = document.createElement('p');
        bioElement.id = 'inspector-bio';
        bioElement.style.margin = '10px 0';
        bioElement.style.fontStyle = 'italic';
        bioElement.style.color = '#6c757d';
        document.querySelector('.inspector-info').appendChild(bioElement);
      }
      
      bioElement.textContent = user.bio || 'Bienvenido a EcoChat';
      
      document.querySelector('[data-tab="profile"]').click();
    } else {
      alert('No se encontró información del usuario');
    }
  }

  socket.on('cargar-mensajes', (mensajes = []) => {
    chat.innerHTML = '';
    mensajes.forEach(agregarMensaje);
    scrollAbajo();
  });

  socket.on('nuevo-mensaje', (m) => {
    console.log('📩 Mensaje recibido del servidor:', {
      usuario: m.usuario,
      texto: m.texto,
      timestamp: new Date().toISOString()
    });
    agregarMensaje(m);
  });

  socket.on('avatar-actualizado', ({ usuario, username, avatar }) => {
    document.querySelectorAll('#chat img[alt]').forEach(img => {
      if (img.alt === username || img.alt === usuario) img.src = avatar || 'assets/default-avatar.png';
    });
  });

  registerBtn?.addEventListener('click', async () => {
    try {
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value.trim();
      const newUsername = document.getElementById('registerUsername').value.trim();
      const bio = document.getElementById('editBio').value.trim();
      
      if (!email || !password || !newUsername) return alert('Completa todos los campos');

      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username: newUsername, bio })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('Registrado. Ahora puedes iniciar sesión.');
        hideAuthForms();
      } else {
        alert(data.error || 'Error al registrar');
      }
    } catch (err) {
      console.error('register error', err);
      alert('Error en registro, mira la consola');
    }
  });

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
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error en login');
      }
      
      const data = await res.json();
      
      if (data.token) {
        localStorage.setItem('ecochat_token', data.token);
        localStorage.setItem('ecochat_user', JSON.stringify(data.user));

        token = data.token;
        userEmail = data.user.email;
        userId = data.user.id;
        username = data.user.username || data.user.email;
        userAvatar = data.user.avatar || 'assets/default-avatar.png';
        userCover = data.user.cover || 'assets/default-cover.png';
        userBio = data.user.bio || 'Bienvenido a EcoChat';

        authButtons.classList.add('hidden');
        authForms.classList.add('hidden');
        profileActions.classList.remove('hidden');
        
        document.getElementById('usernameDisplay').textContent = username;
        document.getElementById('editUsername').value = username || '';
        document.getElementById('avatarPreview').src = userAvatar;
        document.getElementById('coverPreview').src = userCover;
        document.getElementById('bio').textContent = userBio;

        // ⭐⭐ NUEVO: Emitir evento de usuario autenticado después del login
        socket.emit('user-authenticated', {
          id: userId,
          email: userEmail,
          username: username,
          avatar: userAvatar,
          cover: userCover,
          bio: userBio
        });

        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover,
          bio: userBio
        });
      }
    } catch (err) {
      console.error('login error', err);
      alert(err.message || 'Error en login');
    }
  });

  enviarBtn?.addEventListener('click', (e) => {
    console.log('🖱️ Click en botón enviar');
    enviarMensaje(e);
  });

  document.getElementById('subir-avatar')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('avatar');
    const file = fileInput.files[0];
    if (!file) return alert('Selecciona una imagen');
    if (!token) return alert('Inicia sesión para subir avatar');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        body: formData
      });
      
      const data = await res.json();
      if (data.avatar) {
        userAvatar = data.avatar;
        document.getElementById('avatarPreview').src = userAvatar;

        const updatedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
        updatedUser.avatar = userAvatar;
        localStorage.setItem('ecochat_user', JSON.stringify(updatedUser));

        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover,
          bio: userBio
        });
        
        alert('Avatar actualizado correctamente');
      } else {
        alert(data.error || 'Error al subir avatar');
      }
    } catch (err) {
      console.error('upload avatar error', err);
      alert('Error subiendo avatar');
    }
  });

  document.getElementById('subir-cover')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cover');
    const file = fileInput.files[0];
    if (!file) return alert('Selecciona una imagen de portada');
    if (!token) return alert('Inicia sesión para subir portada');

    const formData = new FormData();
    formData.append('cover', file);

    try {
      const res = await fetch('/upload-cover', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        body: formData
      });
      
      const data = await res.json();
      if (data.cover) {
        userCover = data.cover;
        document.getElementById('coverPreview').src = userCover;

        const updatedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
        updatedUser.cover = userCover;
        localStorage.setItem('ecochat_user', JSON.stringify(updatedUser));

        socket.emit('actualizar-estado', {
          id: userId,
          email: userEmail,
          username,
          avatar: userAvatar,
          cover: userCover,
          bio: userBio
        });
        
        alert('Portada actualizada correctamente');
      } else {
        alert(data.error || 'Error al subir portada');
      }
    } catch (err) {
      console.error('upload cover error', err);
      alert('Error subiendo portada');
    }
  });
});