// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC5UnHiP9fmBI9z8ENoyT78eNt-RrdLElc",
    authDomain: "manga-rating-zone.firebaseapp.com",
    projectId: "manga-rating-zone",
    storageBucket: "manga-rating-zone.firebasestorage.app",
    messagingSenderId: "893559216009",
    appId: "1:893559216009:web:1d67bfa20c1fb58746b358",
    measurementId: "G-DZVMEEFWR1"
};

// Inicialización de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const EMAIL_CREADOR = "mangaratingzone@gmail.com";

// ESTADO GLOBAL
let currentType = 'anime';
let currentRating = 0;
let selectedItemId = null;
let currentItemData = null; 
let currentAuthMode = 'login';

// NOTIFICACIONES PERSONALIZADAS (TOASTS)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `manga-toast ${type}`;
    toast.innerHTML = `<span>${type === 'error' ? '✖' : '✔'}</span> ${message}`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// MENSAJES DE ERROR TRADUCIDOS
function getFriendlyErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'El formato del correo no es válido.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Correo o contraseña incorrectos.';
        case 'auth/email-already-in-use':
            return 'Este correo ya está registrado.';
        case 'auth/weak-password':
            return 'La contraseña debe tener al menos 6 caracteres.';
        default:
            return 'Ha ocurrido un error. Inténtalo de nuevo.';
    }
}

// INICIALIZADOR
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            updateNav(user);
            loadFriends(user.uid);
        } else {
            updateNav(null);
        }
    });

    loadTopAnime();

    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') triggerSearch();
    });
});

// ACTUALIZAR BARRA DE NAVEGACIÓN (BUSCANDO EL NOMBRE DE USUARIO EN FIRESTORE)
async function updateNav(user) {
    const navLinks = document.getElementById('navLinks');
    if (user) {
        let displayName = user.email.split('@')[0]; // Valor por defecto provisional
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().username) {
                displayName = userDoc.data().username;
            }
        } catch (e) {
            console.error(e);
        }

        navLinks.innerHTML = `
            <span class="user-name-display">${displayName}</span>
            <button class="btn-manga" onclick="openProfileModal()">Mi Perfil</button>
            <button class="btn-manga" onclick="openFriendsModal()" style="background: #ffcc00;">Amigos</button>
            <button class="btn-manga btn-red" onclick="logout()">Salir</button>
        `;
    } else {
        navLinks.innerHTML = `
            <button class="btn-manga" onclick="openAuthModal('login')">Entrar</button>
            <button class="btn-manga btn-red" onclick="openAuthModal('register')">Registro</button>
        `;
    }
}

// AUTENTICACIÓN FIREBASE
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    try {
        if (currentAuthMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
            showToast("¡Bienvenido de nuevo!", "success");
        } else {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            const defaultUsername = email.split('@')[0];
            await db.collection('users').doc(cred.user.uid).set({
                email: email,
                username: defaultUsername,
                bio: "¡Nuevo otaku en la zona!"
            });
            showToast("¡Cuenta creada con éxito!", "success");
        }
        closeModal('authModal');
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
    } catch (error) {
        const cleanMsg = getFriendlyErrorMessage(error.code);
        showToast(cleanMsg, "error");
    }
}

function logout() {
    auth.signOut().then(() => {
        showToast("Has cerrado sesión.", "success");
    });
}

// GESTIÓN DE PERFILES (MODIFICAR NOMBRE Y BIO)
function openProfileModal() {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('profileUsername').value = data.username || '';
            document.getElementById('profileBio').value = data.bio || '';
        }
        document.getElementById('profileModal').classList.add('active');
    });
}

async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;

    const username = document.getElementById('profileUsername').value.trim();
    const bio = document.getElementById('profileBio').value.trim();

    if (!username) {
        showToast("El nombre de usuario no puede estar vacío.", "error");
        return;
    }

    try {
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            username: username,
            bio: bio
        }, { merge: true });

        showToast("¡Perfil actualizado con éxito!", "success");
        closeModal('profileModal');
        updateNav(user); // Refrescar el header con el nuevo nombre de usuario inmediatamente
    } catch (err) {
        showToast("Error al guardar el perfil.", "error");
    }
}

// SISTEMA DE AMIGOS (MODAL)
function openFriendsModal() {
    const user = auth.currentUser;
    if (!user) return;
    loadFriends(user.uid);
    document.getElementById('friendsModal').classList.add('active');
}

async function addFriend() {
    const user = auth.currentUser;
    if (!user) return;

    const friendUsername = document.getElementById('friendUsernameInput').value.trim();
    if (!friendUsername) return;

    try {
        const query = await db.collection('users').where('username', '==', friendUsername).get();
        if (query.empty) {
            showToast("No se encontró ningún usuario con ese nombre.", "error");
            return;
        }

        const friendDoc = query.docs[0];
        const friendId = friendDoc.id;

        if (friendId === user.uid) {
            showToast("No puedes agregarte a ti mismo.", "error");
            return;
        }

        const friendData = friendDoc.data();

        await db.collection('users').doc(user.uid).collection('friends').doc(friendId).set({
            username: friendData.username,
            uid: friendId
        });

        showToast("¡Amigo añadido correctamente!", "success");
        document.getElementById('friendUsernameInput').value = '';
        loadFriends(user.uid);
    } catch (err) {
        showToast("Error al añadir amigo.", "error");
    }
}

function loadFriends(uid) {
    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '<p style="font-size:0.85rem;">Cargando amigos...</p>';

    db.collection('users').doc(uid).collection('friends').get().then(snapshot => {
        friendsList.innerHTML = '';
        if (snapshot.empty) {
            friendsList.innerHTML = '<p style="font-size:0.85rem;">Aún no tienes amigos añadidos.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <span style="font-weight: bold;">${data.username}</span>
                <div>
                    <button class="btn-manga" style="font-size: 0.75rem; padding: 2px 6px;" onclick="viewFriendActivity('${data.uid}', '${data.username}')">Ver</button>
                    <button class="btn-manga btn-red" style="font-size: 0.75rem; padding: 2px 6px;" onclick="removeFriend('${data.uid}')">Eliminar</button>
                </div>
            `;
            friendsList.appendChild(item);
        });
    });
}

// ELIMINAR AMIGO
async function removeFriend(friendUid) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).collection('friends').doc(friendUid).delete();
        showToast("Amigo eliminado.", "success");
        loadFriends(user.uid);
        document.getElementById('friendActivityList').innerHTML = '<p style="font-size: 0.85rem;">Selecciona "Ver Actividad" en un amigo de tu lista.</p>';
    } catch (err) {
        showToast("Error al eliminar amigo.", "error");
    }
}

// VER VALORACIONES Y FAVORITOS DE UN AMIGO POR SU NOMBRE DE USUARIO
async function viewFriendActivity(friendUid, friendUsername) {
    const container = document.getElementById('friendActivityList');
    container.innerHTML = `<p style="font-size:0.85rem;">Cargando datos de ${friendUsername}...</p>`;

    try {
        const userDoc = await db.collection('users').doc(friendUid).get();
        if (!userDoc.exists) {
            container.innerHTML = `<p style="font-size:0.85rem;">Usuario no encontrado.</p>`;
            return;
        }
        const friendEmail = userDoc.data().email;

        const [ratingsSnap, favsSnap] = await Promise.all([
            db.collection('ratings').where('userEmail', '==', friendEmail).get(),
            db.collection('users').doc(friendUid).collection('favorites').get()
        ]);
        
        let html = `<p style="font-weight:bold; font-size:0.9rem; margin-bottom:8px; color:#e60012;">Usuario: ${friendUsername}</p>`;
        
        html += `<p style="font-weight:bold; font-size:0.85rem; text-decoration: underline;">Favoritos:</p>`;
        if (favsSnap.empty) {
            html += `<p style="font-size:0.8rem; margin-bottom:8px;">Sin animes/mangas favoritos.</p>`;
        } else {
            html += `<div style="display: flex; gap: 5px; overflow-x: auto; margin-bottom: 10px; padding-bottom: 5px;">`;
            favsSnap.forEach(doc => {
                const f = doc.data();
                html += `
                    <div style="min-width: 70px; text-align: center; font-size: 0.75rem;">
                        <img src="${f.image}" style="width: 50px; height: 70px; object-fit: cover; border: 1px solid #000;" />
                        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">${f.title}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `<p style="font-weight:bold; font-size:0.85rem; text-decoration: underline;">Valoraciones:</p>`;
        if (ratingsSnap.empty) {
            html += `<p style="font-size:0.8rem;">Este usuario aún no ha realizado valoraciones.</p>`;
        } else {
            ratingsSnap.forEach(doc => {
                const r = doc.data();
                html += `
                    <div class="review-item" style="margin-bottom: 5px;">
                        <div class="review-header"><span>Obra ID: ${r.itemId}</span><span>★ ${r.stars}/5</span></div>
                        <p style="font-size:0.8rem;">${r.comment || 'Sin comentario'}</p>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p style="font-size:0.85rem;">Error al cargar la actividad del amigo.</p>`;
    }
}

// CAMBIAR PESTAÑA ANIME / MANGA
function switchType(type) {
    currentType = type;
    document.getElementById('btnTypeAnime').classList.toggle('active', type === 'anime');
    document.getElementById('btnTypeManga').classList.toggle('active', type === 'manga');
    loadTopAnime();
}

// OBTENER TOP DE JIKAN API
async function loadTopAnime() {
    const grid = document.getElementById('mangaGrid');
    const title = document.getElementById('gridTitle');
    title.innerText = `TOP ${currentType.toUpperCase()}S POPULARES`;
    grid.innerHTML = '<p style="font-family: Bangers; font-size: 1.5rem;">Cargando contenido...</p>';

    try {
        const res = await fetch(`https://api.jikan.moe/v4/top/${currentType}?limit=12`);
        const data = await res.json();
        renderGrid(data.data);
    } catch (err) {
        grid.innerHTML = '<p>Error al conectar con el servidor.</p>';
        showToast("No se pudo cargar la lista.", "error");
    }
}

// BUSCADOR
async function triggerSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const grid = document.getElementById('mangaGrid');
    const title = document.getElementById('gridTitle');
    title.innerText = `RESULTADOS PARA: "${query.toUpperCase()}"`;
    grid.innerHTML = '<p style="font-family: Bangers; font-size: 1.5rem;">Buscando...</p>';

    try {
        const res = await fetch(`https://api.jikan.moe/v4/${currentType}?q=${encodeURIComponent(query)}&limit=12`);
        const data = await res.json();
        renderGrid(data.data);
    } catch (err) {
        grid.innerHTML = '<p>Error en la búsqueda.</p>';
        showToast("Error al realizar la búsqueda.", "error");
    }
}

// RENDERIZAR PARRILLA
function renderGrid(items) {
    const grid = document.getElementById('mangaGrid');
    grid.innerHTML = '';

    if (!items || items.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1;">No se han encontrado resultados.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'manga-card';
        card.onclick = () => openDetailModal(item);

        const img = item.images?.jpg?.large_image_url || 'https://via.placeholder.com/225x320?text=No+Cover';
        const score = item.score ? item.score : 'N/A';
        const typeName = item.type ? item.type : currentType.toUpperCase();

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${img}" alt="${item.title}">
                <span class="card-badge">${typeName}</span>
                <span class="card-score">★ ${score}</span>
            </div>
            <div class="card-content">
                <div class="card-title">${item.title}</div>
                <div class="card-info">${item.episodes ? item.episodes + ' Eps' : (item.chapters ? item.chapters + ' Caps' : '')}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ABRIR FICHA DETALLADA
function openDetailModal(item) {
    selectedItemId = item.mal_id;
    currentItemData = item;
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalImg').src = item.images?.jpg?.large_image_url;
    document.getElementById('modalSynopsis').innerText = item.synopsis || "Sinopsis no disponible.";
    document.getElementById('modalMalScore').innerText = item.score || "N/A";
    
    const genres = item.genres ? item.genres.map(g => g.name).join(', ') : '';
    document.getElementById('modalGenres').innerText = genres;

    const trailerContainer = document.getElementById('trailerContainer');
    if (item.trailer && item.trailer.embed_url) {
        trailerContainer.innerHTML = `<iframe src="${item.trailer.embed_url}" frameborder="0" allowfullscreen></iframe>`;
    } else {
        trailerContainer.innerHTML = '<div style="color:#fff; text-align:center; padding: 40px;">Trailer no disponible</div>';
    }

    setRating(0);
    document.getElementById('commentInput').value = '';

    loadReviewsFromFirestore(item.mal_id);
    checkIfFavorite(item.mal_id);

    document.getElementById('detailModal').classList.add('active');
}

// GESTIÓN DE FAVORITOS
async function checkIfFavorite(itemId) {
    const user = auth.currentUser;
    const btn = document.getElementById('favoriteBtn');
    if (!user) {
        btn.innerText = "★ Inicia sesión para favoritos";
        return;
    }

    try {
        const doc = await db.collection('users').doc(user.uid).collection('favorites').doc(itemId.toString()).get();
        if (doc.exists) {
            btn.innerText = "★ Quitar de Favoritos";
            btn.style.background = "#e60012";
            btn.style.color = "#fff";
        } else {
            btn.innerText = "★ Añadir a Favoritos";
            btn.style.background = "#ffcc00";
            btn.style.color = "#000";
        }
    } catch (err) {
        console.error(err);
    }
}

async function toggleFavorite() {
    const user = auth.currentUser;
    if (!user) {
        showToast("Inicia sesión para gestionar favoritos.", "error");
        openAuthModal('login');
        return;
    }

    const favRef = db.collection('users').doc(user.uid).collection('favorites').doc(selectedItemId.toString());

    try {
        const doc = await favRef.get();
        if (doc.exists) {
            await favRef.delete();
            showToast("Eliminado de favoritos.", "success");
        } else {
            await favRef.set({
                itemId: selectedItemId,
                title: currentItemData.title,
                image: currentItemData.images?.jpg?.large_image_url || '',
                type: currentType
            });
            showToast("¡Añadido a favoritos!", "success");
        }
        checkIfFavorite(selectedItemId);
    } catch (err) {
        showToast("Error al actualizar favoritos.", "error");
    }
}

// GUARDAR EN FIRESTORE (VALORACIONES)
async function submitRating() {
    const user = auth.currentUser;
    if (!user) {
        showToast("Inicia sesión para poder publicar.", "error");
        openAuthModal('login');
        return;
    }

    if (currentRating === 0) {
        showToast("Selecciona al menos 1 estrella.", "error");
        return;
    }

    const comment = document.getElementById('commentInput').value.trim();

    try {
        await db.collection('ratings').add({
            itemId: selectedItemId,
            userEmail: user.email,
            stars: currentRating,
            comment: comment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("¡Reseña publicada con éxito!", "success");
        document.getElementById('commentInput').value = '';
        setRating(0);
        loadReviewsFromFirestore(selectedItemId);
    } catch (error) {
        showToast("Error al guardar la reseña.", "error");
    }
}

// CARGAR RESEÑAS DESDE FIRESTORE
function loadReviewsFromFirestore(itemId) {
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.innerHTML = '<p>Cargando reseñas...</p>';

    db.collection('ratings')
      .where('itemId', '==', itemId)
      .get()
      .then((snapshot) => {
          reviewsList.innerHTML = '';
          if (snapshot.empty) {
              reviewsList.innerHTML = '<p style="font-size:0.85rem;">Sé el primero en valorar esta obra.</p>';
              return;
          }
          snapshot.forEach(doc => {
              const data = doc.data();
              const item = document.createElement('div');
              item.className = 'review-item';
              item.innerHTML = `
                  <div class="review-header">
                      <span>${data.userEmail}</span>
                      <span>★ ${data.stars}/5</span>
                  </div>
                  <p style="font-size:0.9rem; margin-top:4px;">${data.comment || 'Sin comentario textual.'}</p>
              `;
              reviewsList.appendChild(item);
          });
      })
      .catch(err => {
          reviewsList.innerHTML = '<p>Error al cargar reseñas.</p>';
      });
}

// SISTEMA DE VALORACIÓN CON ESTRELLAS
function setRating(val) {
    currentRating = val;
    const stars = document.querySelectorAll('#starRating .star');
    stars.forEach((star, index) => {
        if (index < val) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
}

// MANEJO DE MODALES
function openAuthModal(mode) {
    currentAuthMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authModalTitle');
    const btn = document.getElementById('authSubmitBtn');
    if (mode === 'login') {
        title.innerText = "INICIAR SESIÓN";
        btn.innerText = "ENTRAR";
    } else {
        title.innerText = "REGISTRARSE";
        btn.innerText = "CREAR CUENTA";
    }
    modal.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'detailModal') {
        document.getElementById('trailerContainer').innerHTML = '';
    }
}

// ENVIAR EMAIL AL CREADOR
function sendCreatorEmail(e) {
    e.preventDefault();
    const title = document.getElementById('reqTitle').value;
    const desc = document.getElementById('reqDesc').value;

    const subject = encodeURIComponent(`Solicitud para añadir Manga/Anime: ${title}`);
    const body = encodeURIComponent(`Hola,\n\nMe gustaría solicitar que añadas mi obra a la plataforma Manga Rating Zone:\n\nTítulo: ${title}\nDescripción / Detalles: ${desc}\n\n¡Muchas gracias!`);

    window.location.href = `mailto:${EMAIL_CREADOR}?subject=${subject}&body=${body}`;
}
