// ============================================================
// config.js — Pain et Délices
// ============================================================

(function () {
  const estLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  window.API = estLocal
    ? "http://localhost:4000/api"
    : "https://pain-et-delices-backend-production.up.railway.app/api";

  window.SOCKET_URL = estLocal
    ? "http://localhost:4000"
    : "https://pain-et-delices-backend-production.up.railway.app";

  window.socket = io(window.SOCKET_URL, {
    transports: ["websocket", "polling"],
  });

  const _fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers["Accept"] = "application/json";
    return _fetchOriginal(url, options);
  };

  console.log("🌐 API    →", window.API);
  console.log("🔌 Socket →", window.SOCKET_URL);
  console.log("🏠 Mode   →", estLocal ? "LOCAL" : "PRODUCTION");
})();