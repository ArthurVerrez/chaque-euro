import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const html = response.headers.get("Content-Type")?.startsWith("text/html");
  if (["GET", "HEAD"].includes(context.request.method) && html && response.status === 200) {
    response.headers.set(
      "Cache-Control",
      context.url.pathname === "/elus" || context.url.pathname.startsWith("/elus/")
        ? "no-store"
        : "public, max-age=300, s-maxage=3600",
    );
  }
  return response;
});
