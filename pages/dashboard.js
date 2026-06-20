// ============================================
// Petit Délices — Dashboard
// Logique d'origine conservée (API, socket.io) + filtres de période,
// indicateurs de variation, panier moyen, mode de livraison et graphique CA.
// ============================================

const API    = window.API;
const socket = window.socket;

let user = verifierConnexion(["admin"])

// Données complètes chargées une fois, puis filtrées localement par période
let toutesLesCommandes = []
let tousLesIngredients = []
let periodeActuelle    = "semaine" // 'jour' | 'semaine' | 'mois' | 'tout'

// ---------- Temps réel ----------
socket.on("rafraichir_stock_produits", () => {
  console.log("🔄 Le stock des produits a été modifié, mise à jour automatique...")
  if (typeof chargerProduits === "function") chargerProduits()
})

socket.on("rafraichir_stock_ingredients", () => {
  console.log("🔄 Le stock des ingrédients a été modifié, mise à jour automatique...")
  chargerDashboard()
})

socket.on("rafraichir_historique", () => {
  console.log("🔄 Commandes mises à jour, rechargement du dashboard...")
  chargerDashboard()
})

socket.on("nouvelle_commande", () => {
  console.log("🔄 Nouvelle commande reçue, rechargement du dashboard...")
  chargerDashboard()
})

// ---------- Chargement initial ----------
async function chargerDashboard() {
  try {
    let [resIngredients, resCommandes] = await Promise.all([
      fetch(API + "/ingredients"),
      fetch(API + "/commandes")
    ])

    tousLesIngredients = await resIngredients.json()

    let commandesBrutes = await resCommandes.json()
    toutesLesCommandes = commandesBrutes.map(cmd => {
      cmd._date = parseDateCommande(cmd.date)
      return cmd
    })

    afficherAlertesStock(tousLesIngredients) // indépendant de la période
    rafraichirVue()
  } catch (err) {
    console.error("Erreur dashboard:", err)
  }
}

// ---------- Filtre de période ----------
function changerPeriode(periode, btn) {
  periodeActuelle = periode
  document.querySelectorAll(".filtre-btn").forEach(b => b.classList.remove("actif"))
  btn.classList.add("actif")
  rafraichirVue()
}

function rafraichirVue() {
  let { debut, fin } = bornesPeriode(periodeActuelle)
  let bornesPrec = bornesPeriodePrecedente(periodeActuelle, debut)

  let commandesPeriode      = filtrerParBornes(toutesLesCommandes, debut, fin)
  let commandesPrecedentes  = bornesPrec ? filtrerParBornes(toutesLesCommandes, bornesPrec.debut, bornesPrec.fin) : null

  afficherStats(commandesPeriode, commandesPrecedentes)
  afficherCommandesRecentes(commandesPeriode)
  afficherTopProduits(commandesPeriode)
  afficherGraphique(periodeActuelle)
}

function bornesPeriode(periode) {
  let fin   = new Date()
  let debut = new Date(fin)

  if (periode === "jour") {
    debut.setHours(0, 0, 0, 0)
  } else if (periode === "semaine") {
    debut.setDate(debut.getDate() - 6)
    debut.setHours(0, 0, 0, 0)
  } else if (periode === "mois") {
    debut.setDate(debut.getDate() - 29)
    debut.setHours(0, 0, 0, 0)
  } else {
    return { debut: null, fin: null } // 'tout'
  }

  return { debut, fin }
}

function bornesPeriodePrecedente(periode, debutActuelle) {
  if (periode === "tout" || !debutActuelle) return null

  let fin   = new Date(debutActuelle.getTime() - 1)
  let debut = new Date(debutActuelle)

  if (periode === "jour")    debut.setDate(debut.getDate() - 1)
  if (periode === "semaine") debut.setDate(debut.getDate() - 7)
  if (periode === "mois")    debut.setDate(debut.getDate() - 30)

  return { debut, fin }
}

function filtrerParBornes(commandes, debut, fin) {
  if (!debut) return commandes // 'tout' → on garde tout
  return commandes.filter(c => c._date && c._date >= debut && c._date <= fin)
}

// Essaie plusieurs formats : le format exact renvoyé par l'API peut être
// une chaîne ISO classique, ou un format "JJ/MM/AAAA HH:mm" selon le backend.
function parseDateCommande(raw) {
  if (!raw) return null

  let d = new Date(raw)
  if (!isNaN(d.getTime())) return d

  let m = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/)
  if (m) {
    let [, jour, mois, annee, heure, min] = m
    return new Date(+annee, +mois - 1, +jour, +(heure || 0), +(min || 0))
  }

  return null
}

function totalCommande(cmd) {
  return cmd.produits ? cmd.produits.reduce((s, p) => s + p.prix * p.quantite, 0) : 0
}

function estLivree(cmd) {
  return cmd.statut === "Livré" || cmd.statut === "Livrée"
}

// ---------- Cartes statistiques ----------
function afficherStats(commandes, commandesPrecedentes) {
  let total   = commandes.length
  let attente = commandes.filter(c => c.statut === "En attente").length
  let livrees = commandes.filter(estLivree).length
  let ca      = commandes.filter(estLivree).reduce((s, c) => s + totalCommande(c), 0)
  let panierMoyen = livrees > 0 ? Math.round(ca / livrees) : 0

  document.getElementById("total-commandes").textContent   = total
  document.getElementById("commandes-attente").textContent = attente
  document.getElementById("commandes-livrees").textContent = livrees
  document.getElementById("chiffre-affaires").textContent  = ca + " DH"
  document.getElementById("panier-moyen").textContent      = panierMoyen + " DH"

  if (commandesPrecedentes) {
    let caPrec = commandesPrecedentes.filter(estLivree).reduce((s, c) => s + totalCommande(c), 0)
    afficherVariation("variation-commandes", total, commandesPrecedentes.length)
    afficherVariation("variation-ca", ca, caPrec)
  } else {
    afficherVariation("variation-commandes", total, null)
    afficherVariation("variation-ca", ca, null)
  }

  afficherModeLivraison(commandes)
}

function afficherVariation(id, valeurActuelle, valeurPrecedente) {
  let el = document.getElementById(id)
  if (!el) return

  if (valeurPrecedente === null || valeurPrecedente === undefined) {
    el.innerHTML = ""
    return
  }

  if (valeurPrecedente === 0) {
    el.className = valeurActuelle > 0 ? "variation up" : "variation"
    el.textContent = valeurActuelle > 0 ? "▲ nouveau" : ""
    return
  }

  let variation = Math.round(((valeurActuelle - valeurPrecedente) / valeurPrecedente) * 100)

  if (variation === 0) {
    el.className = "variation neutre"
    el.textContent = "— stable"
  } else if (variation > 0) {
    el.className = "variation up"
    el.textContent = `▲ ${variation}%`
  } else {
    el.className = "variation down"
    el.textContent = `▼ ${Math.abs(variation)}%`
  }
}

function afficherModeLivraison(commandes) {
  let domicile = commandes.filter(c => c.livraison === "domicile").length
  let total    = commandes.length || 1
  let pctDomicile = Math.round((domicile / total) * 100)
  let pctRetrait  = 100 - pctDomicile

  document.getElementById("livraison-retrait-pct").textContent  = pctRetrait + "%"
  document.getElementById("livraison-domicile-pct").textContent = pctDomicile + "%"
  document.getElementById("livraison-barre-domicile").style.width = pctDomicile + "%"
}

// ---------- Alertes stock (état actuel, indépendant de la période) ----------
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

// ---------- Commandes récentes (sur la période sélectionnée) ----------
function afficherCommandesRecentes(commandes) {
  let div = document.getElementById("commandes-recentes")

  let couleurs = {
    "En attente":     "orange",
    "En préparation": "bleu",
    "Prêt":           "vert",
    "Livré":          "gris",
    "Livrée":         "gris"
  }

  let recentes = [...commandes]
    .sort((a, b) => (b._date || 0) - (a._date || 0))
    .slice(0, 5)

  if (recentes.length === 0) {
    div.innerHTML = '<p class="vide-message">Aucune commande sur cette période.</p>'
    return
  }

  div.innerHTML = recentes.map(function(cmd) {
    let total = totalCommande(cmd)
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

// ---------- Top produits (sur la période sélectionnée) ----------
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
    div.innerHTML = '<p class="vide-message">Aucune donnée sur cette période.</p>'
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

// ---------- Graphique CA (SVG natif, pas de librairie externe) ----------
function afficherGraphique(periode) {
  let conteneur = document.getElementById("graphique-ca")
  let buckets = genererBuckets(periode)

  let largeurBarre = 28
  let espace = 14
  let largeur = Math.max(620, buckets.length * (largeurBarre + espace) + espace)
  let hauteur = 220
  let hauteurZoneGraph = 160
  let baseY = 20 + hauteurZoneGraph

  let maxCA = Math.max(...buckets.map(b => b.ca), 1)
  let afficherChaqueLabel  = buckets.length <= 14
  let rotationLabel = buckets.length > 10 ? -40 : 0

  let barres = buckets.map((b, i) => {
    let x = espace + i * (largeurBarre + espace)
    let h = b.ca > 0 ? Math.max(4, (b.ca / maxCA) * hauteurZoneGraph) : 0
    let y = baseY - h
    let afficherLabel = afficherChaqueLabel || i % Math.max(1, Math.ceil(buckets.length / 10)) === 0

    return `
      <g>
        <rect x="${x}" y="${y}" width="${largeurBarre}" height="${h}" rx="4" fill="url(#degradeOr)">
          <title>${b.label} : ${Math.round(b.ca)} DH</title>
        </rect>
        ${(b.ca > 0 && afficherChaqueLabel) ? `<text x="${x + largeurBarre / 2}" y="${y - 6}" text-anchor="middle" class="graph-valeur">${Math.round(b.ca)}</text>` : ""}
        ${afficherLabel ? `<text x="${x + largeurBarre / 2}" y="${baseY + 18}" text-anchor="middle" class="graph-label" transform="rotate(${rotationLabel} ${x + largeurBarre / 2} ${baseY + 18})">${b.label}</text>` : ""}
      </g>
    `
  }).join("")

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}" preserveAspectRatio="xMinYMid meet">
      <defs>
        <linearGradient id="degradeOr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E0B36C"></stop>
          <stop offset="100%" stop-color="#B8843E"></stop>
        </linearGradient>
      </defs>
      <line x1="${espace}" y1="${baseY}" x2="${largeur - espace}" y2="${baseY}" class="graph-axe"></line>
      ${barres}
    </svg>
  `
}

function genererBuckets(periode) {
  let buckets = []

  if (periode === "jour") {
    for (let h = 0; h < 24; h++) {
      let debut = new Date(); debut.setHours(h, 0, 0, 0)
      let fin   = new Date(); fin.setHours(h, 59, 59, 999)
      buckets.push({ label: h + "h", debut, fin })
    }
  } else if (periode === "semaine" || periode === "mois") {
    let nbJours = periode === "semaine" ? 7 : 30
    for (let i = nbJours - 1; i >= 0; i--) {
      let debut = new Date(); debut.setDate(debut.getDate() - i); debut.setHours(0, 0, 0, 0)
      let fin   = new Date(debut); fin.setHours(23, 59, 59, 999)
      buckets.push({ label: debut.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), debut, fin })
    }
  } else {
    // 'tout' → regroupement par mois calendaire (6 derniers mois)
    for (let i = 5; i >= 0; i--) {
      let debut = new Date(); debut.setMonth(debut.getMonth() - i); debut.setDate(1); debut.setHours(0, 0, 0, 0)
      let fin   = new Date(debut.getFullYear(), debut.getMonth() + 1, 0, 23, 59, 59, 999)
      buckets.push({ label: debut.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), debut, fin })
    }
  }

  buckets.forEach(b => {
    b.ca = toutesLesCommandes
      .filter(c => estLivree(c) && c._date && c._date >= b.debut && c._date <= b.fin)
      .reduce((s, c) => s + totalCommande(c), 0)
  })

  return buckets
}

chargerDashboard()