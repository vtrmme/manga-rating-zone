// CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentAuthMode = 'login';
let searchTimeout = null;
let currentType = 'manga';

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        updateNav(user);
    });
    loadGridContent();
});

// NOTIFICACIONES TOAST
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    toast.style.background = type === 'error' ? '#e60012' : '#2e7d32';
    toast.style.color = '#fff';
    toast.style.padding = '10px 16px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '4px';
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// NAVEGACIÓN Y AUTENTICACIÓN
function updateNav(user) {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks) return;

    if (user) {
        navLinks.innerHTML = `
            <span class="user-display">${user.email}</span>
            <button class="btn-manga" onclick="openProfileModal()">Perfil</button>
            <button class="btn-manga" onclick="openFriendsModal()">Amigos</button>
            <button class="btn-manga" onclick="auth.signOut()">Salir</button>
        `;
    } else {
        navLinks.innerHTML = `
            <button class="btn-manga" onclick="auth.signInAnonymously()">Entrar Anónimo</button>
        `;
    }
}

// FUNCIONES DE MODALES Y BÚSQUEDA
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function switchType(type) {
    currentType = type;
    document.getElementById('btnManga').classList.toggle('active', type === 'manga');
    document.getElementById('btnAnime').classList.toggle('active', type === 'anime');
    loadGridContent();
}

function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadGridContent();
    }, 500);
}

async function loadGridContent() {
    const grid = document.getElementById('mangaGrid');
    if (!grid) return;
    grid.innerHTML = '<p class="manga-font">Cargando contenido...</p>';
}

// FUNCIONES DE PERFIL Y AMIGOS
async function openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('active');
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
            email: user.email || 'Anónimo',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast("Perfil actualizado.", "success");
        closeModal('profileModal');
    } catch (err) {
        showToast("Error al guardar perfil.", "error");
    }
}

async function openFriendsModal() {
    const modal = document.getElementById('friendsModal');
    if (modal) modal.classList.add('active');
}

async function searchUsers() {
    const resultsContainer = document.getElementById('userSearchResults');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '<p class="manga-font">BUSCANDO USUARIOS...</p>';
}
