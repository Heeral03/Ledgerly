/**
 * Automated Performance & Latency Benchmark Suite for Ledgerly
 * Simulates high-concurrency traffic across encrypted financial endpoints.
 */

require('dotenv').config();
const http = require('http');
const db = require('./src/db/database');
const { encrypt } = require('./src/utils/crypto');
const { signToken } = require('./src/middleware/auth');

const PORT = process.env.PORT || 4000;

// Seed test user and sample encrypted rows if not present
function setupTestData() {
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get('benchmark@ledgerly.internal');
  if (!user) {
    const res = db.prepare(`
      INSERT INTO users (email, name, role, status, permission)
      VALUES ('benchmark@ledgerly.internal', 'Benchmark Suite', 'user', 'active', 'upload')
    `).run();
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
  }

  // Seed 100 encrypted rows for user if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM uploads WHERE user_id = ?').get(user.id).c;
  if (count === 0) {
    console.log('⚡  Seeding 100 encrypted financial rows for benchmark user...');
    const insert = db.prepare('INSERT INTO uploads (user_id, filename, row_index, row_data) VALUES (?, ?, ?, ?)');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const insertTx = db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        const rowData = {
          Month: encrypt(months[i % 12]),
          Year: encrypt(String(2020 + Math.floor(i / 12))),
          'Sales & Revenue': encrypt(String(100000 + i * 2500)),
          'Profit & Loss': encrypt(String(25000 + i * 500)),
          'Bank & Cash': encrypt(String(50000 + i * 1000)),
          'Salary / Wages': encrypt(String(30000 + i * 400)),
          'Capex Investment': encrypt(String(5000 + i * 100)),
        };
        insert.run(user.id, 'benchmark_metrics.xlsx', i, JSON.stringify(rowData));
      }
    });
    insertTx();
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return { user, token };
}

function makeRequest(path, token) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-benchmark-key': 'ledgerly_bench',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          resolve({ status: res.statusCode, durationMs });
        });
      }
    );

    req.on('error', (err) => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ status: 500, error: err.message, durationMs });
    });

    req.end();
  });
}

async function runBenchmark(name, path, token, totalRequests = 200, concurrency = 10) {
  console.log(`\n🚀  Running Benchmark: [${name}] (${totalRequests} total reqs, concurrency=${concurrency})`);

  const results = [];
  const startOverall = Date.now();

  for (let i = 0; i < totalRequests; i += concurrency) {
    const batch = [];
    for (let c = 0; c < concurrency && i + c < totalRequests; c++) {
      batch.push(makeRequest(path, token));
    }
    const res = await Promise.all(batch);
    results.push(...res);
  }

  const totalTimeMs = Date.now() - startOverall;
  const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const successCount = results.filter((r) => r.status === 200).length;
  const rps = ((totalRequests / totalTimeMs) * 1000).toFixed(2);

  const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
  const p90 = latencies[Math.floor(latencies.length * 0.9)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);

  console.log(`    ✅  Successful Requests : ${successCount} / ${totalRequests}`);
  console.log(`    ⚡  Throughput (RPS)    : ${rps} req/sec`);
  console.log(`    ⏱️   P50 Latency        : ${p50} ms`);
  console.log(`    ⏱️   P90 Latency        : ${p90} ms`);
  console.log(`    ⏱️   P95 Latency        : ${p95} ms`);
  console.log(`    ⏱️   P99 Latency        : ${p99} ms`);

  return { name, rps, p50, p95, p99, successCount, totalRequests };
}

async function main() {
  console.log('===========================================================');
  console.log('   📊 LEDGERLY PRODUCTION PERFORMANCE BENCHMARK SUITE    ');
  console.log('===========================================================');

  try {
    const { token } = setupTestData();

    // Cold cache run vs Warm cache run
    const cold = await runBenchmark('GET /api/user/charts (Cold / Fresh Read)', '/api/user/charts', token, 50, 5);
    const warm = await runBenchmark('GET /api/user/charts (Warm Cached Read)', '/api/user/charts', token, 300, 20);
    const kpis = await runBenchmark('GET /api/user/auto-kpis (Cached Analytics)', '/api/user/auto-kpis', token, 300, 20);

    const speedup = (parseFloat(cold.p95) / parseFloat(warm.p95)).toFixed(1);

    console.log('\n===========================================================');
    console.log('   📈 BENCHMARK SUMMARY & PERFORMANCE RESULTS              ');
    console.log('===========================================================');
    console.log(`   • Cold Read P95 Latency : ${cold.p95} ms`);
    console.log(`   • Warm Read P95 Latency : ${warm.p95} ms`);
    console.log(`   • Peak Throughput       : ${warm.rps} Req/Sec`);
    console.log(`   • Latency Reduction    : ${speedup}x Faster with In-Memory LRU Cache & SQLite WAL Tuning!`);
    console.log('===========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Benchmark Error:', err);
    process.exit(1);
  }
}

main();
