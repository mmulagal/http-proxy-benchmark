# HTTP Proxy Benchmark: Go vs Node.js (Fastify) vs Bun

A comprehensive benchmarking setup comparing three implementations of a reverse HTTP proxy using Go, Node.js (Fastify), and Bun.

## Architecture

```
┌─────────────┐
│     k6      │ Load tester (Go-based)
└──────┬──────┘
       │
       ├──────────────────┬─────────────────┬──────────────────┐
       │                  │                 │                  │
       ▼                  ▼                 ▼                  ▼
  ┌─────────┐        ┌─────────┐       ┌─────────┐        ┌──────────┐
  │ Go:8001 │        │Node:8002│       │ Bun:8003│        │ Upstream │
  │ stdlib  │        │ Fastify │       │ native  │        │ :9000    │
  │ reverse │        │ + proxy │       │ serve   │        │  mock    │
  │  proxy  │        │ plugin  │       │+ fetch  │        │   API    │
  └─────────┘        └─────────┘       └─────────┘        └──────────┘
```

## Quick Start

### Run Full Benchmark

```bash
./run-bench.sh
```

This will:
1. Start the upstream mock API (Bun) on `:9000`
2. Build and start the Go proxy on `:8001`
3. Start the Node.js Fastify proxy on `:8002`
4. Start the Bun proxy on `:8003`
5. Run k6 load tests against each proxy sequentially
6. Display a summary table of results
7. Save detailed JSON results and logs to `results/`

### Manual Testing

Start individual services in separate terminals:

**Terminal 1 — Upstream Mock:**
```bash
cd upstream
bun run index.ts
```

**Terminal 2 — Go Proxy:**
```bash
cd go-proxy
go build -o go-proxy main.go
./go-proxy
```

**Terminal 3 — Node.js Proxy:**
```bash
cd node-proxy
npm install
npm start
```

**Terminal 4 — Bun Proxy:**
```bash
cd bun-proxy
bun run index.ts
```

**Terminal 5 — Run Benchmarks:**
```bash
# Test Go proxy
TARGET=http://localhost:8001 k6 run k6-script.js

# Test Node proxy
TARGET=http://localhost:8002 k6 run k6-script.js

# Test Bun proxy
TARGET=http://localhost:8003 k6 run k6-script.js
```

## Benchmark Characteristics

- **Load Profile**: 10s ramp-up → 30s steady at 100 VUs → 5s ramp-down
- **Workload**: GET requests to `/api/items` (returns ~1 KB JSON)
- **Endpoint**: Each proxy forwards to local upstream mock
- **Metrics Collected**: 
  - Requests/second
  - Latency percentiles (p50, p95, p99)
  - Error rate
  - HTTP status codes

## Components

### `upstream/index.ts` (Bun)
Mock REST API server returning realistic JSON payloads. No external dependencies, purely local.

**Endpoints:**
- `GET /health` — Health check
- `GET /api/items` — Returns array of 20 objects (~1 KB)

### `go-proxy/main.go` (Go)
Uses standard library `net/http/httputil.ReverseProxy` for minimal overhead.

**Features:**
- Standard library only
- Single-file implementation
- Automatic connection pooling
- Built-in error handling

### `node-proxy/` (Node.js + Fastify)
Fastify framework with `@fastify/http-proxy` plugin for production-grade HTTP proxying.

**Features:**
- Fastify for low-overhead HTTP handling
- `@fastify/http-proxy` for transparent request/response forwarding
- Proper error handling
- ES modules

### `bun-proxy/index.ts` (Bun)
Native Bun.serve with fetch-based proxying. Zero external dependencies.

**Features:**
- Native `Bun.serve` HTTP handler
- Fetch API for upstream calls
- TypeScript-ready
- Minimal overhead

### `k6-script.js`
k6 load testing script with configurable target URL via `TARGET` environment variable.

**Configuration:**
- Stages: ramp-up, steady, ramp-down
- Thresholds: p99 latency < 500ms, error rate < 1%
- Checks: HTTP 200, response time validation, body validation

## Results

After running `./run-bench.sh`, check:
- `results/go.json` — Go proxy raw metrics
- `results/node.json` — Node.js proxy raw metrics
- `results/bun.json` — Bun proxy raw metrics
- `results/go-k6.log`, `results/node-k6.log`, `results/bun-k6.log` — Detailed k6 output

## Dependencies

### Pre-installed
- Go 1.24+
- Node.js 20+
- Bun 1.0+

### Auto-installed
- k6 (via Homebrew if not present)
- Fastify + @fastify/http-proxy (npm install in node-proxy/)

## Customization

### Change Load Profile
Edit `k6-script.js` `options.stages`:
```javascript
stages: [
  { duration: '20s', target: 200 }, // Higher VUs
  { duration: '60s', target: 200 }, // Longer steady state
  { duration: '10s', target: 0 },   // Longer ramp-down
]
```

### Change Target Endpoint
In `k6-script.js`, modify the request path in the `default()` function.

### Adjust Number of Proxies
Modify `run-bench.sh` to start/test additional proxies on different ports.

## Notes

- All services run on localhost; no network latency
- Upstream mock is intentionally fast to isolate proxy overhead
- k6 is installed dynamically if not present
- All background processes are cleaned up on script exit (via trap)
- Results include both raw JSON (for detailed analysis) and summary table

## License

This benchmark is part of the fn-proxy-poc project.
