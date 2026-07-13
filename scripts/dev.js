const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");

const backend = spawn(process.execPath, [
  path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
  "server/index.ts",
], {
  cwd: ROOT,
  stdio: "inherit",
});

const frontend = spawn(
  process.execPath,
  [path.join(FRONTEND, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3000"],
  { cwd: FRONTEND, stdio: "inherit" }
);

backend.on("error", (err) => {
  console.error("Backend failed to start:", err.message);
});

frontend.on("error", (err) => {
  console.error("Frontend failed to start:", err.message);
});

console.log("\n  Backend:  http://localhost:8020");
console.log("  Frontend: http://localhost:3000\n");

function cleanup() {
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
