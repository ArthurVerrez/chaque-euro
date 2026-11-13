import type { APIRoute } from "astro";
import { ANALYSES } from "../../../lib/analyses";
import { getCommune, getDepartement, getOrganisation } from "../../../lib/data";
import { formatEuro } from "../../../lib/format";
import { renderShareCard, type ShareCard } from "../../../lib/share-card";

const CARDS: Record<string, (id: string) => Promise<ShareCard | null>> = {
  async commune(insee) {
    const commune = /^[0-9][0-9AB][0-9]{3}$/.test(insee) ? await getCommune(insee) : null;
    if (!commune) return null;
    const { year, stratum, lines } = commune.accounts;
    const spending = lines.find((line) => line.item === "depenses");
    return {
      kicker: `Commune · ${commune.departmentName} (${commune.departmentCode})`,
      title: commune.name,
      ...(spending?.perCapita != null && {
        figure: `${formatEuro(spending.perCapita)} par habitant`,
      }),
      ...(stratum &&
        spending?.median != null && {
          note: `Médiane des communes de ${stratum.label} : ${formatEuro(spending.median)}`,
        }),
      source: `Source : OFGL, dépenses ${year}`,
    };
  },
  async departement(code) {
    const departement = /^[0-9][0-9AB]$|^97[1-6]$/.test(code) ? await getDepartement(code) : null;
    if (!departement) return null;
    return {
      kicker: `Département (${departement.code})`,
      title: departement.name,
      figure: `${formatEuro(departement.perCapita)} par habitant`,
      note: "Dépenses des communes du département",
      source: `Source : OFGL, dépenses ${departement.year}`,
    };
  },
  async organisation(siren) {
    const org = /^[0-9]{9}$/.test(siren) ? await getOrganisation(siren) : null;
    if (!org) return null;
    return {
      kicker: org.commune ? `${org.kind} · ${org.commune.name}` : org.kind,
      title: org.name,
      note: "Marchés publics et versements de l’État, avec leurs sources",
      source: "Sources : DECP, Sirene, budget de l’État",
    };
  },
  async analyse(slug) {
    const article = ANALYSES.find((entry) => entry.slug === slug);
    if (!article) return null;
    return {
      kicker: "Analyse",
      title: article.title,
      note: article.summary,
      source: "Sources officielles citées dans l’analyse",
    };
  },
};

export const GET: APIRoute = async ({ params }) => {
  const kind = params.kind ?? "";
  const card = Object.hasOwn(CARDS, kind) ? await CARDS[kind]?.(params.id ?? "") : null;
  if (!card) return new Response(null, { status: 404 });
  return new Response(await renderShareCard(card), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
};
