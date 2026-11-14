// Simula a Lunes Host nos testes: servidor HTTPS local com suporte a pedidos parciais (Range).
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

function startLunesServer(dir, port = 8443) {
  const pdf = fs.readFileSync(path.join(dir, "manual.pdf"));
  const log = [];
  const server = https.createServer(
    { key: fs.readFileSync(path.join(dir, "key.pem")), cert: fs.readFileSync(path.join(dir, "cert.pem")) },
    (req, res) => {
      log.push(`${req.method} ${req.url} range=${req.headers.range ?? "-"}`);
      if (req.url === "/__log") return res.end(JSON.stringify(log));
      if (req.url === "/pagina.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("<h1>não é pdf</h1>");
      }
      if (req.url === "/redir") {
        res.writeHead(302, { Location: "https://127.0.0.1:8443/manual.pdf" });
        return res.end();
      }
      if (req.url !== "/manual.pdf") {
        res.writeHead(404);
        return res.end("404");
      }
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      if (m) {
        const start = m[1] ? +m[1] : pdf.length - +m[2];
        const end = m[1] && m[2] ? Math.min(+m[2], pdf.length - 1) : pdf.length - 1;
        res.writeHead(206, {
          "Content-Type": "application/pdf",
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${pdf.length}`,
          "Content-Length": end - start + 1,
        });
        return res.end(pdf.subarray(start, end + 1));
      }
      res.writeHead(200, { "Content-Type": "application/pdf", "Accept-Ranges": "bytes", "Content-Length": pdf.length });
      res.end(pdf);
    },
  );
  return new Promise((resolve, reject) => {
    server.once("error", (e) =>
      reject(new Error(e.code === "EADDRINUSE" ? `A porta ${port} já está ocupada (outro servidor de teste a correr?)` : e.message)),
    );
    server.listen(port, () => resolve(server));
  });
}

module.exports = { startLunesServer };
