    const API    = window.API;
const socket = window.socket;


// ✅ Écouter les nouvelles commandes
socket.on("rafraichir_commandes", () => {
  // Nouvelle commande : rafraîchir l'affichage sans son ni alertes intrusives
  if (typeof chargerToutesLesCommandes === "function") chargerToutesLesCommandes();
});

// ✅ NOUVEAU : Écouter les mises à jour du stock des produits
socket.on("rafraichir_stock_produits", () => {
  console.log("🔄 Stock des produits mis à jour, rafraîchissement...");
  if (typeof chargerProduits === "function") {
    chargerProduits();
  }
});

// ✅ NOUVEAU : Écouter les mises à jour du stock des ingrédients
socket.on("rafraichir_stock_ingredients", () => {
  console.log("🔄 Stock des ingrédients mis à jour, rafraîchissement...");
  if (typeof chargerIngredients === "function") {
    chargerIngredients();
  }
});

// ✅ Écouter les changements de statut (pour rafraîchir les commandes)
socket.on("changement_statut", () => {
  console.log("🔄 Statut changé, rafraîchissement des commandes...");
  if (typeof chargerToutesLesCommandes === "function") {
    chargerToutesLesCommandes();
  }
});