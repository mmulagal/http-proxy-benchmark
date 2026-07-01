import http from 'k6/http';
import { check } from 'k6';

const targetUrl = __ENV.TARGET || 'http://localhost:8001';

export const options = {
  stages: [
    { duration: '10s', target: 100  }, // ramp to 100 VUs
    { duration: '20s', target: 100  }, // hold at 100
    { duration: '10s', target: 500  }, // ramp to 500 VUs
    { duration: '20s', target: 500  }, // hold at 500
    { duration: '10s', target: 1000 }, // ramp to 1000 VUs
    { duration: '20s', target: 1000 }, // hold at 1000
    { duration: '10s', target: 0    }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000', 'p(95)<1500'],
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
