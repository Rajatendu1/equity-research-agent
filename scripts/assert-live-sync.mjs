import { execFileSync } from "node:child_process";

const liveUrl = process.env.VIGILANT_LIVE_URL ?? "https://equity-research-agent.rajatendud.chatgpt.site";
const expectedCommit =
  process.env.EXPECTED_COMMIT ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const response = await fetch(new URL("/api/version", liveUrl));

if (!response.ok) {
  throw new Error(`Live version check failed with HTTP ${response.status}.`);
}

const payload = await response.json();
const liveCommit = payload?.commit;

if (liveCommit !== expectedCommit) {
  console.error("Live deployment is out of sync.");
  console.error(`Expected GitHub/local HEAD: ${expectedCommit}`);
  console.error(`Live app reports:        ${liveCommit ?? "missing"}`);
  process.exit(1);
}

console.log(`Live deployment is in sync at ${liveCommit}.`);
