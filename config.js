// ============================================================
// config.js — Pain et Délices
// À charger EN PREMIER dans chaque page HTML, avant tout script
// ============================================================

(function () {
  const estLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // ── URL de l'API REST ──────────────────────────────────
  // En local  → le proxy Nginx/Express gère /api directement
  // Sur ngrok → on appelle l'URL ngrok complète avec le port 4000
  window.API = estLocal
    ? "http://localhost:4000/api"
    : window.location.origin + "/api";

  // ── URL du serveur Socket.io ───────────────────────────
  window.SOCKET_URL = estLocal
    ? "http://localhost:4000"
    : window.location.origin;

  // ── Initialiser Socket.io avec la bonne URL ────────────
  // On expose window.socket pour que toutes les pages l'utilisent
  window.socket = io(window.SOCKET_URL, {
    transports: ["websocket", "polling"],
  });

  // ── fetch() patché : ajoute automatiquement les headers ngrok
  // Sans ça, ngrok retourne une page HTML d'avertissement au lieu du JSON
  const _fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, options) {
    options = options || {};
    options.headers = options.headers || {};

    // Header qui court-circuite la page d'avertissement ngrok
    options.headers["ngrok-skip-browser-warning"] = "true";
    // Indique qu'on attend du JSON (bonne pratique)
    if (!options.headers["Content-Type"] && (!options.body || typeof options.body === "string")) {
      options.headers["Accept"] = "application/json";
    }

    return _fetchOriginal(url, options);
  };

  console.log("🌐 API       →", window.API);
  console.log("🔌 Socket    →", window.SOCKET_URL);
  console.log("🏠 Mode      →", estLocal ? "LOCAL" : "NGROK / PRODUCTION");
})();