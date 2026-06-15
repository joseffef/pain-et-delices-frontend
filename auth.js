function verifierConnexion(rolesAutorises) {
  let user = JSON.parse(sessionStorage.getItem("user"))

  if (!user) {
    window.location.href = "../login.html"
    return null
  }

  if (rolesAutorises && !rolesAutorises.includes(user.role)) {
    alert("Accès refusé pour le rôle : " + user.role)
    window.location.href = "../login.html"
    return null
  }

  let headerUser = document.getElementById("header-user")
  if (headerUser) {
    let roleLabel = {
      "admin":   "Administrateur",
      "chef":    "Chef",
      "achat":   "Responsable Achat",
      "livreur": "Livreur",
      "client":  "Client"
    }[user.role] || user.role

    headerUser.textContent = "👤 " + user.nom + " — " + roleLabel
  }

  return user
}

function seDeconnecter() {
  sessionStorage.removeItem("user")
  window.location.href = "../login.html"
}