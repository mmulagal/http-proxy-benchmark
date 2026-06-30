// Mock upstream API server for benchmarking
// Returns realistic JSON payloads to test proxy throughput

const items = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  description: `This is a sample item with realistic data. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
  price: Math.random() * 1000,
  active: Math.random() > 0.5,
  tags: [`tag-${i % 5}`, `category-${i % 3}`, "benchmark"],
  created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
}));

export default {
  port: 9000,
  fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health") {
      return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/items") {
      return new Response(JSON.stringify({ data: items, count: items.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
