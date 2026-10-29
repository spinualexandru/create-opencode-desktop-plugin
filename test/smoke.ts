// Generates every feature combination, then installs, builds, and type-checks each one.
// Run with: bun test/smoke.ts
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const cli = path.join(import.meta.dir, "..", "index.js")
const root = mkdtempSync(path.join(tmpdir(), "create-opencode-desktop-plugin-"))

const cases = [
  { dir: "full", args: [] },
  { dir: "no-server", args: ["--no-server"] },
  { dir: "no-main", args: ["--no-main"] },
  { dir: "gui-only", args: ["--no-server", "--no-main"] },
  { dir: "scoped", args: ["--name", "@acme/opencode-notes-plugin", "--no-server"] },
]

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })

  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed in ${cwd}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry === "dist") return []
    const full = path.join(dir, entry)

    return statSync(full).isDirectory() ? files(full) : [full]
  })
}

let failed = 0

for (const test of cases) {
  const target = path.join(root, test.dir)

  try {
    run("node", [cli, target, "--yes", "--no-install", ...test.args], root)

    for (const file of files(target)) {
      const text = readFileSync(file, "utf8")

      if (/__[A-Z_]+__/.test(text)) throw new Error(`unreplaced token in ${file}`)
      if (/#(if|else|endif)\b/.test(text)) throw new Error(`leftover directive in ${file}`)
    }
    if (!existsSync(path.join(target, ".gitignore"))) throw new Error("missing .gitignore")

    run("bun", ["install"], target)
    run("bun", ["run", "build"], target)
    run("bun", ["run", "typecheck"], target)
    if (!existsSync(path.join(target, "dist", "gui-experimental.cjs"))) throw new Error("missing bundle")

    console.log(`✔ ${test.dir}`)
  } catch (error) {
    failed++
    console.error(`✘ ${test.dir}\n${error instanceof Error ? error.message : error}`)
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed; output kept in ${root}`)
  process.exit(1)
}

rmSync(root, { recursive: true, force: true })
console.log("\nAll cases passed.")
