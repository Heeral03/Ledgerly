const axios = require('axios');

/**
 * Service to interact with Groq AI for financial analysis.
 */
class AIService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async analyzeCompany(companyName, metrics) {
    if (!this.apiKey) {
      console.warn('GROQ_API_KEY not found in .env');
      return null;
    }

    const prompt = `You are a senior financial analyst. Analyze the monthly financial data below for "${companyName}" and return ONLY a valid JSON object — no markdown, no explanation, no text outside the JSON.

Your goal is to provide a "Chart Visual Analysis" that helps the CEO understand the trends shown in the dashboard's charts.

DATA:
${JSON.stringify(metrics, null, 2)}

Return this exact structure:
{
  "observations": [
    "Observation referencing specific numbers and month-over-month (MoM) % changes",
    "Observation referencing specific numbers and month-over-month (MoM) % changes",
    "Observation referencing specific numbers and month-over-month (MoM) % changes"
  ],
  "risk": "Identify the biggest financial risk from the data, citing specific figures (e.g., 'Unsecured loan jumped 100% MoM while revenue is flat')",
  "action": "One concrete, data-backed action the CEO should take immediately",
  "chartInsights": {
    "revenueVsExpenses": "Analyze the Line Chart: Describe the gap between Revenue and Expenses. Identify if they are converging or diverging, and mention which month had the narrowest or widest gap.",
    "profitLoss": "Analyze the Bar Chart: Describe the P&L trajectory. Is it consistently positive? Identify any sudden swings and explain what might have caused them based on the data.",
    "liquidity": "Analyze the Area Chart: Compare 'Bank & Cash' vs 'Total Loans'. Is the cash runway safe? Mention if loans are growing faster than cash reserves.",
    "expenseBreakdown": "Analyze the Stacked Bar Chart: Identify the dominant expense category. Mention its exact percentage of total expenses and whether it is trending up or down."
  }
}

Requirements:
- Every insight must reference specific numbers or percentage changes from the provided data.
- Be precise — each insight string should be 30-60 words.
- Focus on the *visual* story the charts tell.
- Respond ONLY with the JSON object.
    `;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 800,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const raw = response.data.choices[0].message.content.trim();
      // Extract JSON safely — Groq sometimes wraps in ```json ``` blocks
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return JSON.stringify(parsed);
      }
      return raw;
    } catch (err) {
      console.error('Groq AI API Error:', err.response?.data || err.message);
      return null;
    }
  }

  async chat(message, metrics, company) {
    if (!this.apiKey) {
      console.warn('GROQ_API_KEY not found in .env');
      return "AI chatbot unavailable (key missing).";
    }

    const datasetName = company || 'this dataset';
    const prompt = `You are a financial analyst. Answer the user's question about "${datasetName}" using only the data provided. Be direct and specific — always cite actual numbers from the data.

FINANCIAL DATA:
${JSON.stringify(metrics, null, 2)}

QUESTION: ${message}

RULES:
- Use exact figures from the data
- If a trend exists, describe it clearly with percentages
- If the question involves a chart or graph, describe what the chart shows
- If the data doesn't answer the question, say exactly what's missing
- No filler, no markdown, no bullet symbols
- Max 150 words`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('Groq AI Chat Error:', err.response?.data || err.message);
      return "I'm sorry, I'm having trouble processing your request right now.";
    }
  }
}

module.exports = new AIService();
