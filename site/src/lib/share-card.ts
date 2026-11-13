import regularFont from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import boldFont from "@fontsource/inter/files/inter-latin-800-normal.woff?inline";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
// satori stays at 0.32: from 0.33 it loads HarfBuzz, which workerd cannot run.
import satori, { init } from "satori/standalone";
import layoutWasm from "satori/yoga.wasm";
import logo from "../../public/logo.svg?raw";

export interface ShareCard {
  kicker: string;
  title: string;
  figure?: string;
  note?: string;
  source: string;
}

const WIDTH = 1200;
const HEIGHT = 630;
const NAVY = "#0d2149";
const SECONDARY = "#3b4556";
const MUTED = "#5a6474";

const bytes = (dataUrl: string) =>
  Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (char) => char.charCodeAt(0))
    .buffer;
const fonts = [
  { name: "Inter", data: bytes(regularFont), weight: 400 as const },
  { name: "Inter", data: bytes(boldFont), weight: 800 as const },
];
const logoUrl = `data:image/svg+xml;base64,${btoa(logo)}`;
let ready: Promise<unknown> | undefined;

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; src?: string; width?: number; height?: number; children?: unknown };
}
const box = (style: Style, children?: unknown): Node => ({
  type: "div",
  props: { style, children },
});

function layout(card: ShareCard): Node {
  const titleSize = card.title.length > 40 ? 56 : card.title.length > 24 ? 68 : 84;
  return box(
    {
      display: "flex",
      flexDirection: "column",
      width: WIDTH,
      height: HEIGHT,
      padding: "56px 80px 52px",
      borderTop: `12px solid ${NAVY}`,
      background: "#f5f7fb",
      fontFamily: "Inter",
      color: NAVY,
    },
    [
      box({ display: "flex", alignItems: "center", gap: 20 }, [
        { type: "img", props: { src: logoUrl, width: 64, height: 64 } },
        box({ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }, "Chaque Euro"),
      ]),
      box({ display: "flex", flexDirection: "column", marginTop: 44, flexGrow: 1 }, [
        box({ fontSize: 28, color: MUTED }, card.kicker),
        box(
          {
            fontSize: titleSize,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.05,
            lineClamp: 3,
            marginTop: 8,
          },
          card.title,
        ),
        card.figure
          ? box(
              {
                fontSize: 60,
                fontWeight: 800,
                letterSpacing: -1.5,
                marginTop: 28,
                color: "#1d4fae",
              },
              card.figure,
            )
          : box({ width: 72, height: 4, marginTop: 32, background: "#2a78d6" }),
        card.note
          ? box({ fontSize: 28, color: SECONDARY, marginTop: 10, lineClamp: 2 }, card.note)
          : null,
      ]),
      box({ display: "flex", justifyContent: "space-between", fontSize: 24, color: MUTED }, [
        box({}, card.source),
        box({ fontWeight: 800, color: NAVY }, "chaqueeuro.fr"),
      ]),
    ],
  );
}

export async function renderShareCard(card: ShareCard): Promise<Uint8Array<ArrayBuffer>> {
  ready ??= Promise.all([init(layoutWasm), initWasm(resvgWasm)]);
  await ready;
  const svg = await satori(layout(card) as never, { width: WIDTH, height: HEIGHT, fonts });
  return new Resvg(svg).render().asPng().slice();
}
