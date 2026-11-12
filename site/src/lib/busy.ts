import logo from "../../public/logo.svg?raw";

const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Chaque Euro revient vite</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        box-sizing: border-box;
        background: #f2f5fb;
        color: #0f172a;
        font: 1rem/1.6 system-ui, sans-serif;
      }
      main {
        max-width: 32rem;
        padding: 2rem;
        border: 1px solid #e1e5ec;
        border-radius: 16px;
        background: #fff;
      }
      svg {
        width: 3rem;
        height: 3rem;
      }
      h1 {
        margin: 1rem 0 0.5rem;
        color: #0d2149;
        font-size: 1.5rem;
        line-height: 1.25;
      }
      p {
        margin: 0 0 0.75rem;
        color: #5a6474;
      }
      a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        margin-top: 0.5rem;
        padding: 0 1.25rem;
        border-radius: 999px;
        background: #0d2149;
        color: #fff;
        font-weight: 650;
        text-decoration: none;
      }
      a:focus-visible {
        outline: 2px solid #2a78d6;
        outline-offset: 2px;
      }
    </style>
  </head>
  <body>
    <main>
      ${logo}
      <h1>Trop de visites en ce moment</h1>
      <p>Chaque Euro reçoit plus de visites que ses serveurs ne peuvent en servir. Nous y travaillons&nbsp;: le site revient au plus vite.</p>
      <p>Chaque Euro est un projet gratuit et indépendant, financé par son éditeur. Merci de votre patience.</p>
      <a href="">Réessayer</a>
    </main>
  </body>
</html>
`;

export function busyResponse(): Response {
  return new Response(PAGE, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
    },
  });
}
