const REQUIRED_FIELDS = [
  "q1", "q2", "q3", "q4", "q5a", "q5b", "q5c", "q5d", "q6", "q7",
  "q8", "q9a", "q9b", "q9c", "q9d", "q10", "q11", "q12",
  "q13a", "q13b", "q13c", "q13d", "q14", "q15", "q16",
  "q17a", "q17b", "q17c", "q17d", "q18", "q19", "q20", "q21"
];

const ALLOWED_FIELDS = [...REQUIRED_FIELDS, "q22"];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true }, 200, cors);
      }

      if (url.pathname === "/submit" && request.method === "POST") {
        return await submitResponse(request, env, cors);
      }

      if (url.pathname === "/results" && request.method === "GET") {
        return await listResponses(request, env, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, 500, cors);
    }
  }
};

async function submitResponse(request, env, cors) {
  const body = await readJson(request);

  if (env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      body.turnstileToken,
      request.headers.get("CF-Connecting-IP")
    );
    if (!ok) {
      return json({ error: "No se pudo verificar la protección anti-spam." }, 403, cors);
    }
  }

  const response = sanitizeResponse(body.response);
  const missing = REQUIRED_FIELDS.filter((field) => isMissing(response[field]));
  if (missing.length) {
    return json({ error: "Faltan campos obligatorios.", missing }, 400, cors);
  }

  const createdAt = new Date().toISOString();
  response.timestamp = createdAt;

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO responses (id, created_at, payload) VALUES (?, ?, ?)"
  ).bind(id, createdAt, JSON.stringify(response)).run();

  return json({ ok: true, id, createdAt }, 201, cors);
}

async function listResponses(request, env, cors) {
  if (!env.ADMIN_KEY) {
    return json({ error: "ADMIN_KEY no configurado en el Worker." }, 503, cors);
  }

  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const key = request.headers.get("x-admin-key") || bearer;

  if (!key || key !== env.ADMIN_KEY) {
    return json({ error: "Clave de administración no válida." }, 401, cors);
  }

  const result = await env.DB.prepare(
    "SELECT id, created_at, payload FROM responses ORDER BY created_at ASC"
  ).all();

  const responses = (result.results || []).map((row) => {
    const payload = JSON.parse(row.payload);
    payload.id = row.id;
    payload.timestamp = payload.timestamp || row.created_at;
    return payload;
  });

  return json({ ok: true, responses }, 200, cors);
}

function sanitizeResponse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Respuesta inválida.");
  }

  const clean = {};
  for (const field of ALLOWED_FIELDS) {
    const value = input[field];
    if (Array.isArray(value)) {
      clean[field] = value.map((item) => String(item).trim()).filter(Boolean).slice(0, 10);
    } else if (value == null) {
      clean[field] = field === "q22" ? "" : value;
    } else {
      clean[field] = String(value).trim().slice(0, field === "q22" ? 2000 : 300);
    }
  }
  return clean;
}

function isMissing(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type debe ser application/json.");
  }
  return request.json();
}

async function verifyTurnstile(secret, token, remoteIp) {
  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const data = await response.json();
  return Boolean(data.success);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-admin-key",
    "Vary": "Origin"
  };
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
