// Utiliser les variables globales de config.js
const API    = window.API;
const socket = window.socket;
    
    // ✅ Écouter les mises à jour du stock des produits
    socket.on("rafraichir_stock_produits", () => {
      console.log("🔄 Stock des produits mis à jour, rafraîchissement...");
      if (typeof chargerProduits === "function") {
        chargerProduits();
      }
    });


let categorieActive = "tous"
let produitEnModification = null

let user = null

document.addEventListener("DOMContentLoaded", function() {
  user = verifierConnexion(["admin"])
  if (user) chargerProduits()
})
async function chargerProduits() {
  try {
    let response = await fetch(API + "/produits")
    let produits = await response.json()
    afficherProduits(produits)
  } catch(err) {
    console.error("Erreur chargement produits:", err)
  }
}

function afficherProduits(produits) {
  let grille = document.getElementById("grille-produits")
  grille.innerHTML = ""

  let produitsFiltres = categorieActive === "tous"
    ? produits
    : produits.filter(p => p.categorie === categorieActive)

  if (produitsFiltres.length === 0) {
    grille.innerHTML = '<p style="color:#999">Aucun produit dans cette catégorie.</p>'
    return
  }

  produitsFiltres.forEach(function(produit) {
    let icone = { "Pain": "🍞", "Pâtisserie": "🧁", "Gâteau": "🎂" }[produit.categorie] || "🍰"

    let statutStock = produit.quantite === 0
      ? '<span class="badge rouge">🔴 Rupture</span>'
      : produit.quantite < 5
      ? '<span class="badge orange">🟠 Stock bas</span>'
      : '<span class="badge vert">🟢 Disponible</span>'

    grille.innerHTML += `
      <div class="carte-produit">
        <div class="produit-icone">${icone}</div>
        <div class="produit-info">
          <h3>${produit.nom}</h3>
          <p class="produit-description">${produit.description || ""}</p>
          <div class="produit-details">
            <span class="produit-prix">${produit.prix} DH</span>
            <span class="produit-quantite">Stock : ${produit.quantite}</span>
          </div>
          <div class="produit-statut">${statutStock}</div>
        </div>
        <div class="produit-actions">
          <button class="btn-modifier" onclick="ouvrirModification(${produit.id}, '${produit.nom}', '${produit.categorie}', ${produit.prix}, ${produit.quantite}, \`${produit.description || ""}\`)">✏️ Modifier</button>
          <button class="btn-supprimer" onclick="supprimerProduit(${produit.id})">🗑️ Supprimer</button>
        </div>
      </div>
    `
  })
}

function filtrerCategorie(categorie) {
  categorieActive = categorie
  document.querySelectorAll(".btn-filtre").forEach(btn => btn.classList.remove("actif-filtre"))
  event.target.classList.add("actif-filtre")
  chargerProduits()
}

function ouvrirModification(id, nom, categorie, prix, quantite, description) {
  produitEnModification = id
  document.getElementById("input-nom").value         = nom
  document.getElementById("input-categorie").value   = categorie
  document.getElementById("input-prix").value        = prix
  document.getElementById("input-quantite").value    = quantite
  document.getElementById("input-description").value = description
  document.getElementById("formulaire-titre").textContent = "✏️ Modifier le produit"
  document.getElementById("btn-enregistrer").textContent  = "✅ Enregistrer les modifications"
  document.getElementById("formulaire").style.display = "block"
  document.getElementById("formulaire").scrollIntoView({ behavior: "smooth" })
}

async function enregistrerProduit() {
  let nom         = document.getElementById("input-nom").value.trim()
  let categorie   = document.getElementById("input-categorie").value
  let prix        = Number(document.getElementById("input-prix").value)
  let quantite    = Number(document.getElementById("input-quantite").value)
  let description = document.getElementById("input-description").value.trim()

  if (!nom || isNaN(prix) || isNaN(quantite)) {
    alert("Veuillez remplir tous les champs !")
    return
  }

  if (produitEnModification) {
    await fetch(API + "/produits/" + produitEnModification, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, categorie, prix, quantite, description })
    })
  } else {
    await fetch(API + "/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, categorie, prix, quantite, description })
    })
  }

  toggleFormulaire()
  chargerProduits()
}

async function supprimerProduit(id) {
  if (confirm("Supprimer ce produit ?")) {
    await fetch(API + "/produits/" + id, { method: "DELETE" })
    chargerProduits()
  }
}

function toggleFormulaire() {
  let form = document.getElementById("formulaire")
  if (form.style.display === "none") {
    produitEnModification = null
    document.getElementById("formulaire-titre").textContent = "Nouveau produit"
    document.getElementById("btn-enregistrer").textContent  = "✅ Enregistrer"
    document.getElementById("input-nom").value         = ""
    document.getElementById("input-categorie").value   = "Pain"
    document.getElementById("input-prix").value        = ""
    document.getElementById("input-quantite").value    = ""
    document.getElementById("input-description").value = ""
    form.style.display = "block"
  } else {
    produitEnModification = null
    form.style.display = "none"
  }
}
