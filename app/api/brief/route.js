import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const cache = new Map();

function dateISO(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getDays(windowKey) {
  if (windowKey === "month") return 30;
  if (windowKey === "week") return 7;
  return 1;
}

async function fetchFinnhubNews(ticker, windowKey) {
  const days = getDays(windowKey);

  const url =
    `https://finnhub.io/api/v1/company-news?symbol=${ticker}` +
    `&from=${dateISO(days)}&to=${dateISO(0)}` +
    `&token=${process.env.FINNHUB_API_KEY}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Finnhub error for ${ticker}: ${res.status}`);
  }

  const data = await res.json();

  return data.slice(0, 8).map((a) => ({
    title: a.headline || "",
    source: a.source || "",
    date: a.datetime ? new Date(a.datetime * 1000).toISOString().slice(0, 10) : "",
    url: a.url || "",
    summary: a.summary || "",
  }));
}

function extractJSON(text) {
  if (!text) return null;

  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) return null;

  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function POST(req) {
  try {
    const { holdings, windowKey } = await req.json();

    const cacheKey = JSON.stringify({ holdings, windowKey });
    const cached = cache.get(cacheKey);

    const cacheMs =
      windowKey === "day"
        ? 1000 * 60 * 60
        : windowKey === "week"
        ? 1000 * 60 * 60 * 6
        : 1000 * 60 * 60 * 12;

    if (cached && Date.now() - cached.time < cacheMs) {
      return Response.json(cached.data);
    }

    const articlesByTicker = {};

    for (const h of holdings) {
      try {
        articlesByTicker[h.ticker] = await fetchFinnhubNews(h.ticker, windowKey);
      } catch {
        articlesByTicker[h.ticker] = [];
      }
    }

    const windowLabel =
      windowKey === "month"
        ? "the past 30 days"
        : windowKey === "week"
        ? "the past 7 days"
        : "the past 24 hours";

    const prompt = `
You are a careful financial news summarizer.

Create a portfolio brief for this time window: ${windowLabel}

Holdings:
${JSON.stringify(holdings, null, 2)}

News articles grouped by ticker:
${JSON.stringify(articlesByTicker, null, 2)}

Return ONLY valid JSON in exactly this shape:
{
  "overview": {
    "sentiment": "positive | negative | neutral | mixed",
    "headline": "one sentence overall portfolio read",
    "summary": "2-3 sentence overview across all holdings",
    "positiveTickers": [],
    "negativeTickers": [],
    "neutralTickers": []
  },
  "briefs": [
    {
      "ticker": "ASML",
      "name": "ASML Holding",
      "sentiment": "positive | negative | neutral | mixed",
      "takeaway": "one plain sentence on what matters most",
      "items": [
        {
          "title": "exact article title from provided articles",
          "source": "source from provided articles",
          "date": "YYYY-MM-DD",
          "url": "exact URL from provided articles",
          "summary": "1-2 sentence plain summary"
        }
      ]
    }
  ]
}

Rules:
- Include every holding.
- Preserve company-level "items" arrays.
- Each company may include up to 4 article items.
- Do not remove article citations just because overview exists.
- Use only articles provided above.
- Do not invent URLs.
- If no relevant news for a holding, use "items": [] and explain in the takeaway.
- The overview should summarize across the company briefs, not replace them.
- Do not give investment advice.
- No markdown.
- No prose outside JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    const data = extractJSON(text);

    if (!data) {
      return Response.json({ error: "Could not parse Gemini response" }, { status: 500 });
    }

    cache.set(cacheKey, { time: Date.now(), data });

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
