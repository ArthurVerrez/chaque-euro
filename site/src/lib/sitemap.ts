import { PUBLIC_ORIGIN } from "./site";

export function sitemapResponse(tag: "urlset" | "sitemapindex", paths: string[]): Response {
  const item = tag === "urlset" ? "url" : "sitemap";
  const entries = paths.map(
    (path) =>
      `<${item}><loc>${new URL(path, PUBLIC_ORIGIN).href.replaceAll("&", "&amp;")}</loc></${item}>`,
  );
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</${tag}>\n`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
