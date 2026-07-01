import http from "node:http";

// Keep-alive agent — same approach as the Bun proxy.
// No framework; raw node:http so the comparison is stdlib vs stdlib vs stdlib.
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 500,
});

function proxyRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: 9000, path, method: "GET", agent },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "node-proxy", timestamp: new Date().toISOString() }));
    return;
  }

  try {
    const { status, headers, body } = await proxyRequest(req.url);
    res.writeHead(status, headers);
    res.end(body);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Bad Gateway" }));
  }
});

server.listen(8002, "0.0.0.0", () => {
  console.log("Node.js proxy listening on port 8002, forwarding to http://localhost:9000");
});
