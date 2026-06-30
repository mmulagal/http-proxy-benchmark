import http from "node:http";

// Keep-alive agent with a large socket pool — prevents connection thrash
// under high concurrency. Bun fully supports node:http natively.
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000,
  maxFreeSockets: 500,
  timeout: 10000,
});

function proxyRequest(path: string): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: 9000, path, method: "GET", agent },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 200,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks),
          })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export default {
  port: 8003,
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "bun-proxy", timestamp: new Date().toISOString() }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { status, headers, body } = await proxyRequest(`${url.pathname}${url.search}`);
      return new Response(body, { status, headers });
    } catch (error) {
      console.error("Proxy error:", error);
      return new Response(JSON.stringify({ error: "Bad Gateway" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
