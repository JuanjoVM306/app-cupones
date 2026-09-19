let timerInterval = null;
let currentShuffleCoupons = [];
let isShuffling = false;

// --- NAVEGACIÓN Y PANTALLAS ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

// --- LOGICA DE LOGIN ---
async function handleLogin() {
  const input = document.getElementById('login-input').value.trim();

  // 1. Verificación Sensible a Mayúsculas para Admin
  if (input === window.ADMIN_PASS) {
    showScreen('screen-admin');
    listenAdminUsedCoupons();
    return;
  }

  // 2. Verificación Insensible a Mayúsculas para Nicol
  const cleanInput = input.toLowerCase();
  if (cleanInput === "nicol" || cleanInput === "nicol cuellar") {
    const userRef = window.fs.doc(window.db, "users", "nicol_state");
    const userSnap = await window.fs.getDoc(userRef);

    if (!userSnap.exists() || !userSnap.data().hasSeenInstructions) {
      showScreen('screen-first-instructions');
    } else {
      showScreen('screen-user-menu');
    }
  } else {
    alert("Nombre o clave incorrectos. Verifica e intenta de nuevo.");
  }
}

async function confirmFirstTimeInstructions() {
  const userRef = window.fs.doc(window.db, "users", "nicol_state");
  await window.fs.setDoc(userRef, { hasSeenInstructions: true }, { merge: true });
  showScreen('screen-user-menu');
}

// --- VERIFICACIÓN DE 24 HORAS & INICIO DE JUEGO ---
async function attemptStartDailyGame() {
  const userRef = window.fs.doc(window.db, "users", "nicol_state");
  
  window.fs.onSnapshot(userRef, async (docSnap) => {
    if (!docSnap.exists()) {
      launchDailyGame();
      return;
    }

    const data = docSnap.data();
    if (data.forceUnlocked) {
      clearInterval(timerInterval);
      launchDailyGame();
      return;
    }

    const lastPlay = data.lastPlayTimestamp ? data.lastPlayTimestamp.toDate() : null;
    if (lastPlay) {
      const now = new Date();
      const diffMs = (lastPlay.getTime() + (24 * 60 * 60 * 1000)) - now.getTime();

      if (diffMs > 0) {
        showScreen('screen-cooldown');
        startCooldownTimer(lastPlay.getTime() + (24 * 60 * 60 * 1000));
      } else {
        launchDailyGame();
      }
    } else {
      launchDailyGame();
    }
  });
}

function startCooldownTimer(targetTime) {
  clearInterval(timerInterval);
  function updateClock() {
    const now = new Date().getTime();
    const distance = targetTime - now;

    if (distance <= 0) {
      clearInterval(timerInterval);
      document.getElementById("timer-count").innerText = "00:00:00";
      showScreen('screen-user-menu');
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const pad = (n) => n.toString().padStart(2, '0');
    document.getElementById("timer-count").innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  updateClock();
  timerInterval = setInterval(updateClock, 1000);
}

// --- SELECCIÓN ALEATORIA: VERSO O 3 CUPONES ---
async function launchDailyGame() {
  // Registrar el momento de juego en Firebase y restablecer forceUnlocked
  const userRef = window.fs.doc(window.db, "users", "nicol_state");
  await window.fs.setDoc(userRef, { 
    lastPlayTimestamp: new Date(),
    forceUnlocked: false 
  }, { merge: true });

  const isPoemDay = Math.random() < 0.3; // 30% probabilidad verso, 70% cupones

  if (isPoemDay) {
    const poemSnap = await window.fs.getDocs(window.fs.collection(window.db, "poems"));
    let poems = [];
    poemSnap.forEach(d => poems.push(d.data()));
    
    if (poems.length > 0) {
      const selectedPoem = poems[Math.floor(Math.random() * poems.length)];
      document.getElementById("poem-content-area").innerHTML = `
        <h3>${selectedPoem.title}</h3>
        <p>${selectedPoem.content.replace(/\n/g, '<br>')}</p>
      `;
      showScreen('screen-reward-poem');
    } else {
      setupShuffleCardsGame();
    }
  } else {
    setupShuffleCardsGame();
  }
}

// --- JUEGO DE MEZCLA DE CARTAS (3 CUPONES) ---
async function setupShuffleCardsGame() {
  const couponsSnap = await window.fs.getDocs(window.fs.collection(window.db, "coupons"));
  let disponibles = [];

  couponsSnap.forEach(d => {
    const data = d.data();
    // Máximo 3 veces en las opciones y estado disponible
    if ((data.timesDrawn || 0) < 3 && data.status === "available") {
      disponibles.push({ id: d.id, ...data });
    }
  });

  if (disponibles.length < 3) {
    alert("No hay suficientes cupones disponibles en el sistema.");
    showScreen('screen-user-menu');
    return;
  }

  // Tomar 3 cupones al azar
  currentShuffleCoupons = disponibles.sort(() => 0.5 - Math.random()).slice(0, 3);

  // Incrementar el contador timesDrawn en Firebase para cada uno de los 3
  for (let c of currentShuffleCoupons) {
    const ref = window.fs.doc(window.db, "coupons", c.id);
    await window.fs.updateDoc(ref, { timesDrawn: (c.timesDrawn || 0) + 1 });
  }

  // Dibujar cartas boca arriba
  const container = document.getElementById("cards-container");
  container.innerHTML = "";
  const positions = [10, 140, 270];

  currentShuffleCoupons.forEach((coupon, idx) => {
    const card = document.createElement("div");
    card.className = "card-item";
    card.id = `card-${idx}`;
    card.style.left = `${positions[idx]}px`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          <strong>${coupon.title}</strong>
          <p style="font-size:0.75rem;">${coupon.description}</p>
        </div>
        <div class="card-back">💖</div>
      </div>
    `;

    card.onclick = () => selectCard(idx);
    container.appendChild(card);
  });

  document.getElementById("btn-start-shuffle").style.display = "block";
  document.getElementById("shuffle-subtitle").innerText = "Lee los 3 cupones y presiona continuar cuando estés lista.";
  showScreen('screen-shuffle-game');
}

// Animación de Mezcla tipo "Juego de los vasos"
function startShuffleProcess() {
  document.getElementById("btn-start-shuffle").style.display = "none";
  document.getElementById("shuffle-subtitle").innerText = "¡Presta atención a tu carta favorita!";
  isShuffling = true;

  // Voltear todas boca abajo
  document.querySelectorAll(".card-item").forEach(c => c.classList.add("flipped"));

  const positions = [10, 140, 270];
  let currentPos = [0, 1, 2];
  let swaps = 0;
  const maxSwaps = 8; // Número de intercambios

  const interval = setInterval(() => {
    // Intercambiar dos posiciones al azar
    let i = Math.floor(Math.random() * 3);
    let j = Math.floor(Math.random() * 3);
    while (i === j) j = Math.floor(Math.random() * 3);

    // Swap indices
    let temp = currentPos[i];
    currentPos[i] = currentPos[j];
    currentPos[j] = temp;

    // Aplicar nuevas posiciones CSS con velocidad visible
    document.getElementById(`card-${currentPos[i]}`).style.left = `${positions[i]}px`;
    document.getElementById(`card-${currentPos[j]}`).style.left = `${positions[j]}px`;

    swaps++;
    if (swaps >= maxSwaps) {
      clearInterval(interval);
      isShuffling = false;
      document.getElementById("shuffle-subtitle").innerText = "¡Elige tu carta!";
    }
  }, 450); // Velocidad moderada para poder seguir con la mirada
}

async function selectCard(index) {
  if (isShuffling) return;

  const card = document.getElementById(`card-${index}`);
  card.classList.remove("flipped");

  const chosenCoupon = currentShuffleCoupons[index];

  // Reclamar en Firebase
  const ref = window.fs.doc(window.db, "coupons", chosenCoupon.id);
  await window.fs.updateDoc(ref, { status: "claimed" });

  setTimeout(() => {
    alert(`¡Felicidades! Has ganado: ${chosenCoupon.title}. Guardado en tu inventario.`);
    showScreen('screen-user-menu');
  }, 600);
}

// --- INVENTARIO DE NICOL ---
async function loadInventory() {
  const container = document.getElementById("my-coupons-list");
  container.innerHTML = "Cargando...";

  const snap = await window.fs.getDocs(window.fs.collection(window.db, "coupons"));
  container.innerHTML = "";

  let count = 0;
  snap.forEach(d => {
    const item = { id: d.id, ...d.data() };
    if (item.status === "claimed" || item.status === "used") {
      count++;
      const isUsed = item.status === "used";
      const div = document.createElement("div");
      div.className = `coupon-display-card ${isUsed ? 'used' : ''}`;
      div.id = `inv-item-${item.id}`;

      div.innerHTML = `
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="action-area">
          ${isUsed 
            ? '<p style="color:red; font-weight:bold;">CUPÓN CANJEADO</p>' 
            : `<button class="btn" onclick="useCoupon('${item.id}', 'inv-item-${item.id}')">Usar y Enviar por WhatsApp</button>`
          }
        </div>
      `;
      container.appendChild(div);
    }
  });

  if (count === 0) {
    container.innerHTML = "<p>Aún no tienes cupones guardados.</p>";
  }
}

// Generación de imagen PNG para WhatsApp
async function useCoupon(couponId, elementId) {
  const cardElement = document.getElementById(elementId);
  const actionArea = cardElement.querySelector('.action-area');
  
  actionArea.style.display = 'none';

  const canvas = await html2canvas(cardElement);
  const imgData = canvas.toDataURL("image/png");

  const ref = window.fs.doc(window.db, "coupons", couponId);
  await window.fs.updateDoc(ref, { status: "used", usedAt: new Date().toISOString() });

  actionArea.style.display = 'block';
  actionArea.innerHTML = `
    <p style="color:red; font-weight:bold;">¡CUPÓN USADO!</p>
    <a href="${imgData}" download="cupon.png" class="btn">1. Descargar Foto</a><br>
    <a href="https://api.whatsapp.com/send?text=¡Hola!%20Quiero%20usar%20este%20cupón:" target="_blank" class="btn-ws">2. Abrir WhatsApp</a>
  `;
}

// --- ACCIONES DE ADMINISTRADOR ---
async function adminBypassCooldown() {
  const ref = window.fs.doc(window.db, "users", "nicol_state");
  await window.fs.updateDoc(ref, { forceUnlocked: true });
  alert("Acceso de 24 horas desbloqueado para Nicol.");
}

async function adminCreatePoem() {
  const title = document.getElementById("admin-poem-title").value.trim();
  const content = document.getElementById("admin-poem-body").value.trim();
  if (!title || !content) return alert("Completa todos los campos del verso.");

  await window.fs.addDoc(window.fs.collection(window.db, "poems"), { title, content });
  alert("Verso publicado correctamente.");
  document.getElementById("admin-poem-title").value = "";
  document.getElementById("admin-poem-body").value = "";
}

async function adminCreateCoupon() {
  const title = document.getElementById("admin-coupon-title").value.trim();
  const description = document.getElementById("admin-coupon-desc").value.trim();
  if (!title || !description) return alert("Completa todos los campos del cupón.");

  await window.fs.addDoc(window.fs.collection(window.db, "coupons"), {
    title, description, status: "available", timesDrawn: 0
  });
  alert("Cupón publicado correctamente.");
  document.getElementById("admin-coupon-title").value = "";
  document.getElementById("admin-coupon-desc").value = "";
}

function listenAdminUsedCoupons() {
  const container = document.getElementById("admin-used-coupons-list");
  
  window.fs.onSnapshot(window.fs.collection(window.db, "coupons"), (snap) => {
    container.innerHTML = "";
    let usedCount = 0;

    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      if (data.status === "used") {
        usedCount++;
        const div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.innerHTML = `
          <strong>${data.title}</strong>
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem; margin-left:10px;" onclick="returnCouponToAvailable('${data.id}')">Devolver Cupón</button>
        `;
        container.appendChild(div);
      }
    });

    if (usedCount === 0) container.innerHTML = "<p>No hay cupones usados actualmente.</p>";
  });
}

async function returnCouponToAvailable(couponId) {
  const ref = window.fs.doc(window.db, "coupons", couponId);
  await window.fs.updateDoc(ref, { status: "available", usedAt: null });
  alert("El cupón fue devuelto al estado disponible.");
}

// Modificar navegación de inventario para cargar datos
document.querySelectorAll('.btn').forEach(btn => {
  if (btn.innerText.includes("Mis Cupones Guardados")) {
    btn.addEventListener("click", loadInventory);
  }
});
