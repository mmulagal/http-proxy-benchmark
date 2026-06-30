#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BENCHMARK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$BENCHMARK_DIR/results"

mkdir -p "$RESULTS_DIR"

# Kill any stale processes from a previous run before starting fresh
lsof -ti:9000,8001,8002,8003 | xargs kill -9 2>/dev/null || true
sleep 1

# Track PIDs for cleanup
PIDS=()

cleanup() {
  echo -e "\n${YELLOW}Cleaning up background processes...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Also kill any lingering proxy processes by port
  lsof -ti:9000,8001,8002,8003 | xargs kill 2>/dev/null || true
  sleep 1
}
trap cleanup EXIT

# Ensure k6 is installed
if ! command -v k6 &>/dev/null; then
  echo -e "${YELLOW}k6 not found. Installing via Homebrew...${NC}"
  brew install k6
fi

# ─── Start Upstream Mock ────────────────────────────────────────────────────
echo -e "${GREEN}▶ Starting upstream mock API on :9000...${NC}"
cd "$BENCHMARK_DIR/upstream"
bun run index.ts >"$RESULTS_DIR/upstream.log" 2>&1 &
PIDS+=($!)

# ─── Build & Start Go Proxy ─────────────────────────────────────────────────
echo -e "${GREEN}▶ Building Go proxy...${NC}"
cd "$BENCHMARK_DIR/go-proxy"
go build -o go-proxy main.go

echo -e "${GREEN}▶ Starting Go proxy on :8001...${NC}"
./go-proxy >"$RESULTS_DIR/go-proxy.log" 2>&1 &
PIDS+=($!)

# ─── Start Node.js Fastify Proxy ────────────────────────────────────────────
echo -e "${GREEN}▶ Starting Node.js Fastify proxy on :8002...${NC}"
cd "$BENCHMARK_DIR/node-proxy"
npm install --silent >/dev/null 2>&1
node index.mjs >"$RESULTS_DIR/node-proxy.log" 2>&1 &
PIDS+=($!)

# ─── Start Bun Proxy ────────────────────────────────────────────────────────
echo -e "${GREEN}▶ Starting Bun proxy on :8003...${NC}"
cd "$BENCHMARK_DIR/bun-proxy"
bun run index.ts >"$RESULTS_DIR/bun-proxy.log" 2>&1 &
PIDS+=($!)

# ─── Wait for Readiness ─────────────────────────────────────────────────────
echo -e "${YELLOW}Waiting for all services to be ready...${NC}"
MAX_WAIT=30
for i in $(seq 1 $MAX_WAIT); do
  up9000=$(curl -sf http://localhost:9000/health >/dev/null 2>&1 && echo "1" || echo "0")
  up8001=$(curl -sf http://localhost:8001/health >/dev/null 2>&1 && echo "1" || echo "0")
  up8002=$(curl -sf http://localhost:8002/health >/dev/null 2>&1 && echo "1" || echo "0")
  up8003=$(curl -sf http://localhost:8003/health >/dev/null 2>&1 && echo "1" || echo "0")

  if [ "$up9000" = "1" ] && [ "$up8001" = "1" ] && [ "$up8002" = "1" ] && [ "$up8003" = "1" ]; then
    echo -e "${GREEN}✓ All services ready (${i}s)${NC}"
    break
  fi

  if [ "$i" = "$MAX_WAIT" ]; then
    echo -e "${RED}✗ Services not ready after ${MAX_WAIT}s${NC}"
    [ "$up9000" = "0" ] && echo -e "  ${RED}upstream   :9000  FAILED${NC}" && cat "$RESULTS_DIR/upstream.log"
    [ "$up8001" = "0" ] && echo -e "  ${RED}go-proxy   :8001  FAILED${NC}" && cat "$RESULTS_DIR/go-proxy.log"
    [ "$up8002" = "0" ] && echo -e "  ${RED}node-proxy :8002  FAILED${NC}" && cat "$RESULTS_DIR/node-proxy.log"
    [ "$up8003" = "0" ] && echo -e "  ${RED}bun-proxy  :8003  FAILED${NC}" && cat "$RESULTS_DIR/bun-proxy.log"
    exit 1
  fi

  sleep 1
done

# ─── Run Benchmarks ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  HTTP PROXY BENCHMARK: Go vs Node.js vs Bun    ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"

run_k6() {
  local name=$1
  local target=$2
  local out_log="$RESULTS_DIR/${name}-k6.log"

  echo ""
  echo -e "${CYAN}━━━ Testing ${name} proxy (${target}) ━━━${NC}"

  # --no-color keeps the log file clean
  # We filter out the live progress lines (written with \r) and only print
  # the final summary block so the terminal isn't flooded.
  k6 run \
    --no-color \
    -e TARGET="$target" \
    "$BENCHMARK_DIR/k6-script.js" \
    2>&1 | tee "$out_log" | grep --line-buffered -E "^\s*(http_req|checks|iterations|vus|data_|running|✓|✗|WARN|ERRO)" \
    || echo -e "${YELLOW}⚠ k6 threshold warnings for ${name} (check log)${NC}"
}

run_k6 "node" "http://localhost:8002"
sleep 5
run_k6 "bun"  "http://localhost:8003"
sleep 5
run_k6 "go"   "http://localhost:8001"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  BENCHMARK COMPLETE                             ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "Detailed k6 logs saved to:"
echo -e "  ${CYAN}$RESULTS_DIR/node-k6.log${NC}"
echo -e "  ${CYAN}$RESULTS_DIR/bun-k6.log${NC}"
echo -e "  ${CYAN}$RESULTS_DIR/go-k6.log${NC}"
echo ""

# Print req/s line from each k6 log (k6 summary always contains "http_reqs")
extract_summary() {
  local name=$1
  local log="$RESULTS_DIR/${name}-k6.log"
  if [ -f "$log" ]; then
    echo -e "${CYAN}── ${name} ──${NC}"
    grep -E "http_reqs|http_req_duration|checks" "$log" | tail -5 || true
  fi
}

echo -e "${GREEN}Quick metric extract from k6 output:${NC}"
extract_summary "node"
extract_summary "bun"
extract_summary "go"
