/* Local static server. Vercel serves the same files in production. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ttf": "font/ttf",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function sendFile(res, file) {
  fs.readFile(file, (error, buffer) => {
    if (error) {
      res.statusCode = 404;
      res.end("Não encontrado.");
      return;
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.end(buffer);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(root, requested));
  if (!file.startsWith(root)) {
    res.statusCode = 403;
    res.end("Proibido.");
    return;
  }
  sendFile(res, file);
});

const port = Number(process.env.PORT) || 4173;
server.listen(port, "127.0.0.1", () => {
  console.log("SMEZI Brand Studio em http://127.0.0.1:" + port);
});
