import http from 'k6/http';
import { check } from 'k6';

const targetUrl = __ENV.TARGET || 'http://localhost:8001';

export const options = {
  stages: [
    { duration: '5s',  target: 10 }, // ramp up to 10 VUs
    { duration: '60s', target: 10 }, // hold at 10 VUs
    { duration: '5s',  target: 0  }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000', 'p(95)<1000'],
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
