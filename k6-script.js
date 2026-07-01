import http from 'k6/http';
import { check } from 'k6';

const targetUrl = __ENV.TARGET || 'http://localhost:8001';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // ramp up
    { duration: '60s', target: 100 }, // hold at 100 VUs for 60s
    { duration: '5s',  target: 0   }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000', 'p(95)<500'],
    http_req_failed: ['rate<0.01'],
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
