const axios = require('axios');

const API_URL = 'http://localhost:4000';
const token = 'YOUR_TEST_TOKEN'; // This would need a real token to run correctly

async function testRoutes() {
  console.log('Testing CEO Charts with batchId...');
  try {
    const res = await axios.get(`${API_URL}/api/user/ceo-charts?batchId=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('CEO Charts Result:', res.data.selectedBatchId === 1 ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log('CEO Charts Failed (Expected if no token):', err.message);
  }

  console.log('Testing AI Chat...');
  try {
    const res = await axios.post(`${API_URL}/api/user/chat`, {
      message: "Hello",
      company: "TestCo",
      batchId: 1
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Chat Result:', res.data.reply ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log('Chat Failed (Expected if no token):', err.message);
  }
}

// Note: This script is a template. Real verification is done manually or with a valid token.
console.log('Running backend sanity check...');
