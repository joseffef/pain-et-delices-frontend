// Utiliser les variables globales de config.js
    const API    = window.API;
const socket = window.socket;

let user = verifierConnexion(["admin"])


// ✅ Écouter la mise à jour des produits
socket.on("rafraichir_stock_produits", () => {
  console.log("🔄 Le stock des produits a été modifié, mise à jour automatique...")
  if (typeof chargerProduits === "function") chargerProduits()
})

// ✅ Écouter la mise à jour des ingrédients
socket.on("rafraichir_stock_ingredients", () => {
  console.log("🔄 Le stock des ingrédients a été modifié, mise à jour automatique...")
  if (typeof chargerIngredients === "function") chargerIngredients()
})


async function chargerDashboard() {
  try {
    let [resIngredients, resCommandes] = await Promise.all([
      fetch(API + "/ingredients"),
      fetch(API + "/commandes")
    ])

    let ingredients = await resIngredients.json()
    let commandes   = await resCommandes.json()

    afficherStats(commandes)
    afficherAlertesStock(ingredients)
    afficherCommandesRecentes(commandes)
    afficherTopProduits(commandes)
  } catch(err) {
    console.error("Erreur dashboard:", err)
  }
}

function afficherStats(commandes) {
  let total   = commandes.length
  let attente = commandes.filter(c => c.statut === "En attente").length
  let livrees = commandes.filter(c => c.statut === "Livré" || c.statut === "Livrée").length

  let ca = commandes
    .filter(c => c.statut === "Livré" || c.statut === "Livrée")
    .reduce((sum, c) => {
      let totalCmd = c.produits
        ? c.produits.reduce((s, p) => s + p.prix * p.quantite, 0)
        : 0
      return sum + totalCmd
    }, 0)

  document.getElementById("total-commandes").textContent   = total
  document.getElementById("commandes-attente").textContent = attente
  document.getElementById("commandes-livrees").textContent = livrees
  document.getElementById("chiffre-affaires").textContent  = ca + " DH"
}

function afficherAlertesStock(ingredients) {
  let div = document.getElementById("alertes-stock")
  let problemes = ingredients.filter(i => i.quantite_stock < i.seuil_alerte)

  if (problemes.length === 0) {
    div.innerHTML = '<p class="ok-message">✅ Tout le stock est suffisant !</p>'
    return
  }

  div.innerHTML = problemes.map(function(ing) {
    let type = ing.quantite_stock === 0 ? "rouge" : "orange"
    let msg  = ing.quantite_stock === 0
      ? `🔴 <strong>${ing.nom}</strong> — Rupture totale !`
      : `🟠 <strong>${ing.nom}</strong> — ${ing.quantite_stock} ${ing.unite} restants`
    return `<div class="alerte-ligne ${type}">${msg}</div>`
  }).join("")
}

function afficherCommandesRecentes(commandes) {
  let div = document.getElementById("commandes-recentes")

  let couleurs = {
    "En attente":     "orange",
    "En préparation": "bleu",
    "Prêt":           "vert",
    "Livré":          "gris",
    "Livrée":         "gris"
  }

  let recentes = commandes.slice(0, 5)

  if (recentes.length === 0) {
    div.innerHTML = '<p style="color:#999">Aucune commande.</p>'
    return
  }

  div.innerHTML = recentes.map(function(cmd) {
    let total = cmd.produits
      ? cmd.produits.reduce((s, p) => s + p.prix * p.quantite, 0)
      : 0
    let couleur = couleurs[cmd.statut] || ""
    let badgeLivraison = cmd.livraison === "domicile" ? " 🚚" : " 🏪"
    return `
      <div class="commande-ligne">
        <div>
          <strong>${cmd.client}${badgeLivraison}</strong>
          <span class="commande-ligne-date">${cmd.date || ""}</span>
        </div>
        <div style="text-align:right">
          <span class="badge ${couleur}">${cmd.statut}</span>
          <span class="commande-ligne-total">${total} DH</span>
        </div>
      </div>
    `
  }).join("")
}

function afficherTopProduits(commandes) {
  let div = document.getElementById("top-produits")

  let compteur = {}
  commandes.forEach(function(cmd) {
    if (cmd.produits) {
      cmd.produits.forEach(function(p) {
        if (!compteur[p.nom]) compteur[p.nom] = 0
        compteur[p.nom] += p.quantite
      })
    }
  })

  let top = Object.entries(compteur)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (top.length === 0) {
    div.innerHTML = '<p style="color:#999">Aucune donnée.</p>'
    return
  }

  let maxQte = top[0][1]

  div.innerHTML = top.map(function([nom, qte], index) {
    let medaille    = ["🥇", "🥈", "🥉"][index] || "  "
    let pourcentage = Math.round((qte / maxQte) * 100)
    return `
      <div class="top-produit-ligne">
        <span class="top-rang">${medaille}</span>
        <span class="top-nom">${nom}</span>
        <div class="top-barre-container">
          <div class="top-barre" style="width: ${pourcentage}%"></div>
        </div>
        <span class="top-qte">${qte} unités</span>
      </div>
    `
  }).join("")
}

chargerDashboard()