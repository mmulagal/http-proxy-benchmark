import http from 'k6/http';
import { check } from 'k6';

const targetUrl = __ENV.TARGET || 'http://localhost:8001';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // ramp to 100
    { duration: '30s', target: 100 }, // hold at 100
    { duration: '10s', target: 300 }, // ramp to 300
    { duration: '30s', target: 300 }, // hold at 300
    { duration: '10s', target: 500 }, // ramp to 500
    { duration: '30s', target: 500 }, // hold at 500
    { duration: '10s', target: 0   }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000', 'p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  const res = http.get(`${targetUrl}/api/items`);

  check(res, {
    'status 200': (r) => r.status === 200,
    'body not empty': (r) => r.body.length > 0,
  });
}
