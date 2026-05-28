interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

interface RawEntry {
  date: string;
  weight_kg: number;
  waist_cm: number;
  dose: string;
  pen: number;
}

const HEIGHT_M = 1.70;
const HEIGHT_CM = 170;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.API_TOKEN}`;
}

function computeFields(rows: RawEntry[]) {
  let sumDiffs = 0;
  let diffCount = 0;
  return rows.map((row, i) => {
    const bmi = row.weight_kg / (HEIGHT_M * HEIGHT_M);
    const wthr = row.waist_cm / HEIGHT_CM;
    let weight_diff_kg: number | null = null;
    let pct_change_wow: number | null = null;
    let mean_wow_change: number | null = null;
    if (i > 0) {
      weight_diff_kg = row.weight_kg - rows[i - 1].weight_kg;
      pct_change_wow = (weight_diff_kg / rows[i - 1].weight_kg) * 100;
      sumDiffs += weight_diff_kg;
      diffCount++;
      mean_wow_change = sumDiffs / diffCount;
    }
    return {
      ...row,
      weight_diff_kg,
      pct_change_wow,
      mean_wow_change,
      bmi: Math.round(bmi * 10) / 10,
      wthr: Math.round(wthr * 1000) / 1000,
    };
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (path === "/api/entries" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM entries ORDER BY date ASC"
        ).all<RawEntry>();
        return json({ entries: computeFields(results) });
      }

      if (path === "/api/entries" && method === "POST") {
        if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
        const body = await request.json<RawEntry>();
        try {
          await env.DB.prepare(
            "INSERT INTO entries (date, weight_kg, waist_cm, dose, pen) VALUES (?, ?, ?, ?, ?)"
          ).bind(body.date, body.weight_kg, body.waist_cm, body.dose, body.pen).run();
        } catch {
          return json({ error: "Entry already exists for this date" }, 409);
        }
        return json(body, 201);
      }

      const dateMatch = path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch) {
        if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
        const date = dateMatch[1];

        if (method === "PUT") {
          const body = await request.json<RawEntry>();
          const result = await env.DB.prepare(
            "UPDATE entries SET weight_kg = ?, waist_cm = ?, dose = ?, pen = ? WHERE date = ?"
          ).bind(body.weight_kg, body.waist_cm, body.dose, body.pen, date).run();
          if (!result.meta.changes) return json({ error: "Entry not found" }, 404);
          return json({ ...body, date });
        }

        if (method === "DELETE") {
          const result = await env.DB.prepare(
            "DELETE FROM entries WHERE date = ?"
          ).bind(date).run();
          if (!result.meta.changes) return json({ error: "Entry not found" }, 404);
          return new Response(null, { status: 204, headers: corsHeaders() });
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  },
};
