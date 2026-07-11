#!/usr/bin/env node
"use strict";

// agentping is a single-file Python 3.8+ program. This launcher runs it with
// the user's Python and passes stdio and the exit code straight through -- the
// exit code is the tool's contract (0 ok, 20 declined, 124 timeout, 2 usage,
// 3 provider), so the calling agent sees exactly what the script returns.

const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "..", "agentping");
const args = process.argv.slice(2);

// Pick a real Python 3. On Windows without Python, `python3` often resolves to
// the Microsoft Store App Execution Alias, which *launches* (so it is not an
// ENOENT error) but prints "Python was not found..." and exits non-zero without
// running anything. Probing `--version` and requiring an exit-0 "Python 3.x"
// banner skips that stub instead of committing to it and never trying real Python.
function usable(cmd) {
  const probeArgs = cmd === "py" ? ["-3", "--version"] : ["--version"];
  const probe = spawnSync(cmd, probeArgs, { encoding: "utf8" });
  if (probe.error) return null;
  const banner = (probe.stdout || "") + (probe.stderr || "");
  if (probe.status !== 0 || !/Python 3\./.test(banner)) return null;
  return cmd === "py" ? { cmd: "py", pre: ["-3"] } : { cmd, pre: [] };
}

let chosen = null;
if (process.env.AGENTPING_PYTHON) {
  chosen = { cmd: process.env.AGENTPING_PYTHON, pre: [] }; // explicit override: trust it
} else {
  for (const cmd of ["python3", "python", "py"]) {
    chosen = usable(cmd);
    if (chosen) break;
  }
}

if (!chosen) {
  process.stderr.write(
    "agentping needs Python 3.8+ on PATH (tried: python3, python, py). " +
    "Install Python 3, or set AGENTPING_PYTHON to its full path.\n");
  process.exit(3);
}

const result = spawnSync(chosen.cmd, [...chosen.pre, script, ...args], { stdio: "inherit" });
if (result.error) {
  process.stderr.write("agentping: " + String(result.error) + "\n");
  process.exit(3);
}
process.exit(result.status === null ? 1 : result.status);
