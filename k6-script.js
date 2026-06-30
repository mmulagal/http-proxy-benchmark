import http from 'k6/http';
import { check } from 'k6';

const targetUrl = __ENV.TARGET || 'http://localhost:8001';

export const options = {
  stages: [
    { duration: '15s', target: 500 }, // Ramp up to 500 VUs
    { duration: '60s', target: 500 }, // Sustain 500 VUs for 60 seconds
    { duration: '5s',  target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000', 'p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
  // Only show the metrics we care about in the summary
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  const res = http.get(`${targetUrl}/api/items`);

  check(res, {
    'status 200': (r) => r.status === 200,
    'body not empty': (r) => r.body.length > 0,
  });
  // No sleep — let each VU fire as fast as the proxy can handle
}
