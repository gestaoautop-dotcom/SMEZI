/* Local static server plus the Brand Brain route. Vercel serves the same files in production. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const handler = require("../api/brand-brain");

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
  if (url.pathname === "/api/brand-brain") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (payload) => {
        if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(payload));
      };
      Promise.resolve(handler(req, res)).catch((error) => {
        console.error(error);
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.end('{"error":"falha"}');
        }
      });
    });
    return;
  }
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
