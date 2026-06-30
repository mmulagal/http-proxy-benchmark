import Fastify from "fastify";
import replyFrom from "@fastify/reply-from";

const fastify = Fastify({ logger: false });

// Register reply-from plugin pointing at upstream
await fastify.register(replyFrom, {
  base: "http://localhost:9000",
});

// Health check must be registered BEFORE the wildcard proxy route
fastify.get("/health", async () => ({
  ok: true,
  service: "node-proxy",
  timestamp: new Date().toISOString(),
}));

// Proxy all other requests to upstream
fastify.all("*", async (request, reply) => {
  return reply.from(request.url);
});

try {
  await fastify.listen({ port: 8002, host: "0.0.0.0" });
  console.log("Node.js Fastify proxy listening on port 8002, forwarding to http://localhost:9000");
} catch (err) {
  console.error(err);
  process.exit(1);
}
