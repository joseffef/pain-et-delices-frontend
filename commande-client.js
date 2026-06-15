// Utiliser les variables globales de config.js
const API = window.API;
const socket = window.socket;

let userClient = JSON.parse(sessionStorage.getItem("user"))
if (!userClient || userClient.role !== "client") {
  window.location.href = "login.html"
}

let panier = {} // { idProduit: { nom, prix, quantite } }
let modeLivraison = "retrait"
let tousLesProduits = []

// ============================================
// SOCKET.IO — Temps réel
// ============================================


socket.on("rafraichir_historique", () => {
  console.log("🔄 Statut changé côté cuisine, on rafraîchit l'historique")
  if (document.getElementById("onglet-historique").style.display !== "none") {
    chargerHistorique()
  }
})

// ============================================
// INITIALISATION
// ============================================
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("texte-bienvenue").textContent = `Bonjour ${userClient.nom} 👋`
  chargerProduits()
  chargerInfosClient()
  document.getElementById("client-date").min = new Date().toISOString().split("T")[0]
})

// ============================================
// CHARGER INFOS CLIENT (pour pré-remplir + badge PRO)
// ============================================
async function chargerInfosClient() {
  try {
    const res = await fetch(`${API}/profil/${userClient.id}`)
    const profil = await res.json()

    console.log("📥 Profil chargé:", profil)

    // ✅ Pré-remplir le formulaire avec les infos du profil
    document.getElementById("client-nom").value = profil.nom || ""
    document.getElementById("client-tel").value = profil.telephone || ""

    // ✅ Plus de logique badge PRO, type_client ou ICE
  } catch (err) {
    console.error("❌ Erreur chargement infos client:", err)
  }
}

// ============================================
// CATALOGUE PRODUITS
// ============================================
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
  container.innerHTML = `<button class="btn-filtre actif-filtre" onclick="filtrer('tous', this)">Tous</button>`
  categories.forEach(cat => {
    container.innerHTML += `<button class="btn-filtre" onclick="filtrer('${cat}', this)">${cat}</button>`
  })
}

function filtrer(categorie, btn) {
  document.querySelectorAll(".btn-filtre").forEach(b => b.classList.remove("actif-filtre"))
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
      <div class="carte-client ${enRupture ? 'rupture' : ''}" onclick="${enRupture ? '' : `ajouterAuPanier(${p.id})`}">
        <span class="badge-selection">✓</span>
        <span class="produit-icone">🥐</span>
        <h3>${p.nom}</h3>
        <p class="description-produit">${p.description || ''}</p>
        <span class="prix">${p.prix} DH</span>
        <span class="dispo">${enRupture ? '❌ Rupture de stock' : `✅ ${p.quantite} disponibles`}</span>
        <div class="qte-controle">
          <button class="btn-qte" onclick="event.stopPropagation(); modifierQte(${p.id}, -1)">−</button>
          <span class="qte-valeur" id="qte-${p.id}">${panier[p.id]?.quantite || 0}</span>
          <button class="btn-qte" onclick="event.stopPropagation(); modifierQte(${p.id}, 1)">+</button>
        </div>
      </div>
    `
  }).join("")

  // Réappliquer la classe "selectionnee" aux produits déjà dans le panier
  Object.keys(panier).forEach(id => {
    const carte = catalogue.querySelector(`.carte-client:nth-child(${Array.from(catalogue.children).findIndex(c => c.onclick?.toString().includes(id)) + 1})`)
  })
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
}

function modifierQte(idProduit, delta) {
  event.stopPropagation()
  if (!panier[idProduit]) return

  panier[idProduit].quantite += delta
  if (panier[idProduit].quantite <= 0) {
    delete panier[idProduit]
  } else if (panier[idProduit].quantite > panier[idProduit].max) {
    panier[idProduit].quantite = panier[idProduit].max
    alert("Stock maximum atteint pour ce produit")
  }
  majAffichagePanier()
  rafraichirSelection()
}

function rafraichirSelection() {
  document.querySelectorAll(".carte-client").forEach(carte => carte.classList.remove("selectionnee"))
  // On ré-affiche le catalogue pour mettre à jour les quantités
  const catalogue = document.getElementById("catalogue")
  Object.keys(panier).forEach(id => {
    const qteSpan = document.getElementById(`qte-${id}`)
    if (qteSpan) {
      qteSpan.textContent = panier[id].quantite
      qteSpan.closest(".carte-client").classList.add("selectionnee")
    }
  })
}

// ============================================
// PANIER
// ============================================
function majAffichagePanier() {
  const nbArticles = Object.values(panier).reduce((s, p) => s + p.quantite, 0)
  const total = Object.values(panier).reduce((s, p) => s + p.prix * p.quantite, 0)

  document.getElementById("nb-articles").textContent = nbArticles
  document.getElementById("btn-panier-fixe").style.display = nbArticles > 0 ? "block" : "none"

  const lignes = document.getElementById("lignes-panier")
  lignes.innerHTML = Object.entries(panier).map(([id, p]) => `
    <div class="ligne-panier">
      <span>${p.nom} × ${p.quantite}</span>
      <span><strong>${p.prix * p.quantite} DH</strong>
      <button onclick="modifierQte(${id}, -1)" style="background:none;border:none;color:#8B4513;cursor:pointer;margin-left:8px">✕</button></span>
    </div>
  `).join("")

  document.getElementById("total-panier").textContent = `Total : ${total} DH`
  document.getElementById("panier").style.display = nbArticles > 0 ? "block" : "none"
}

function scrollPanier() {
  document.getElementById("panier").scrollIntoView({ behavior: "smooth" })
}

// ============================================
// LIVRAISON
// ============================================
function choisirLivraison(mode) {
  modeLivraison = mode
  document.getElementById("opt-retrait").classList.toggle("selectionnee", mode === "retrait")
  document.getElementById("opt-domicile").classList.toggle("selectionnee", mode === "domicile")
  document.getElementById("bloc-adresse").style.display = mode === "domicile" ? "block" : "none"
}

// ============================================
// PASSER COMMANDE
// ============================================
async function passerCommande() {
  if (Object.keys(panier).length === 0) {
    alert("Votre panier est vide !"); return
  }

  const nom = document.getElementById("client-nom").value.trim()
  const tel = document.getElementById("client-tel").value.trim()
  const date = document.getElementById("client-date").value
  const notes = document.getElementById("client-notes").value.trim()
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

    // ✅ Notifier la cuisine en temps réel
    socket.emit("nouvelle_commande")

    // Afficher confirmation
    document.getElementById("onglet-nouvelle").style.display = "none"
    document.getElementById("confirmation").style.display = "block"
    document.getElementById("confirmation-livraison").textContent =
      modeLivraison === "domicile" ? `🚚 Livraison prévue le ${date}` : `🏪 Retrait en magasin le ${date}`

    // Vider le panier
    panier = {}
    majAffichagePanier()
  } catch (err) {
    alert("Erreur lors de la commande : " + err.message)
  }
}

function nouvelleCommande() {
  document.getElementById("confirmation").style.display = "none"
  document.getElementById("onglet-nouvelle").style.display = "block"
  document.getElementById("client-notes").value = ""
  document.getElementById("client-adresse").value = ""
}

// ============================================
// HISTORIQUE (avec Socket.io)
// ============================================
function changerOnglet(onglet) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("actif"))
  event.target.classList.add("actif")

  document.getElementById("onglet-nouvelle").style.display = onglet === "nouvelle" ? "block" : "none"
  document.getElementById("onglet-historique").style.display = onglet === "historique" ? "block" : "none"

  if (onglet === "historique") chargerHistorique()
}

async function chargerHistorique() {
  try {
    const res = await fetch(`${API}/commandes/client/${userClient.id}`)
    const commandes = await res.json()

    console.log("📋 Commandes reçues:", commandes) // Log de debug

    // ✅ Accepte "Livrée" ET "Livré" (tolérance aux deux orthographes)
    const enAttente = commandes.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return !["livrée", "livré", "annulée", "annulé"].includes(s)
    })
    
    const terminees = commandes.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return ["livrée", "livré", "annulée", "annulé"].includes(s)
    })

    console.log("⏳ En attente:", enAttente.length, "| ✅ Terminées:", terminees.length)

    document.getElementById("historique-en-attente").innerHTML = enAttente.length
      ? enAttente.map(renderCarteHistorique).join("")
      : `<p style="color:#999;text-align:center;padding:20px">Aucune commande en cours 🎉</p>`

    document.getElementById("historique-livre").innerHTML = terminees.length
      ? terminees.map(renderCarteHistorique).join("")
      : `<p style="color:#999;text-align:center;padding:20px">Aucun historique</p>`
  } catch (err) {
    console.error("Erreur historique:", err)
  }
}

function renderCarteHistorique(cmd) {
  // Convertir les prix en nombres
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

  // ❌ SUPPRESSION DU BOUTON FACTURE

  let affichageCode = "";
  if (cmd.code_confirmation && !statutNormalise.toLowerCase().startsWith("livr") && statutNormalise !== "Annulée") {
    affichageCode = `
      <div style="background:#fff3cd; border:1px solid #ffeaa7; padding:10px; border-radius:8px; margin-top:10px; text-align:center;">
        <strong>🔑 Code de remise :</strong> 
        <span style="font-size:24px; font-weight:bold; color:#d63031; letter-spacing:3px;">${cmd.code_confirmation}</span>
        <br><small style="color:#666">À communiquer au livreur ou au caissier</small>
      </div>
    `;
  }

  // ✅ NOUVEAU : Afficher le bouton d'annulation avec compteur si la commande est en attente et dans le délai
  let affichageAnnulation = "";
  if (statutNormalise === "En attente") {
    const dateCreation = new Date(cmd.created_at);
    const maintenant = new Date();
    const delaiMs = maintenant - dateCreation;
    const delaiMaxMs = 90 * 1000; // 1min30
    const delaiRestantMs = delaiMaxMs - delaiMs;
    
    if (delaiRestantMs > 0) {
      const secondesRestantes = Math.ceil(delaiRestantMs / 1000);
      affichageAnnulation = `
        <div style="margin-top:10px;">
          <button id="btn-annul-${cmd.id}" onclick="annulerCommande(${cmd.id})" style="background:#d63031;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;width:100%;font-weight:bold;">
            ❌ Annuler (${secondesRestantes}s)
          </button>
          <small style="display:block;color:#666;text-align:center;margin-top:4px;font-style:italic;">Annulation possible dans ${secondesRestantes}s</small>
        </div>
      `;
      
      // ✅ Lancer le compteur
      lancerCompteurAnnulation(cmd.id, delaiRestantMs);
    }
  }

  return `
    <div class="carte-commande-client">
      <div class="commande-client-header">
        <strong>Commande #${cmd.id}</strong>
        <span class="badge ${couleur}">${statutNormalise}</span>
      </div>
      <div class="commande-client-produits">${produitsList}</div>
      ${affichageCode} <!-- ✅ AJOUT ICI -->
      <div class="commande-client-footer">
        <span>📅 ${cmd.date || new Date(cmd.created_at).toLocaleDateString('fr-FR')}</span>
        <span class="commande-client-total">${total} DH</span>
      </div>
      ${affichageAnnulation}
    </div>
  `
}

// ✅ NOUVEAU : Compteur régressif pour l'annulation
function lancerCompteurAnnulation(commandeId, delaiRestantMs) {
  let secondesRestantes = Math.ceil(delaiRestantMs / 1000);
  
  const intervalle = setInterval(() => {
    secondesRestantes--;
    const btn = document.getElementById(`btn-annul-${commandeId}`);
    const small = btn?.nextElementSibling;
    
    if (secondesRestantes <= 0) {
      clearInterval(intervalle);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.textContent = "❌ Délai expiré";
      }
      if (small) small.textContent = "Annulation plus disponible";
    } else {
      if (btn) btn.textContent = `❌ Annuler (${secondesRestantes}s)`;
      if (small) small.textContent = `Annulation possible dans ${secondesRestantes}s`;
    }
  }, 1000);
}

// ✅ NOUVEAU : Fonction d'annulation
async function annulerCommande(commandeId) {
  if (!confirm("Êtes-vous sûr d'annuler cette commande ? Le stock sera remis en attente.")) {
    return;
  }

  try {
    const res = await fetch(`${API}/commandes/${commandeId}/annuler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const errData = await res.json();
      alert("Erreur : " + errData.erreur);
      return;
    }

    alert("✅ Commande annulée avec succès ! Le stock a été remis.");
    chargerHistorique(); // Rafraîchir l'historique
  } catch (err) {
    alert("Erreur lors de l'annulation : " + err.message);
  }
}
