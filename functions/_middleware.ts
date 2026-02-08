type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}) => Promise<Response>;

function buildCorsHeaders(origin: string | null, request: Request) {
  const headers = new Headers();
  const reqUrl = new URL(request.url);
  const allowedOrigins = new Set<string>([
    `${reqUrl.protocol}//${reqUrl.host}`,
    "http://localhost:5173",
    "http://localhost:5175",
    "http://localhost:8788",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8788",
  ]);

  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "";
  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }

  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export const onRequest: PagesFunction = async ({ request, next }) => {
  const origin = request.headers.get("Origin");
  const corsHeaders = buildCorsHeaders(origin, request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  corsHeaders.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
