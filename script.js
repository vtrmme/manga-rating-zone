// CONFIGURACIÓN OFICIAL FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC5UnHiP9fmBI9z8ENoyT78eNt-RrdLElc",
    authDomain: "manga-rating-zone.firebaseapp.com",
    projectId: "manga-rating-zone",
    storageBucket: "manga-rating-zone.firebasestorage.app",
    messagingSenderId: "893559216009",
    appId: "1:893559216009:web:1d67bfa20c1fb58746b358",
    measurementId: "G-DZVMEEFWR1"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const EMAIL_CREADOR = "mangaratingzone@gmail.com";

let currentType = 'anime';
let currentRating = 0;
let selectedItemId = null;
let currentAuthMode = 'login';
let searchTimeout = null;

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
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

function getFriendlyErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email': return 'El formato del correo no es válido.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Correo o contraseña incorrectos.';
        case 'auth/email-already-in-use': return 'Este correo ya está registrado.';
        case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
        default: return 'Ha ocurrido un error. Inténtalo de nuevo.';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        updateNav(user);
    });

    loadTopContent();
    loadSidebarsData();

    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') triggerSearch();
    });
});

async function updateNav(user) {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks) return;
    
    if (user) {
        let displayName = user.email;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists && doc.data().displayName) {
                displayName = doc.data().displayName;
            }
        } catch (e) {
            console.error("Error al obtener perfil", e);
        }

        navLinks.innerHTML = `
            <span class="user-display" title="${user.email}">${displayName}</span>
            <button class="btn-manga" onclick="openFriendsModal()">Amigos</button>
            <button class="btn-manga" onclick="openProfileModal()">Perfil</button>
            <button class="btn-manga" onclick="logout()">Salir</button>
        `;
    } else {
        navLinks.innerHTML = `
            <button class="btn-manga" onclick="openAuthModal('login')">Entrar</button>
            <button class="btn-manga" onclick="openAuthModal('register')">Registro</button>
        `;
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    try {
        if (currentAuthMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
            showToast("¡Sesión iniciada con éxito!", "success");
        } else {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(res.user.uid).set({
                email: email,
                displayName: email.split('@')[0],
                bio: '',
                favAnime: '',
                favManga: ''
            });
            showToast("¡Cuenta registrada con éxito!", "success");
        }
        closeModal('authModal');
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
    } catch (error) {
        showToast(getFriendlyErrorMessage(error.code), "error");
    }
}

function logout() {
    auth.signOut().then(() => {
        showToast("Has cerrado sesión.", "success");
    });
}

function switchType(type) {
    currentType = type;
    document.getElementById('btnTypeAnime').classList.toggle('active', type === 'anime');
    document.getElementById('btnTypeManga').classList.toggle('active', type === 'manga');
    
    const searchVal = document.getElementById('searchInput').value.trim();
    if (searchVal !== "") {
        triggerSearch();
    } else {
        loadTopContent();
    }
    loadTop3Sidebar();
}

// CARGAR DATOS LATERALES
async function loadSidebarsData() {
    loadLatestAnime();
    loadLatestManga();
    loadTop3Sidebar();
}

async function loadLatestAnime() {
    const box = document.getElementById('latestAnimeBox');
    try {
        const res = await fetch('https://kitsu.io/api/edge/anime?sort=-createdAt&page[limit]=1');
        const json = await res.json();
        if (json.data && json.data.length > 0) {
            const item = formatKitsuItem(json.data[0]);
            box.innerHTML = renderSideCard(item);
        }
    } catch (e) {
        box.innerHTML = '<p style="font-size:0.8rem;">No disponible</p>';
    }
}

async function loadLatestManga() {
    const box = document.getElementById('latestMangaBox');
    try {
        const res = await fetch('https://kitsu.io/api/edge/manga?sort=-createdAt&page[limit]=1');
        const json = await res.json();
        if (json.data && json.data.length > 0) {
            const item = formatKitsuItem(json.data[0]);
            box.innerHTML = renderSideCard(item);
        }
    } catch (e) {
        box.innerHTML = '<p style="font-size:0.8rem;">No disponible</p>';
    }
}

async function loadTop3Sidebar() {
    const box = document.getElementById('top3List');
    try {
        const res = await fetch(`https://kitsu.io/api/edge/${currentType}?sort=-averageRating&page[limit]=3`);
        const json = await res.json();
        if (json.data && json.data.length > 0) {
            box.innerHTML = '';
            json.data.forEach((raw, idx) => {
                const item = formatKitsuItem(raw);
                const div = document.createElement('div');
                div.className = 'top3-item';
                div.onclick = () => openDetailModal(item);
                div.innerHTML = `
                    <span class="top3-rank">${idx + 1}</span>
                    <img src="${item.images.jpg.large_image_url}" alt="${item.title}">
                    <div class="top3-info">
                        <div class="top3-info-title">${item.title}</div>
                        <div class="top3-info-score">★ ${item.score}</div>
                    </div>
                `;
                box.appendChild(div);
            });
        }
    } catch (e) {
        box.innerHTML = '<p style="font-size:0.8rem;">Error al cargar Top 3</p>';
    }
}

function formatKitsuItem(item) {
    return {
        mal_id: item.id,
        title: item.attributes.canonicalTitle || item.attributes.titles.en_jp,
        images: { jpg: { large_image_url: item.attributes.posterImage?.large || item.attributes.posterImage?.original } },
        score: item.attributes.averageRating ? (item.attributes.averageRating / 10).toFixed(1) : 'N/A',
        synopsis: item.attributes.synopsis,
        type: item.type ? item.type.toUpperCase() : currentType.toUpperCase(),
        youtubeVideoId: item.attributes.youtubeVideoId
    };
}

function renderSideCard(item) {
    return `
        <div class="side-card" onclick='openDetailModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
            <img src="${item.images.jpg.large_image_url}" alt="${item.title}">
            <div class="side-card-content">
                <div class="side-card-title">${item.title}</div>
            </div>
        </div>
    `;
}

// CARGA PRINCIPAL
async function loadTopContent() {
    const grid = document.getElementById('mangaGrid');
    const title = document.getElementById('gridTitle');
    title.innerText = `TOP ${currentType.toUpperCase()}S POPULARES`;
    grid.innerHTML = '<p class="manga-font" style="grid-column: 1/-1;">CARGANDO DATOS...</p>';

    try {
        const url = `https://kitsu.io/api/edge/${currentType}?page[limit]=12&sort=-userCount`;
        const res = await fetch(url);
        const json = await res.json();
        
        const formattedData = json.data.map(item => formatKitsuItem(item));
        renderGrid(formattedData);
    } catch (err) {
        grid.innerHTML = '<p style="grid-column: 1/-1;">Error de conexión con el servidor.</p>';
    }
}

async function triggerSearch() {
    const queryInput = document.getElementById('searchInput');
    const query = queryInput.value.trim();
    
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query) {
        loadTopContent();
        return;
    }

    const grid = document.getElementById('mangaGrid');
    const title = document.getElementById('gridTitle');
    title.innerText = `RESULTADOS PARA: "${query.toUpperCase()}"`;
    grid.innerHTML = '<p class="manga-font" style="grid-column: 1/-1;">BUSCANDO...</p>';

    searchTimeout = setTimeout(async () => {
        try {
            const url = `https://kitsu.io/api/edge/${currentType}?filter[text]=${encodeURIComponent(query)}&page[limit]=12`;
            const res = await fetch(url);
            
            if (!res.ok) throw new Error("Error en la API");

            const json = await res.json();
            
            if (!json.data || json.data.length === 0) {
                grid.innerHTML = '<p class="manga-font" style="grid-column: 1/-1;">No se encontraron resultados.</p>';
                return;
            }

            const formattedData = json.data.map(item => formatKitsuItem(item));
            renderGrid(formattedData);

        } catch (err) {
            grid.innerHTML = '<p class="manga-font" style="grid-column: 1/-1; color: #e60012;">Error al realizar la búsqueda.</p>';
        }
    }, 300);
}

function renderGrid(items) {
    const grid = document.getElementById('mangaGrid');
    grid.innerHTML = '';

    if (!items || items.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1;">No hay datos para mostrar.</p>';
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
            </div>
        `;
        grid.appendChild(card);
    });
}

function openDetailModal(item) {
    selectedItemId = item.mal_id;
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalImg').src = item.images?.jpg?.large_image_url;
    document.getElementById('modalSynopsis').innerText = item.synopsis || "Sinopsis no disponible.";
    document.getElementById('modalMalScore').innerText = item.score || "N/A";
    document.getElementById('modalGenres').innerText = item.type;

    const trailerContainer = document.getElementById('trailerContainer');
    if (item.youtubeVideoId) {
        trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${item.youtubeVideoId}" frameborder="0" allowfullscreen></iframe>`;
    } else {
        trailerContainer.innerHTML = '<div style="color:#fff; text-align:center; padding: 40px;">Trailer no disponible</div>';
    }

    setRating(0);
    document.getElementById('commentInput').value = '';

    loadReviewsFromFirestore(item.mal_id);
    document.getElementById('detailModal').classList.add('active');
}

async function openProfileModal() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('profName').value = data.displayName || '';
            document.getElementById('profBio').value = data.bio || '';
            document.getElementById('profFavAnime').value = data.favAnime || '';
            document.getElementById('profFavManga').value = data.favManga || '';
        }
    } catch (err) {
        showToast("Error al cargar perfil.", "error");
    }

    document.getElementById('profileModal').classList.add('active');
}

async function saveUserProfile(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).set({
            displayName: document.getElementById('profName').value.trim(),
            bio: document.getElementById('profBio').value.trim(),
            favAnime: document.getElementById('profFavAnime').value.trim(),
            favManga: document.getElementById('profFavManga').value.trim(),
            email: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast("Perfil actualizado.", "success");
        closeModal('profileModal');
        updateNav(user);
    } catch (err) {
        showToast("Error al guardar perfil.", "error");
    }
}

async function submitRating() {
    const user = auth.currentUser;
    if (!user) {
        showToast("Debes iniciar sesión.", "error");
        openAuthModal('login');
        return;
    }

    if (currentRating === 0) {
        showToast("Selecciona al menos 1 estrella.", "error");
        return;
    }

    const comment = document.getElementById('commentInput').value.trim();
    const itemTitle = document.getElementById('modalTitle').innerText;
    const itemCover = document.getElementById('modalImg').src;

    try {
        let authorName = user.email;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().displayName) {
            authorName = userDoc.data().displayName;
        }

        await db.collection('ratings').add({
            itemId: String(selectedItemId),
            itemType: currentType,
            itemTitle: itemTitle,
            itemCover: itemCover,
            userUid: user.uid,
            userName: authorName,
            userEmail: user.email,
            stars: currentRating,
            comment: comment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("Reseña publicada.", "success");
        document.getElementById('commentInput').value = '';
        setRating(0);
        loadReviewsFromFirestore(selectedItemId);
    } catch (error) {
        showToast("Error al guardar reseña.", "error");
    }
}

function loadReviewsFromFirestore(itemId) {
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.innerHTML = '<p>Cargando reseñas...</p>';

    db.collection('ratings')
      .where('itemId', '==', String(itemId))
      .get()
      .then((snapshot) => {
          reviewsList.innerHTML = '';
          if (snapshot.empty) {
              reviewsList.innerHTML = '<p style="font-size:0.85rem;">Sé el primero en opinar.</p>';
              return;
          }
          snapshot.forEach(doc => {
              const data = doc.data();
              const item = document.createElement('div');
              item.className = 'review-item';
              item.innerHTML = `
                  <div class="review-header">
                      <span>${data.userName || data.userEmail}</span>
                      <span>★ ${data.stars}/5</span>
                  </div>
                  <p style="font-size:0.9rem; margin-top:4px;">${data.comment || 'Sin reseña escrita.'}</p>
              `;
              reviewsList.appendChild(item);
          });
      })
      .catch((err) => {
          console.error("Error al cargar reseñas:", err);
          reviewsList.innerHTML = '<p>Error al cargar reseñas.</p>';
      });
}

// SISTEMA DE AMIGOS
function openFriendsModal() {
    if (!auth.currentUser) return;
    document.getElementById('userSearchInput').value = '';
    document.getElementById('userSearchResults').innerHTML = '';
    loadMyFriends();
    document.getElementById('friendsModal').classList.add('active');
}

async function searchUsers() {
    const query = document.getElementById('userSearchInput').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('userSearchResults');
    resultsContainer.innerHTML = '<p>Buscando usuarios...</p>';

    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }

    try {
        const snapshot = await db.collection('users').get();
        resultsContainer.innerHTML = '';
        
        let found = false;
        snapshot.forEach(doc => {
            if (auth.currentUser && doc.id === auth.currentUser.uid) return;

            const data = doc.data();
            const name = (data.displayName || '').toLowerCase();
            const email = (data.email || '').toLowerCase();

            if (name.includes(query) || email.includes(query)) {
                found = true;
                const div = document.createElement('div');
                div.className = 'user-item';
                div.innerHTML = `
                    <div class="user-item-info">
                        <span class="user-item-name">${data.displayName || 'Usuario'}</span>
                        <span class="user-item-email">${data.email}</span>
                    </div>
                    <button class="btn-manga" style="font-size:0.8rem; padding: 4px 8px;" onclick="addFriend('${doc.id}', '${data.displayName || data.email}')">Añadir</button>
                `;
                resultsContainer.appendChild(div);
            }
        });

        if (!found) {
            resultsContainer.innerHTML = '<p style="font-size:0.85rem;">No se encontraron usuarios.</p>';
        }
    } catch (err) {
        console.error("Error al buscar usuarios:", err);
        resultsContainer.innerHTML = '<p style="font-size:0.85rem; color:#e60012;">Error de permisos en Firebase. Revisa las reglas de Firestore.</p>';
    }
}

async function addFriend(friendUid, friendName) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).collection('friends').doc(friendUid).set({
            uid: friendUid,
            name: friendName,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`¡Añadido a ${friendName}!`, "success");
        loadMyFriends();
    } catch (err) {
        console.error("Error al añadir amigo:", err);
        showToast("Error al añadir amigo.", "error");
    }
}

async function loadMyFriends() {
    const user = auth.currentUser;
    const container = document.getElementById('friendsList');
    if (!user || !container) return;

    container.innerHTML = '<p>Cargando lista...</p>';

    try {
        const snapshot = await db.collection('users').doc(user.uid).collection('friends').get();
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<p style="font-size:0.85rem;">Aún no has añadido amigos.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'user-item';
            div.innerHTML = `
                <span class="user-item-name">${data.name}</span>
                <button class="btn-manga" style="font-size:0.8rem; padding: 4px 8px;" onclick="viewFriendProfile('${data.uid}')">Ver Perfil</button>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error al cargar amigos:", err);
        container.innerHTML = '<p style="font-size:0.85rem; color:#e60012;">Error al cargar amigos.</p>';
    }
}

async function viewFriendProfile(friendUid) {
    try {
        const userDoc = await db.collection('users').doc(friendUid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            document.getElementById('friendProfName').innerText = data.displayName || data.email;
            document.getElementById('friendProfBio').innerText = data.bio || 'Sin biografía.';
            document.getElementById('friendFavAnime').innerText = data.favAnime || 'Ninguno';
            document.getElementById('friendFavManga').innerText = data.favManga || 'Ninguno';
        }

        const reviewsContainer = document.getElementById('friendReviewsList');
        reviewsContainer.innerHTML = '<p>Cargando valoraciones...</p>';

        const ratingsSnapshot = await db.collection('ratings').where('userUid', '==', friendUid).get();
        reviewsContainer.innerHTML = '';

        if (ratingsSnapshot.empty) {
            reviewsContainer.innerHTML = '<p style="font-size:0.85rem;">Este usuario no ha hecho reseñas aún.</p>';
        } else {
            for (const doc of ratingsSnapshot.docs) {
                const r = doc.data();
                let title = r.itemTitle;
                let cover = r.itemCover;
                let type = r.itemType || 'anime';

                // Si la reseña es antigua y no guardó el título o la portada, los pedimos a Kitsu
                if (!title || !cover) {
                    try {
                        const res = await fetch(`https://kitsu.io/api/edge/anime/${r.itemId}`);
                        const json = await res.json();
                        if (json.data) {
                            const formatted = formatKitsuItem(json.data);
                            title = formatted.title;
                            cover = formatted.images.jpg.large_image_url;
                        } else {
                            const resManga = await fetch(`https://kitsu.io/api/edge/manga/${r.itemId}`);
                            const jsonManga = await resManga.json();
                            if (jsonManga.data) {
                                const formatted = formatKitsuItem(jsonManga.data);
                                title = formatted.title;
                                cover = formatted.images.jpg.large_image_url;
                                type = 'manga';
                            }
                        }
                    } catch (e) {
                        title = "Obra #" + r.itemId;
                        cover = "https://via.placeholder.com/60x90?text=No+Cover";
                    }
                }

                const div = document.createElement('div');
                div.className = 'review-item';
                div.style.cssText = "display: flex; gap: 10px; align-items: center; margin-bottom: 10px;";
                
                div.innerHTML = `
                    <img src="${cover}" alt="${title}" style="width: 50px; height: 70px; object-fit: cover; border: 1px solid #000; border-radius: 4px;">
                    <div style="flex: 1;">
                        <strong style="display: block; font-size: 0.9rem;">${title || 'Obra desconocida'}</strong>
                        <span style="font-size: 0.85rem; color: #ffb400;">★ ${r.stars}/5</span>
                        <p style="font-size:0.8rem; margin-top:2px; color: #333;">${r.comment || 'Sin reseña escrita.'}</p>
                    </div>
                    <button class="btn-manga" style="font-size: 0.75rem; padding: 4px 8px;" onclick="goToItem('${r.itemId}', '${type}')">Ver</button>
                `;
                reviewsContainer.appendChild(div);
            }
        }

        document.getElementById('friendProfileModal').classList.add('active');
    } catch (err) {
        console.error("Error al abrir perfil del amigo:", err);
        showToast("Error al abrir perfil del amigo.", "error");
    }
}

async function goToItem(itemId, itemType) {
    closeModal('friendProfileModal');
    closeModal('friendsModal');
    
    try {
        const res = await fetch(`https://kitsu.io/api/edge/${itemType}/${itemId}`);
        const json = await res.json();
        if (json.data) {
            const item = formatKitsuItem(json.data);
            openDetailModal(item);
        } else {
            showToast("No se pudo cargar la información de la obra.", "error");
        }
    } catch (e) {
        showToast("Error al conectar con la API.", "error");
    }
}

function setRating(val) {
    currentRating = val;
    const stars = document.querySelectorAll('#starRating .star');
    stars.forEach((star, index) => {
        star.classList.toggle('selected', index < val);
    });
}

function openAuthModal(mode) {
    currentAuthMode = mode;
    document.getElementById('authModalTitle').innerText = mode === 'login' ? "INICIAR SESIÓN" : "REGISTRARSE";
    document.getElementById('authSubmitBtn').innerText = mode === 'login' ? "ENTRAR" : "CREAR CUENTA";
    document.getElementById('authModal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'detailModal') {
        document.getElementById('trailerContainer').innerHTML = '';
    }
}

function sendCreatorEmail(e) {
    e.preventDefault();
    const title = document.getElementById('reqTitle').value;
    const desc = document.getElementById('reqDesc').value;
    const subject = encodeURIComponent(`Añadir Manga/Anime: ${title}`);
    const body = encodeURIComponent(`Solicitud para añadir la obra:\n\nTítulo: ${title}\nDetalles: ${desc}`);
    window.location.href = `mailto:${EMAIL_CREADOR}?subject=${subject}&body=${body}`;
}
