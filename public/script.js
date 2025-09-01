

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
  let userBio = 'Bienvenido a EcoChat'; // ← AÑADIR
  let usersData = {};

  // --- FUNCIONES DE INTERFAZ ---
  function showLoginForm() {
    authButtons.classList.add('hidden');
    authForms.classList.remove('hidden');
    // Mostrar solo el formulario de login
    document.querySelectorAll('.form-section').forEach(form => {
      form.style.display = 'none';
    });
    document.querySelectorAll('.form-section')[1].style.display = 'block'; // Login form
  }

  function showRegisterForm() {
    authButtons.classList.add('hidden');
    authForms.classList.remove('hidden');
    // Mostrar solo el formulario de registro
    document.querySelectorAll('.form-section').forEach(form => {
      form.style.display = 'none';
    });
    document.querySelectorAll('.form-section')[0].style.display = 'block'; // Register form
  }

  function hideAuthForms() {
    authForms.classList.add('hidden');
    authButtons.classList.remove('hidden');
    // Limpiar formularios
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
  }

  function hideProfileEdit() {
    profileEdit.classList.add('hidden');
    profileActions.classList.remove('hidden');
  }

  // --- Función para actualizar bio ---
  async function actualizarBio() {
    const nuevaBio = document.getElementById('editBio').value.trim();
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
        console.log('Bio actualizada 1:', userBio); // ← AÑADIR
        document.getElementById('bio').textContent = userBio;
        
        // Actualizar localStorage
        const updatedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
        updatedUser.bio = userBio;
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

  // --- Event listeners para los botones de UI ---
  showLoginBtn?.addEventListener('click', showLoginForm);
  showRegisterBtn?.addEventListener('click', showRegisterForm);
  cancelLoginBtn?.addEventListener('click', hideAuthForms);
  cancelRegisterBtn?.addEventListener('click', hideAuthForms);
  editProfileBtn?.addEventListener('click', showProfileEdit);
  cancelEditBtn?.addEventListener('click', hideProfileEdit);
  // ← AÑADIR AQUÍ el event listener para guardar bio
  document.getElementById('guardarBioBtn')?.addEventListener('click', actualizarBio);

  // --- AUTO-LOGIN AL CARGAR LA PÁGINA ---
  const savedToken = localStorage.getItem('ecochat_token');
  const savedUser = JSON.parse(localStorage.getItem('ecochat_user') || '{}');
  
  if (savedToken) {
    try {
      await autoLogin(savedToken, savedUser);
    } catch (error) {
      console.error('Error en auto-login:', error);
      logout(); // Limpiar datos inválidos
    }
  }

  // --- Función de Auto-Login ---
  async function autoLogin(savedToken, savedUser) {
    try {
      // Verificar token con el servidor
      const verifyRes = await fetch('/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      });

      if (!verifyRes.ok) {
        throw new Error('Token inválido');
      }

      const verifyData = await verifyRes.json();
      
      // Configurar variables de sesión
      token = savedToken;
      userId = verifyData.userId;
      userEmail = verifyData.email;
      username = verifyData.username || userEmail;
      userAvatar = verifyData.avatar || 'assets/default-avatar.png';
      userCover = verifyData.cover || 'assets/default-cover.png';
      userBio = verifyData.bio || 'Bienvenido a EcoChat'; // ← AÑADIR

      // Actualizar UI
      authButtons.classList.add('hidden');
      authForms.classList.add('hidden');
      profileActions.classList.remove('hidden');
      profileEdit.classList.add('hidden');
      
      document.getElementById('usernameDisplay').textContent = username;
      document.getElementById('avatarPreview').src = userAvatar;
      document.getElementById('coverPreview').src = userCover;
      console.log('Bio actualizada 2:', userBio); // ← AÑADIR
      document.getElementById('bio').textContent = userBio; // ← AÑADIR

      // Llenar el campo de edición de username
      document.getElementById('editUsername').value = username || '';

      // Actualizar estado en socket
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

  // --- Función de Logout ---
  function logout() {
    // Limpiar variables
    token = '';
    userId = '';
    userEmail = '';
    username = '';
    
    // Limpiar localStorage
    localStorage.removeItem('ecochat_token');
    localStorage.removeItem('ecochat_user');
    
    // Resetear UI
    authButtons.classList.remove('hidden');
    authForms.classList.add('hidden');
    profileActions.classList.add('hidden');
    profileEdit.classList.add('hidden');
    
    // Resetear perfil a invitado
    document.getElementById('usernameDisplay').textContent = 'Invitado';
    document.getElementById('avatarPreview').src = 'assets/default-avatar.png';
    document.getElementById('coverPreview').src = 'assets/default-cover.png';
    document.getElementById('editUsername').value = '';
    document.getElementById('bio').textContent = 'Bienvenido a EcoChat'; // ← AÑADIR
    
    // Resetear formularios
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerUsername').value = '';
    
    console.log('Sesión cerrada');
  }

  // --- Botón de Logout ---
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // --- Manejar inputs modernos ---
  document.querySelectorAll('.input-modern').forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', () => {
      if (!input.value) {
        input.parentElement.classList.remove('focused');
      }
    });
    
    // Inicializar estado
    if (input.value) {
      input.parentElement.classList.add('focused');
    }
  });

  // --- Sistema de tabs ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  // --- Cerrar inspector ---
  document.getElementById('close-inspector')?.addEventListener('click', () => {
    document.querySelector('[data-tab="users"]').click();
  });

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
    usersData = {}; // Limpiar datos anteriores
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
      li.style.background = '#fafafa';
      li.style.padding = '6px';
      li.style.cursor = 'pointer';

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
      info.textContent = u.username?.trim() ? u.username : u.email;

      // AÑADIR BIO A LA TARJETA DE USUARIO (opcional)
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

  // --- Función para inspeccionar perfil ---
async function inspeccionarPerfil(usernameOrEmail) {
  // Primero buscar en usersData
  let user = usersData[usernameOrEmail];
  
  // Si no encontramos al usuario, intentar buscar por email
  if (!user) {
    // Buscar por email en los valores de usersData
    user = Object.values(usersData).find(u => 
      u.email === usernameOrEmail || u.usuario === usernameOrEmail
    );
  }
  
  // Si todavía no encontramos, hacer petición al servidor
  if (!user && usernameOrEmail.includes('@')) {
    try {
      const response = await fetch(`/user-by-email/${encodeURIComponent(usernameOrEmail)}`);
      if (response.ok) {
        user = await response.json();
        // Guardar en usersData para futuras consultas
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
    document.getElementById('inspector-lastseen').textContent = 'En línea';
    
    // Asegurarse de que el elemento para la bio existe
    let bioElement = document.getElementById('inspector-bio');
    if (!bioElement) {
      bioElement = document.createElement('p');
      bioElement.id = 'inspector-bio';
      bioElement.style.margin = '10px 0';
      bioElement.style.fontStyle = 'italic';
      bioElement.style.color = '#6c757d';
      document.querySelector('.inspector-info').appendChild(bioElement);
    }
    
    // Mostrar la bio del usuario o el mensaje por defecto
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
    const bio = document.getElementById('editBio').value.trim(); // ← AÑADIR
    
    if (!email || !password || !newUsername) return alert('Completa todos los campos');

    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username: newUsername, bio }) // ← AÑADIR bio
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

// --- Login CORREGIDO ---
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
      // Guardar en localStorage
      localStorage.setItem('ecochat_token', data.token);
      localStorage.setItem('ecochat_user', JSON.stringify(data.user));

      // Usar los datos de la respuesta del login DIRECTAMENTE
      token = data.token;
      userEmail = data.user.email;
      userId = data.user.id;
      username = data.user.username || data.user.email;
      userAvatar = data.user.avatar || 'assets/default-avatar.png';
      userCover = data.user.cover || 'assets/default-cover.png';
      userBio = data.user.bio || 'Bienvenido a EcoChat';

      // Actualizar UI
      authButtons.classList.add('hidden');
      authForms.classList.add('hidden');
      profileActions.classList.remove('hidden');
      
      document.getElementById('usernameDisplay').textContent = username;
      document.getElementById('editUsername').value = username || '';
      document.getElementById('avatarPreview').src = userAvatar;
      document.getElementById('coverPreview').src = userCover;
      document.getElementById('bio').textContent = userBio;

      // Actualizar estado en socket
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

enviarBtn?.addEventListener('click', () => {
  if (!puedeEnviar) return;
  
  const texto = mensajeInput.value.trim();
  if (!texto) return;
  if (!socket || !socket.connected) return alert('Socket no conectado, recarga la página');
  
  puedeEnviar = false;
  enviarBtn.disabled = true;
  
  socket.emit('nuevo-mensaje', {
    usuario: userEmail || 'Invitado',
    username: username || 'Invitado',
    texto,
    avatar: userAvatar,
    cover: userCover,
    token
  });

  mensajeInput.value = '';
  charCountEl && (charCountEl.textContent = '0/200');
  
  // ⭐ AÑADIR: Rehabilitar después de 1 segundo
  setTimeout(() => {
    puedeEnviar = true;
    enviarBtn.disabled = false;
  }, 1000);
});

  // --- Subir avatar ---
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

        // Actualizar localStorage
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

  // --- Subir cover ---
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

        // Actualizar localStorage
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