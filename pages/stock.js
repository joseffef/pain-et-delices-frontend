// Utiliser les variables globales de config.js
// Utiliser les variables globales de config.js
const API    = window.API;
const socket = window.socket;

let user = verifierConnexion(["admin"])

// ✅ INITIALISER SOCKET


  // ✅ ÉCOUTER LES MISES À JOUR
  socket.on("rafraichir_stock_ingredients", () => {
    console.log("🔄 Le stock a été modifié ailleurs, mise à jour automatique...")
    chargerStock()
  })


async function chargerStock() {
  try {
    let response = await fetch(API + "/ingredients")
    let ingredients = await response.json()
    afficherStock(ingredients)
  } catch(err) {
    console.error("Erreur chargement stock:", err)
  }
}

function afficherStock(ingredients) {
  let tbody = document.getElementById("tableau-stock")
  tbody.innerHTML = ""

  ingredients.forEach(function(ing) {
    let statut = ""
    let couleurLigne = ""

    if (ing.quantite_stock === 0) {
      statut = '<span class="badge rouge">🔴 Rupture</span>'
      couleurLigne = "ligne-rouge"
    } else if (ing.quantite_stock < ing.seuil_alerte) {
      statut = '<span class="badge orange">🟠 Stock bas</span>'
      couleurLigne = "ligne-orange"
    } else {
      statut = '<span class="badge vert">🟢 OK</span>'
    }

    tbody.innerHTML += `
      <tr class="${couleurLigne}">
        <td>${ing.nom}</td>
        <td>
          <input 
            type="number" 
            value="${ing.quantite_stock}" 
            class="input-quantite"
            onchange="modifierQuantite(${ing.id}, this.value, '${ing.nom}', '${ing.unite}', ${ing.seuil_alerte})"
          >
        </td>
        <td>${ing.unite}</td>
        <td>${statut}</td>
        <td>
          <button class="btn-ajouter-qte" onclick="ajouterQuantite(${ing.id}, '${ing.nom}', ${ing.quantite_stock}, '${ing.unite}', ${ing.seuil_alerte})">➕ Ajouter</button>
          <button class="btn-modifier-ing" onclick="ouvrirModificationIngredient(${ing.id}, '${ing.nom}', ${ing.quantite_stock}, '${ing.unite}', ${ing.seuil_alerte})">✏️ Modifier</button>
          <button class="btn-supprimer" onclick="supprimerIngredient(${ing.id})">🗑️ Supprimer</button>
        </td>
      </tr>
    `
  })

  afficherAlertes(ingredients)
}

function afficherAlertes(ingredients) {
  let alertesDiv = document.getElementById("alertes")
  let problemes = ingredients.filter(ing => ing.quantite_stock < ing.seuil_alerte)

  if (problemes.length === 0) {
    alertesDiv.innerHTML = ""
    return
  }

  let html = '<div class="alerte-box"><strong>⚠️ Attention !</strong><br>'
  problemes.forEach(function(ing) {
    if (ing.quantite_stock === 0) {
      html += `🔴 <strong>${ing.nom}</strong> est en rupture de stock !<br>`
    } else {
      html += `🟠 <strong>${ing.nom}</strong> : seulement ${ing.quantite_stock} ${ing.unite} restants<br>`
    }
  })
  html += '</div>'
  alertesDiv.innerHTML = html
}

// --- FONCTION AJOUTER UN NOUVEL INGRÉDIENT ---
async function ajouterIngredient() {
  let nom = document.getElementById("input-nom").value.trim()
  let quantite_stock = Number(document.getElementById("input-quantite").value)
  let unite = document.getElementById("input-unite").value
  let seuil_alerte = Number(document.getElementById("input-minimum").value)

  if (!nom || isNaN(quantite_stock)) {
    alert("Veuillez remplir tous les champs !")
    return
  }

  await fetch(API + "/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, quantite_stock, unite, seuil_alerte }) // ✅ Noms corrigés
  })

  toggleFormulaire()
  chargerStock()
}

// --- FONCTION MODIFIER LA QUANTITÉ DIRECTEMENT DANS LE TABLEAU ---
async function modifierQuantite(id, nouvelleValeur, nom, unite, seuil_alerte) {
  await fetch(API + "/ingredients/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantite_stock: Number(nouvelleValeur), nom, unite, seuil_alerte }) // ✅ Nom corrigé
  })
  chargerStock()
}

// --- FONCTION BOUTON "➕ Ajouter" (Ajouter du stock) ---
async function ajouterQuantite(id, nom, quantiteActuelle, unite, seuil_alerte) {
  let qte = prompt("Combien voulez-vous ajouter au stock de " + nom + " ?")
  if (qte === null || qte === "" || isNaN(qte) || Number(qte) <= 0) return

  await fetch(API + "/ingredients/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantite_stock: Number(quantiteActuelle) + Number(qte), // ✅ Nom corrigé
      nom, 
      unite, 
      seuil_alerte // ✅ Nom corrigé
    })
  })
  chargerStock()
}

// --- FONCTION BOUTON "✏️ Modifier" (Changer nom/unité/seuil) ---
async function ouvrirModificationIngredient(id, nom, quantite_stock, unite, seuil_alerte) {
  let nouveauNom = prompt("Nom de l'ingrédient :", nom)
  if (nouveauNom === null) return
  let nouvelleUnite = prompt("Unité (kg, L, sachets...) :", unite)
  if (nouvelleUnite === null) return
  let nouveauSeuil = prompt("Quantité minimum d'alerte :", seuil_alerte)
  if (nouveauSeuil === null) return

  await fetch(API + "/ingredients/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantite_stock: Number(quantite_stock), // ✅ On garde la quantité actuelle
      nom: nouveauNom,
      unite: nouvelleUnite,
      seuil_alerte: Number(nouveauSeuil) // ✅ Nom corrigé
    })
  })
  chargerStock()
}

async function ouvrirModificationIngredient(id, nom, quantite_stock, unite, seuil_alerte) {
  let nouveauNom         = prompt("Nom de l'ingrédient :", nom)
  if (nouveauNom === null) return
  let nouvelleUnite      = prompt("Unité (kg, L, sachets...) :", unite)
  if (nouvelleUnite === null) return
  let nouveauSeuilAlerte = prompt("Quantité minimum d'alerte :", seuil_alerte)
  if (nouveauSeuilAlerte === null) return

  await fetch(API + "/ingredients/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantite_stock: quantite_stock,
      nom:           nouveauNom,
      unite:         nouvelleUnite,
      seuil_alerte:  Number(nouveauSeuilAlerte)
    })
  })
  chargerStock()
}

async function supprimerIngredient(id) {
  if (confirm("Supprimer cet ingrédient ?")) {
    await fetch(API + "/ingredients/" + id, { method: "DELETE" })
    chargerStock()
  }
}

function toggleFormulaire() {
  let form = document.getElementById("formulaire")
  if (form.style.display === "none") {
    form.style.display = "block"
    document.getElementById("input-nom").value = ""
    document.getElementById("input-quantite").value = ""
    document.getElementById("input-minimum").value = ""
  } else {
    form.style.display = "none"
  }
}

chargerStock()