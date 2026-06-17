// Utiliser les variables globales de config.js
const API = window.API;
const socket = window.socket;
let userClient = JSON.parse(sessionStorage.getItem("user"))
if (!userClient || !["client", "admin"].includes(userClient.role)) {
  window.location.href = "login.html"
}

// ==========================
// Admin / page commandes helpers
// ==========================
let formModeLivraison = "retrait"

function toggleFormulaire() {
  const f = document.getElementById("formulaire")
  if (!f) return
  
  if (f.style.display === "none" || getComputedStyle(f).display === "none") {
    f.style.display = "block"
    formModeLivraison = "retrait"
    
    // Réinitialiser le sélecteur de livraison
    const r = document.getElementById('form-opt-retrait')
    const d = document.getElementById('form-opt-domicile')
    if (r) r.style.border = '2px solid #8B4513'
    if (d) d.style.border = '2px solid #ddd'
    
    const bloc = document.getElementById('form-bloc-adresse')
    if (bloc) {
      bloc.style.display = 'none'
      bloc.style.visibility = 'hidden'
    }
    
    // ensure at least one product line
    if (!document.querySelectorAll('#liste-produits-commande .ligne-produit').length) {
      ajouterLigneProduit()
    }
  } else {
    f.style.display = "none"
  }
}

async function ensureProduitsLoaded() {
  if (tousLesProduits && tousLesProduits.length) return
  try {
    const res = await fetch(`${API}/produits`)
    tousLesProduits = await res.json()
  } catch (err) {
    console.error('Erreur chargement produits (admin):', err)
    tousLesProduits = []
  }
}

function toggleFormulaire() {
  const f = document.getElementById("formulaire")
  if (!f) return
  if (f.style.display === "none" || getComputedStyle(f).display === "none") {
    f.style.display = "block"
    formModeLivraison = "retrait"
    // Réinitialiser le sélecteur de livraison
    const r = document.getElementById('form-opt-retrait')
    const d = document.getElementById('form-opt-domicile')
    if (r) r.style.border = '2px solid #8B4513'
    if (d) d.style.border = '2px solid #ddd'
    const bloc = document.getElementById('form-bloc-adresse')
    if (bloc) bloc.style.display = 'none'
    // ensure at least one product line
    if (!document.querySelectorAll('#liste-produits-commande .ligne-produit').length) {
      ajouterLigneProduit()
    }
  } else {
    f.style.display = "none"
  }
}

async function ajouterLigneProduit() {
  await ensureProduitsLoaded()
  const container = document.getElementById('liste-produits-commande')
  if (!container) return

  const ligne = document.createElement('div')
  ligne.className = 'ligne-produit'
  ligne.style.display = 'flex'
  ligne.style.gap = '8px'
  ligne.style.marginTop = '8px'

  const select = document.createElement('select')
  select.style.flex = '1'
  tousLesProduits.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = `${p.nom} (${p.quantite} dispo)`
    select.appendChild(opt)
  })

  const qte = document.createElement('input')
  qte.type = 'number'
  qte.min = 1
  qte.value = 1
  qte.style.width = '80px'

  const btnSuppr = document.createElement('button')
  btnSuppr.type = 'button'
  btnSuppr.textContent = '✕'
  btnSuppr.style.background = 'none'
  btnSuppr.style.border = 'none'
  btnSuppr.style.color = '#8B4513'
  btnSuppr.style.cursor = 'pointer'
  btnSuppr.onclick = () => ligne.remove()

  ligne.appendChild(select)
  ligne.appendChild(qte)
  ligne.appendChild(btnSuppr)
  container.appendChild(ligne)
}

function choisirLivraisonForm(mode) {
  formModeLivraison = mode
  const r = document.getElementById('form-opt-retrait')
  const d = document.getElementById('form-opt-domicile')
  
  if (r) r.style.border = mode === 'retrait' ? '2px solid #8B4513' : '2px solid #ddd'
  if (d) d.style.border = mode === 'domicile' ? '2px solid #8B4513' : '2px solid #ddd'
  
  const bloc = document.getElementById('form-bloc-adresse')
  if (bloc) {
    bloc.style.display = mode === 'domicile' ? 'block' : 'none'
    bloc.style.visibility = mode === 'domicile' ? 'visible' : 'hidden'
  }
  
  console.log(`Mode sélectionné: ${mode}, bloc display: ${bloc.style.display}`)
}

async function ajouterCommande() {
  const client = (document.getElementById('input-client') || {}).value?.trim() || ''
  const telephone = (document.getElementById('input-telephone') || {}).value?.trim() || ''
  const date = (document.getElementById('input-date') || {}).value || ''
  const notes = (document.getElementById('input-notes') || {}).value?.trim() || ''
  const adresse = (document.getElementById('input-adresse') || {}).value?.trim() || ''

  if (!client || !telephone || !date) {
    alert('Merci de remplir le nom, le téléphone et la date de livraison.')
    return
  }

  const lignes = Array.from(document.querySelectorAll('#liste-produits-commande .ligne-produit'))
  const produits = []
  for (const l of lignes) {
    const sel = l.querySelector('select')
    const q = l.querySelector('input[type=number]')
    if (!sel || !q) continue
    produits.push({ nom: (tousLesProduits.find(p => p.id == sel.value) || {}).nom || sel.options[sel.selectedIndex].text, quantite: Number(q.value), prix: (tousLesProduits.find(p => p.id == sel.value) || {}).prix || 0 })
  }

  if (produits.length === 0) {
    alert('Ajoutez au moins un produit.')
    return
  }

  try {
    const res = await fetch(`${API}/commandes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client, telephone, date, statut: 'En attente', notes, livraison: formModeLivraison, adresse_livraison: adresse, origine: 'admin', produits
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.erreur || 'Erreur serveur')
      return
    }
    // succès
    // succès
    const data = await res.json()
    const code = data.code
    alert(`✅ Commande ajoutée !\n\n🔑 Code de confirmation : ${code}\n\nCommuniquer ce code au client.`)
    const f = document.getElementById('formulaire')
    if (f) f.style.display = 'none'
    // rafraîchir la liste des commandes si la fonction existe
    if (typeof chargerCommandes === 'function') chargerCommandes()
    socket.emit('nouvelle_commande')
  } catch (err) {
    alert('Erreur lors de l\'enregistrement : ' + err.message)
  }
}
let panier = {}
let modeLivraison = "retrait"
let tousLesProduits = []

// ============================================
// CHARGER COMMANDES (Admin)
// ============================================
async function chargerCommandes() {
  try {
    const res = await fetch(`${API}/commandes`)
    const commandes = await res.json()
    const container = document.getElementById('liste-commandes')
    if (!container) return

    if (!commandes.length) {
      container.innerHTML = '<p style="text-align:center;color:#999;padding:20px">Aucune commande</p>'
      return
    }

    container.innerHTML = commandes.map(cmd => {
      const total = cmd.produits
        ? cmd.produits.reduce((s, p) => s + Number(p.prix) * Number(p.quantite), 0)
        : 0
      const produitsList = cmd.produits
        ? cmd.produits.map(p => `${p.nom} ×${p.quantite}`).join(", ")
        : ""
      const livraison = cmd.livraison === 'domicile' ? '🚚 Domicile' : '🏪 Retrait'
      const date = cmd.date ? new Date(cmd.date).toLocaleDateString('fr-FR') : new Date(cmd.created_at).toLocaleDateString('fr-FR')
      const couleurs = {
        "En attente": "orange",
        "En préparation": "bleu",
        "Prêt": "vert",
        "En livraison": "#17a2b8",
        "Livré": "vert",
        "Livrée": "vert",
        "Annulée": "gris"
      }
      const couleur = couleurs[cmd.statut] || "orange"
      
      // ✅ AFFICHER LE CODE DE CONFIRMATION
      let affichageCode = ""
      if (cmd.code_confirmation && !cmd.statut.toLowerCase().includes("livr") && cmd.statut !== "Annulée") {
        affichageCode = `
          <div style="background:#fff3cd; border:1px solid #ffeaa7; padding:12px; border-radius:8px; margin-top:10px; text-align:center;">
            <strong style="color:#d63031;">🔑 Code de confirmation :</strong>
            <div style="font-size:28px; font-weight:bold; color:#d63031; letter-spacing:4px; margin-top:6px;">${cmd.code_confirmation}</div>
            <small style="color:#666">À communiquer au client</small>
          </div>
        `
      }
      
      return `
        <div class="carte-commande">
          <div class="commande-header">
            <h3>Commande #${cmd.id} — ${cmd.client}</h3>
            <span class="badge ${couleur}">${cmd.statut}</span>
          </div>
          <div class="commande-tel">${cmd.telephone}</div>
          <ul class="commande-produits">${produitsList.split(',').map(p => `<li>${p.trim()}</li>`).join('')}</ul>
          ${affichageCode}
          <div class="commande-footer">
            <div>
              <span class="commande-date">${livraison} · 📅 ${date}</span>
              ${cmd.notes ? `<span class="commande-notes">📝 ${cmd.notes}</span>` : ''}
            </div>
            <span class="commande-total">${total} DH</span>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    console.error('Erreur chargement commandes:', err)
  }
}

// ============================================
// SOCKET.IO — Temps réel
// ============================================

socket.on("rafraichir_commandes", () => {
  console.log("🔄 Nouvelle commande reçue, on rafraîchit la liste")
  if (typeof chargerCommandes === 'function') chargerCommandes()
})
socket.on("rafraichir_historique", () => {
  console.log("🔄 Statut changé côté cuisine, on rafraîchit l'historique")
  if (document.getElementById("onglet-historique") && document.getElementById("onglet-historique").style.display !== "none") {
    chargerHistorique()
  }
})

// ============================================
// INITIALISATION
// ============================================
document.addEventListener("DOMContentLoaded", function() {
  const tb = document.getElementById("texte-bienvenue")
  if (tb) tb.textContent = `Bonjour ${userClient.nom} 👋`

  // Page Admin — Charger les commandes
  if (document.getElementById("liste-commandes")) {
    chargerCommandes()
  }

  // Ne lancer les fonctions client que si la page contient les éléments attendus
  if (document.getElementById("catalogue") || document.getElementById("client-nom")) {
    chargerProduits()
    chargerInfosClient()
    const cd = document.getElementById("client-date")
    if (cd) cd.min = new Date().toISOString().split("T")[0]
  }
})

// ============================================
// CHARGER INFOS CLIENT
// ============================================
async function chargerInfosClient() {
  try {
    const res = await fetch(`${API}/profil/${userClient.id}`)
    const profil = await res.json()
    const nomEl = document.getElementById("client-nom")
    const telEl = document.getElementById("client-tel")
    if (nomEl) nomEl.value = profil.nom || ""
    if (telEl) telEl.value = profil.telephone || ""
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
  const filtres = categorie === "tous" ? tousLesProduits : tousLesProduits.filter(p => p.categorie === categorie)
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
      <span>
        <strong>${p.prix * p.quantite} DH</strong>
        <button onclick="modifierQte(${id}, -1)" style="background:none;border:none;color:#8B4513;cursor:pointer;margin-left:8px">✕</button>
      </span>
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
    
    socket.emit("nouvelle_commande")
    
    document.getElementById("onglet-nouvelle").style.display = "none"
    document.getElementById("confirmation").style.display = "block"
    document.getElementById("confirmation-livraison").textContent =
      modeLivraison === "domicile" ? `🚚 Livraison prévue le ${date}` : `🏪 Retrait en magasin le ${date}`
    
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
// HISTORIQUE (avec bouton d'annulation)
// ============================================
function changerOnglet(onglet) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("actif"))
  event.target.classList.add("actif")
  document.getElementById("onglet-nouvelle").style.display = onglet === "nouvelle" ? "block" : "none"
  document.getElementById("onglet-historique").style.display = onglet === "historique" ? "block" : "none"
  if (onglet === "historique") chargerHistorique()
}

// Filtrer les commandes par statut (utilisé par les boutons en haut)
function filtrerStatut(statut, btn) {
  document.querySelectorAll('.btn-filtre').forEach(b => b.classList.remove('actif-filtre'))
  if (btn) btn.classList.add('actif-filtre')
  window.__statutFilter = statut || 'tous'
  if (typeof chargerHistorique === 'function') chargerHistorique()
  if (typeof chargerCommandes === 'function') chargerCommandes()
}

async function chargerHistorique() {
  try {
    const res = await fetch(`${API}/commandes/client/${userClient.id}`)
    const commandes = await res.json()
    // Appliquer filtre de statut global si présent
    const statutFilter = (window.__statutFilter || '').toLowerCase()
    const commandesFiltrees = (statutFilter && statutFilter !== 'tous')
      ? commandes.filter(c => (c.statut || '').toLowerCase() === statutFilter)
      : commandes
    
    const enAttente = commandesFiltrees.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return !["livrée", "livré", "annulée", "annulé"].includes(s)
    })
    
    const terminees = commandesFiltrees.filter(c => {
      const s = (c.statut || "").toLowerCase()
      return ["livrée", "livré", "annulée", "annulé"].includes(s)
    })
    
    const elEnAttente = document.getElementById("historique-en-attente")
    if (elEnAttente) {
      elEnAttente.innerHTML = enAttente.length
        ? enAttente.map(renderCarteHistorique).join("")
        : `<p style="color:#999;text-align:center;padding:20px">Aucune commande en cours 🎉</p>`
    }

    const elTerminees = document.getElementById("historique-livre")
    if (elTerminees) {
      elTerminees.innerHTML = terminees.length
        ? terminees.map(renderCarteHistorique).join("")
        : `<p style="color:#999;text-align:center;padding:20px">Aucun historique</p>`
    }
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
  
  // ✅ CODE DE CONFIRMATION
  let affichageCode = ""
  if (cmd.code_confirmation && !statutNormalise.toLowerCase().startsWith("livr") && statutNormalise !== "Annulée") {
    affichageCode = `
      <div style="background:#fff3cd; border:1px solid #ffeaa7; padding:10px; border-radius:8px; margin-top:10px; text-align:center;">
        <strong>🔑 Code de remise :</strong>
        <span style="font-size:24px; font-weight:bold; color:#d63031; letter-spacing:3px;">${cmd.code_confirmation}</span>
        <br>
        <small style="color:#666">À communiquer au livreur ou au caissier</small>
      </div>
    `
  }
  
  // ✅ BOUTON D'ANNULATION AVEC COMPTE À REBOURS
  let boutonAnnulation = ""
  if (cmd.statut === "En attente") {
    const dateCreation = new Date(cmd.created_at || cmd.date)
    const maintenant = new Date()
    const delaiMs = maintenant - dateCreation
    const delaiMaxMs = 90 * 1000 // 1 minute 30 secondes
    const tempsRestantMs = delaiMaxMs - delaiMs
    
    if (tempsRestantMs > 0) {
      const minutes = Math.floor(tempsRestantMs / 60000)
      const secondes = Math.floor((tempsRestantMs % 60000) / 1000)
      const tempsAffiche = `${minutes}:${secondes.toString().padStart(2, '0')}`
      
      boutonAnnulation = `
        <button class="btn-annuler-commande" data-id="${cmd.id}" onclick="annulerCommande(${cmd.id})" 
                style="background:#dc3545; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:bold; margin-top:12px; width:100%; transition: background 0.2s;">
          ❌ Annuler la commande (${tempsAffiche})
        </button>
      `
    } else {
      boutonAnnulation = `
        <div style="text-align:center; margin-top:12px; padding:10px; background:#f8d7da; border-radius:8px; color:#721c24; font-size:13px;">
          ⏰ Délai d'annulation (1min30) dépassé
        </div>
      `
    }
  }
  
  return `
    <div class="carte-commande-client">
      <div class="commande-client-header">
        <strong>Commande #${cmd.id}</strong>
        <span class="badge ${couleur}">${statutNormalise}</span>
      </div>
      <div class="commande-client-produits">${produitsList}</div>
      ${affichageCode}
      <div class="commande-client-footer">
        <span>📅 ${cmd.date || new Date(cmd.created_at).toLocaleDateString('fr-FR')}</span>
        <span class="commande-client-total">${total} DH</span>
      </div>
      ${boutonAnnulation}
    </div>
  `
}

// ✅ FONCTION POUR ANNULER UNE COMMANDE
async function annulerCommande(id) {
  if (!confirm("⚠️ Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.")) return
  
  try {
    const res = await fetch(`${API}/commandes/${id}/annuler`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" }
    })
    
    const result = await res.json()
    
    if (!res.ok) {
      alert(result.erreur || "Erreur lors de l'annulation")
      return
    }
    
    alert("✅ " + result.message)
    chargerHistorique()
  } catch (err) {
    alert("Erreur de connexion : " + err.message)
  }
}

// ✅ METTRE À JOUR LE COMPTE À REBOURS TOUTES LES SECONDES
setInterval(() => {
  const boutons = document.querySelectorAll('.btn-annuler-commande')
  boutons.forEach(btn => {
    const texte = btn.textContent
    const match = texte.match(/\((\d+):(\d+)\)/)
    if (match) {
      let minutes = parseInt(match[1])
      let secondes = parseInt(match[2])
      
      if (secondes > 0) {
        secondes--
      } else if (minutes > 0) {
        minutes--
        secondes = 59
      } else {
        chargerHistorique()
        return
      }
      
      btn.textContent = `❌ Annuler la commande (${minutes}:${secondes.toString().padStart(2, '0')})`
    }
  })
}, 1000)