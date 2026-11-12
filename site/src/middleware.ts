import { defineMiddleware } from "astro:middleware";
import { busyResponse } from "./lib/busy";

const MAX_IN_FLIGHT = 32;
let inFlight = 0;

export const onRequest = defineMiddleware(async (context, next) => {
  if (inFlight >= MAX_IN_FLIGHT) return busyResponse();
  inFlight += 1;
  try {
    const response = await next();
    const html = response.headers.get("Content-Type")?.startsWith("text/html");
    if (["GET", "HEAD"].includes(context.request.method) && html && response.status === 200) {
      response.headers.set(
        "Cache-Control",
        context.url.pathname === "/elus" || context.url.pathname.startsWith("/elus/")
          ? "no-store"
          : "public, max-age=600, stale-while-revalidate=86400, stale-if-error=604800",
      );
    }
    return response;
  } finally {
    inFlight -= 1;
  }
});
