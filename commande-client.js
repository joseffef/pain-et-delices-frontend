/* ─────────────────────────────────────────────────
   VARIABLES GLOBALES
───────────────────────────────────────────────── */
const API    = window.API
const socket = window.socket

let userClient = JSON.parse(sessionStorage.getItem("user"))
if (!userClient || userClient.role !== "client") {
  window.location.href = "login.html"
}

let panier = {}              // { idProduit: { nom, prix, quantite, max } }
let modeLivraison = "retrait"
let tousLesProduits = []

/* ─────────────────────────────────────────────────
   SOCKET.IO — Temps réel
───────────────────────────────────────────────── */
socket.on("rafraichir_historique", () => {
  if (document.getElementById("onglet-historique").style.display !== "none") {
    chargerHistorique()
  }
})

/* ─────────────────────────────────────────────────
   INITIALISATION
───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hero-prenom").textContent = `${userClient.nom} 👋`
  chargerProduits()
  chargerInfosClient()
  document.getElementById("client-date").min = new Date().toISOString().split("T")[0]
})

/* ─────────────────────────────────────────────────
   PROFIL CLIENT (pré-remplissage formulaire)
───────────────────────────────────────────────── */
async function chargerInfosClient() {
  try {
    const res    = await fetch(`${API}/profil/${userClient.id}`)
    const profil = await res.json()
    document.getElementById("client-nom").value = profil.nom       || ""
    document.getElementById("client-tel").value = profil.telephone || ""
  } catch (err) {
    console.error("❌ Erreur chargement infos client:", err)
  }
}

/* ─────────────────────────────────────────────────
   CATALOGUE PRODUITS
───────────────────────────────────────────────── */
async function chargerProduits() {
  try {
    const res = await fetch(`${API}/produits`)
    tousLesProduits = await res.json()
    afficherCatalogue(tousLesProduits)
    construireFiltres()
  } catch (err) {
    console.error("Erreur chargement produits:", err)
  }
}

function construireFiltres() {
  const categories = [...new Set(tousLesProduits.map(p => p.categorie).filter(Boolean))]
  const container = document.getElementById("filtres-client")
  container.innerHTML = `<button class="filter-btn actif-filtre" onclick="filtrer('tous', this)">🍽️ Tous</button>`
  categories.forEach(cat => {
    container.innerHTML += `<button class="filter-btn" onclick="filtrer('${cat}', this)">${cat}</button>`
  })
}

function filtrer(categorie, btn) {
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("actif-filtre"))
  btn.classList.add("actif-filtre")
  const filtres = categorie === "tous"
    ? tousLesProduits
    : tousLesProduits.filter(p => p.categorie === categorie)
  afficherCatalogue(filtres)
}

function afficherCatalogue(produits) {
  const catalogue = document.getElementById("catalogue")
  catalogue.innerHTML = produits.map(p => {
    const enRupture = p.quantite <= 0
    return `
      <div class="product-card ${enRupture ? 'rupture' : ''}" data-id="${p.id}">
        <div class="product-img">
          <span>🥐</span>
          <span class="fait-maison">Fait Maison</span>
          <span class="badge-check">✓</span>
        </div>
        <div class="product-body">
          ${p.categorie ? `<div class="product-category">${p.categorie}</div>` : ''}
          <div class="product-name">${p.nom}</div>
          <div class="product-desc">${p.description || ''}</div>
          <div class="product-dispo ${enRupture ? 'rupture-label' : ''}">
            ${enRupture ? '❌ Rupture de stock' : `✅ ${p.quantite} disponibles`}
          </div>
          <div class="product-footer">
            <div class="product-price">${p.prix} DH</div>
            <button class="add-btn" ${enRupture ? 'disabled' : ''} onclick="ajouterAuPanier(${p.id})">+ Ajouter</button>
            <div class="qty-controls-card">
              <button class="qty-btn" onclick="modifierQte(${p.id}, -1)">−</button>
              <span class="qty-val" id="qte-${p.id}">${panier[p.id]?.quantite || 0}</span>
              <button class="qty-btn" onclick="modifierQte(${p.id}, 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    `
  }).join("")
  rafraichirSelection()
}

function ajouterAuPanier(idProduit) {
  const produit = tousLesProduits.find(p => p.id === idProduit)
  if (!produit || produit.quantite <= 0) return

  if (panier[idProduit]) {
    panier[idProduit].quantite++
  } else {
    panier[idProduit] = { nom: produit.nom, prix: produit.prix, quantite: 1, max: produit.quantite }
  }
  majAffichagePanier()
  rafraichirSelection()
  showNotif(produit.nom + ' ajouté ! 🎉')
}

function modifierQte(idProduit, delta) {
  if (!panier[idProduit]) return
  panier[idProduit].quantite += delta
  if (panier[idProduit].quantite <= 0) {
    delete panier[idProduit]
  } else if (panier[idProduit].quantite > panier[idProduit].max) {
    panier[idProduit].quantite = panier[idProduit].max
    showNotif("Stock maximum atteint pour ce produit")
  }
  majAffichagePanier()
  rafraichirSelection()
  renderCartModal()
}

function rafraichirSelection() {
  document.querySelectorAll(".product-card").forEach(carte => carte.classList.remove("selectionnee"))
  Object.keys(panier).forEach(id => {
    const qteSpan = document.getElementById(`qte-${id}`)
    if (qteSpan) {
      qteSpan.textContent = panier[id].quantite
      qteSpan.closest(".product-card").classList.add("selectionnee")
    }
  })
}

/* ─────────────────────────────────────────────────
   PANIER
───────────────────────────────────────────────── */
function majAffichagePanier() {
  const nbArticles = Object.values(panier).reduce((s, p) => s + p.quantite, 0)
  const total = Object.values(panier).reduce((s, p) => s + p.prix * p.quantite, 0)

  // Header count
  const hc = document.getElementById('cartCountHeader')
  hc.textContent = nbArticles
  hc.classList.toggle('visible', nbArticles > 0)

  // Float btn
  const fb = document.getElementById('cartFloat')
  fb.classList.toggle('visible', nbArticles > 0)
  document.getElementById('cartFloatCount').textContent = nbArticles

  document.getElementById('orderTotal').textContent = `${total} DH`
}

function renderCartModal() {
  const items = Object.entries(panier).filter(([,p]) => p.quantite > 0)
  const el = document.getElementById('cartItems')
  const sum = document.getElementById('cartSummary')

  if (items.length === 0) {
    el.innerHTML = `<div class="cart-empty"><div class="icon">🛒</div><p>Votre panier est vide</p></div>`
    sum.style.display = 'none'
    return
  }

  let totalVal = 0
  el.innerHTML = `<div class="cart-items">${items.map(([id, p]) => {
    totalVal += p.prix * p.quantite
    return `<div class="cart-item">
      <span class="cart-item-emoji">🥐</span>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.nom}</div>
        <div class="cart-item-price">${p.prix} DH × ${p.quantite} = ${p.prix * p.quantite} DH</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="modifierQte(${id}, -1)">−</button>
        <span class="qty-val">${p.quantite}</span>
        <button class="qty-btn" onclick="modifierQte(${id}, 1)">+</button>
      </div>
    </div>`
  }).join('')}</div>`

  document.getElementById('cartTotal').textContent = `${totalVal} DH`
  document.getElementById('orderTotal').textContent = `${totalVal} DH`
  sum.style.display = 'block'
}

function openCart(e) {
  if (e) e.preventDefault()
  renderCartModal()
  document.getElementById('cartOverlay').classList.add('open')
}
function closeCart(e) {
  if (e && e.target !== e.currentTarget) return
  document.getElementById('cartOverlay').classList.remove('open')
}
function openOrder() {
  if (Object.keys(panier).length === 0) { alert("Votre panier est vide !"); return }
  closeCart()
  document.getElementById('orderOverlay').classList.add('open')
}
function closeOrder(e) {
  if (e && e.target !== e.currentTarget) return
  document.getElementById('orderOverlay').classList.remove('open')
}

/* ─────────────────────────────────────────────────
   LIVRAISON
───────────────────────────────────────────────── */
function choisirLivraison(mode) {
  modeLivraison = mode
  document.getElementById("opt-retrait").classList.toggle("selectionnee", mode === "retrait")
  document.getElementById("opt-domicile").classList.toggle("selectionnee", mode === "domicile")
  document.getElementById("bloc-adresse").style.display = mode === "domicile" ? "block" : "none"
}

/* ─────────────────────────────────────────────────
   PASSER COMMANDE
───────────────────────────────────────────────── */
async function passerCommande() {
  if (Object.keys(panier).length === 0) {
    alert("Votre panier est vide !"); return
  }

  const nom     = document.getElementById("client-nom").value.trim()
  const tel     = document.getElementById("client-tel").value.trim()
  const date    = document.getElementById("client-date").value
  const notes   = document.getElementById("client-notes").value.trim()
  const adresse = document.getElementById("client-adresse").value.trim()

  if (!nom || !tel || !date) {
    alert("Merci de remplir le nom, le téléphone et la date de livraison."); return
  }
  if (modeLivraison === "domicile" && !adresse) {
    alert("Merci de renseigner l'adresse de livraison."); return
  }

  const produits = Object.entries(panier).map(([id, p]) => ({
    nom: p.nom, quantite: p.quantite, prix: p.prix
  }))

  try {
    const res = await fetch(`${API}/commandes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: nom,
        telephone: tel,
        date: date,
        statut: "En attente",
        notes: notes,
        livraison: modeLivraison,
        adresse_livraison: adresse,
        client_id: userClient.id,
        produits: produits
      })
    })

    if (!res.ok) throw new Error("Erreur serveur")

    socket.emit("nouvelle_commande")

    closeOrder()
    document.getElementById("catalogue-section").style.display = "none"
    document.getElementById("confirmation").style.display = "block"
    document.getElementById("confirmation-livraison").textContent =
      modeLivraison === "domicile" ? `🚚 Livraison prévue le ${date}` : `🏪 Retrait en magasin le ${date}`

    panier = {}
    majAffichagePanier()
    afficherCatalogue(tousLesProduits)
  } catch (err) {
    alert("Erreur lors de la commande : " + err.message)
  }
}

function nouvelleCommande() {
  document.getElementById("confirmation").style.display = "none"
  document.getElementById("catalogue-section").style.display = "block"
  document.getElementById("client-notes").value = ""
  document.getElementById("client-adresse").value = ""
}

/* ─────────────────────────────────────────────────
   ONGLETS
───────────────────────────────────────────────── */
function changerOnglet(onglet, event) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("actif"))
  if (event && event.target) event.target.classList.add("actif")

  document.getElementById("onglet-nouvelle").style.display   = onglet === "nouvelle"   ? "block" : "none"
  document.getElementById("onglet-historique").style.display = onglet === "historique" ? "block" : "none"
}

/* ─────────────────────────────────────────────────
   HISTORIQUE (avec Socket.io)
───────────────────────────────────────────────── */
async function chargerHistorique() {
  try {
    const res = await fetch(`${API}/commandes/client/${userClient.id}`)
    const commandes = await res.json()

    const enAttente = commandes.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return !["livrée", "livré", "annulée", "annulé"].includes(s)
    })

    const terminees = commandes.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return ["livrée", "livré", "annulée", "annulé"].includes(s)
    })

    document.getElementById("historique-en-attente").innerHTML = enAttente.length
      ? enAttente.map(renderCarteHistorique).join("")
      : `<div class="empty-state"><div class="empty-icon">🎉</div><p>Aucune commande en cours</p></div>`

    document.getElementById("historique-livre").innerHTML = terminees.length
      ? terminees.map(renderCarteHistorique).join("")
      : `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucun historique</p></div>`
  } catch (err) {
    console.error("Erreur historique:", err)
  }
}

function renderCarteHistorique(cmd) {
  const total = cmd.produits
    ? cmd.produits.reduce((s, p) => s + Number(p.prix) * Number(p.quantite), 0)
    : 0

  const statutNormalise = (cmd.statut || "").replace("Livré", "Livré").replace("Annulé", "Annulée")

  const couleurs = {
    "En attente": "orange",
    "Confirmée": "bleu",
    "En préparation": "bleu",
    "Livrée": "vert",
    "Annulée": "gris"
  }
  const couleur = couleurs[statutNormalise] || "orange"
  const produitsList = cmd.produits
    ? cmd.produits.map(p => `${p.nom} ×${p.quantite}`).join(", ")
    : ""

  let affichageCode = ""
  if (cmd.code_confirmation && !statutNormalise.toLowerCase().startsWith("livr") && statutNormalise !== "Annulée") {
    affichageCode = `
      <div class="code-confirmation">
        <div class="cc-label">🔑 Code de remise</div>
        <div class="cc-code">${cmd.code_confirmation}</div>
        <div class="cc-hint">À communiquer au livreur ou au caissier</div>
      </div>
    `
  }

  let affichageAnnulation = ""
  if (statutNormalise === "En attente") {
    const dateCreation = new Date(cmd.created_at)
    const maintenant = new Date()
    const delaiMs = maintenant - dateCreation
    const delaiMaxMs = 90 * 1000
    const delaiRestantMs = delaiMaxMs - delaiMs

    if (delaiRestantMs > 0) {
      const secondesRestantes = Math.ceil(delaiRestantMs / 1000)
      affichageAnnulation = `
        <button id="btn-annul-${cmd.id}" class="btn-annuler" onclick="annulerCommande(${cmd.id})">
          ❌ Annuler (${secondesRestantes}s)
        </button>
        <div class="annulation-hint" id="hint-annul-${cmd.id}">Annulation possible dans ${secondesRestantes}s</div>
      `
      setTimeout(() => lancerCompteurAnnulation(cmd.id, delaiRestantMs), 0)
    }
  }

  return `
    <div class="carte-commande">
      <div class="commande-header">
        <strong>Commande #${cmd.id}</strong>
        <span class="badge-statut ${couleur}">${statutNormalise}</span>
      </div>
      <div class="commande-produits">${produitsList}</div>
      ${affichageCode}
      <div class="commande-footer">
        <span>📅 ${cmd.date || new Date(cmd.created_at).toLocaleDateString('fr-FR')}</span>
        <span class="commande-total">${total} DH</span>
      </div>
      ${affichageAnnulation}
    </div>
  `
}

function lancerCompteurAnnulation(commandeId, delaiRestantMs) {
  let secondesRestantes = Math.ceil(delaiRestantMs / 1000)

  const intervalle = setInterval(() => {
    secondesRestantes--
    const btn = document.getElementById(`btn-annul-${commandeId}`)
    const hint = document.getElementById(`hint-annul-${commandeId}`)

    if (secondesRestantes <= 0) {
      clearInterval(intervalle)
      if (btn) {
        btn.disabled = true
        btn.textContent = "❌ Délai expiré"
      }
      if (hint) hint.textContent = "Annulation plus disponible"
    } else {
      if (btn) btn.textContent = `❌ Annuler (${secondesRestantes}s)`
      if (hint) hint.textContent = `Annulation possible dans ${secondesRestantes}s`
    }
  }, 1000)
}

async function annulerCommande(commandeId) {
  if (!confirm("Êtes-vous sûr d'annuler cette commande ? Le stock sera remis en attente.")) {
    return
  }

  try {
    const res = await fetch(`${API}/commandes/${commandeId}/annuler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })

    if (!res.ok) {
      const errData = await res.json()
      alert("Erreur : " + errData.erreur)
      return
    }

    showNotif("✅ Commande annulée avec succès !")
    chargerHistorique()
  } catch (err) {
    alert("Erreur lors de l'annulation : " + err.message)
  }
}

/* ─────────────────────────────────────────────────
   NOTIFICATION TOAST
───────────────────────────────────────────────── */
function showNotif(msg) {
  const n = document.getElementById('notif')
  n.textContent = msg
  n.classList.add('show')
  setTimeout(() => n.classList.remove('show'), 3000)
}