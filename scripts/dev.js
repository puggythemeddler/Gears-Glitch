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

console.log("\n  Backend:  http://localhost:8020");
console.log("  Frontend: http://localhost:3000\n");

process.on("SIGINT", () => {
  backend.kill();
  frontend.kill();
  process.exit();
});

process.on("SIGTERM", () => {
  backend.kill();
  frontend.kill();
  process.exit();
});
