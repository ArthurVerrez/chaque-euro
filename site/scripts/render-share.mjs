import { mkdtempSync, rmSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { env } from "node:process";

const chromeApp =
  !env.CHROME_BIN && platform() === "darwin"
    ? spawnSync("mdfind", ["kMDItemCFBundleIdentifier == 'com.google.Chrome'"], {
        encoding: "utf8",
      })
        .stdout.trim()
        .split("\n")[0]
    : null;
const browser =
  env.CHROME_BIN ||
  (chromeApp ? join(chromeApp, "Contents", "MacOS", "Google Chrome") : "chromium");
const profile = mkdtempSync(join(tmpdir(), "chaque-euro-share-"));
try {
  const result = spawnSync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      "--virtual-time-budget=2000",
      `--user-data-dir=${profile}`,
      `--screenshot=${fileURLToPath(new URL("../public/share.png", import.meta.url))}`,
      new URL("share.html", import.meta.url).href,
    ],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
