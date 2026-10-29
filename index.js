#!/usr/bin/env node
// create-opencode-desktop-plugin: scaffolds an OpenCode Desktop GUI plugin.
// Usage: bun create opencode-desktop-plugin [directory] [options]

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), "template")

// Versions the template is tested with.
const VERSIONS = {
  "@opencode/plugin": "^2.2.1",
  "@types/node": "^24.0.0",
  electron: "^45.0.0",
  "solid-js": "^1.9.0",
  typescript: "^5.9.0",
  vite: "^8.0.0",
  "vite-plugin-solid": "^2.11.0",
}

const HELP = `
Create an OpenCode Desktop GUI plugin.

Usage
  bun create opencode-desktop-plugin [directory] [options]

Options
  --name <name>     npm package name (default: from the directory)
  --id <id>         plugin id used by the server part, commands, and tokens (default: from the name)
  --title <title>   display name in the app (default: from the id)
  --description <d> package description
  --no-server       skip the server part (src/index.ts) and its RPC
  --no-main         skip the Electron main-process part (Ipc, native menu item)
  --no-install      do not run "bun install" and the first build
  --force           write into a non-empty directory
  -y, --yes         accept defaults without prompting
  -h, --help        show this help
`

function parseArgs(argv) {
  const args = { server: true, main: true, install: true, force: false, yes: false, positional: [] }
  const takesValue = new Set(["name", "id", "title", "description"])

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "-h" || arg === "--help") args.help = true
    else if (arg === "-y" || arg === "--yes") args.yes = true
    else if (arg === "--force") args.force = true
    else if (arg === "--no-server") args.server = args.serverSet = false
    else if (arg === "--no-main") args.main = args.mainSet = false
    else if (arg === "--no-install") args.install = false
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s)

      if (!takesValue.has(key)) fail(`Unknown option: ${arg}`)
      const value = inline ?? argv[++i]
      if (value === undefined) fail(`Missing value for --${key}`)
      args[key] = value
    } else args.positional.push(arg)
  }

  return args
}

function fail(message) {
  console.error(`\x1b[31merror\x1b[0m ${message}`)
  process.exit(1)
}

// "My Cool Thing" -> "my-cool-thing"
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function idFromName(name) {
  const id = slugify(name)
    .replace(/^opencode-/, "")
    .replace(/-?(opencode-)?(desktop-|gui-)?plugin$/, "")

  return id || "my-plugin"
}

function titleFromId(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
}

function validateName(name) {
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) return "is not a valid npm package name"
  if (name.length > 214) return "is too long"
}

function validateId(id) {
  if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/.test(id))
    return "must be lowercase letters, digits, and dashes (dots for nesting), starting with a letter"
  if (id === "opencode" || id.startsWith("opencode.") || id.startsWith("opencode-"))
    return "must not use the reserved opencode namespace"
}

// Reads answers from a line iterator, which buffers lines that arrive before a question is asked (pasted input).
function createAsker() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false })
  const lines = rl[Symbol.asyncIterator]()

  const ask = async (text) => {
    process.stdout.write(text)
    const next = await lines.next()

    if (next.done) fail("Input ended before every question was answered.")
    return next.value.trim()
  }

  return { ask, close: () => rl.close() }
}

async function prompt(asker, question, fallback, validate) {
  for (;;) {
    const answer = (await asker.ask(`\x1b[36m?\x1b[0m ${question} \x1b[2m(${fallback})\x1b[0m `)) || fallback
    const error = validate?.(answer)

    if (!error) return answer
    console.log(`  \x1b[31m${answer} ${error}\x1b[0m`)
  }
}

async function confirm(asker, question, fallback) {
  const answer = (await asker.ask(`\x1b[36m?\x1b[0m ${question} \x1b[2m(${fallback ? "Y/n" : "y/N"})\x1b[0m `)).toLowerCase()

  return answer ? answer.startsWith("y") : fallback
}

// Applies feature conditionals and replaces tokens.
// Line directives: a line that is only `// #if x`, `{/* #if x */}`, `/* #if x */`, or `<!-- #if x -->`
// (also #else, #endif; `!x` negates). Inline: `<!-- #if x -->text<!-- #endif -->` within one line.
function render(source, features, tokens) {
  const enabled = (flag) => (flag.startsWith("!") ? !features[flag.slice(1)] : !!features[flag])
  const directive =
    /^\s*(?:\/\/\s*#(if|else|endif)\b\s*(!?\w+)?|\{\/\*\s*#(if|else|endif)\b\s*(!?\w+)?\s*\*\/\}|\/\*\s*#(if|else|endif)\b\s*(!?\w+)?\s*\*\/|<!--\s*#(if|else|endif)\b\s*(!?\w+)?\s*-->)\s*$/
  const stack = []
  const out = []

  for (const line of source.split("\n")) {
    const match = line.match(directive)

    if (match) {
      const kind = match[1] ?? match[3] ?? match[5] ?? match[7]
      const flag = match[2] ?? match[4] ?? match[6] ?? match[8]

      if (kind === "if") stack.push({ active: enabled(flag) })
      else if (kind === "else") stack[stack.length - 1].active = !stack[stack.length - 1].active
      else stack.pop()
      continue
    }
    if (stack.every((s) => s.active)) out.push(line)
  }

  return out
    .join("\n")
    .replace(/<!--\s*#if\s+(!?\w+)\s*-->(.*?)<!--\s*#endif\s*-->/g, (_, flag, text) => (enabled(flag) ? text : ""))
    .replace(/__([A-Z_]+)__/g, (whole, key) => tokens[key] ?? whole)
}

// Files that only exist with a feature.
const FEATURE_FILES = {
  "src/index.ts": "server",
  "src/rpc.ts": "server",
  "src/gui/contract.ts": "main",
  "src/gui/main.ts": "main",
}

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)

    return statSync(full).isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join("/")]
  })
}

function packageJson({ name, description, features }) {
  const exports = {}

  if (features.server) exports["."] = "./src/index.ts"
  exports["./gui-experimental"] = "./dist/gui-experimental.cjs"

  const devDependencies = {
    "@types/node": VERSIONS["@types/node"],
    ...(features.main ? { electron: VERSIONS.electron } : {}),
    "solid-js": VERSIONS["solid-js"],
    typescript: VERSIONS.typescript,
    vite: VERSIONS.vite,
    "vite-plugin-solid": VERSIONS["vite-plugin-solid"],
  }

  return {
    name,
    version: "0.1.0",
    description,
    type: "module",
    keywords: ["opencode", "opencode-plugin", "opencode-desktop"],
    exports,
    files: ["src", "dist"],
    scripts: {
      build: "vite build",
      dev: "vite build --watch",
      typecheck: "tsc --noEmit",
      prepublishOnly: "vite build",
    },
    dependencies: { "@opencode/plugin": VERSIONS["@opencode/plugin"] },
    devDependencies,
  }
}

function hasBun() {
  return spawnSync("bun", ["--version"], { stdio: "ignore" }).status === 0
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    console.log(HELP)
    return
  }

  const interactive = !args.yes && process.stdin.isTTY && process.stdout.isTTY
  const asker = interactive ? createAsker() : undefined

  try {
    let directory = args.positional[0]
    if (!directory) directory = asker ? await prompt(asker, "Project directory:", "my-opencode-plugin") : "my-opencode-plugin"

    const target = path.resolve(directory)
    const base = slugify(path.basename(target)) || "my-opencode-plugin"

    const name = args.name ?? (asker ? await prompt(asker, "Package name:", base, validateName) : base)
    const nameError = validateName(name)
    if (nameError) fail(`Package name "${name}" ${nameError}`)

    let server = args.server
    let mainProcess = args.main
    if (asker && args.serverSet === undefined)
      server = await confirm(asker, "Include a server part with an RPC the GUI calls?", true)

    // Without a server part, the host uses the package name as the plugin id.
    let id = name
    if (server) {
      const fallback = args.id ?? idFromName(name)

      id = args.id ?? (asker ? await prompt(asker, "Plugin id:", fallback, validateId) : fallback)
      const idError = validateId(id)
      if (idError) fail(`Plugin id "${id}" ${idError}`)
    } else if (args.id) {
      console.log(`\x1b[33mwarn\x1b[0m --id is ignored without a server part; the plugin id is the package name "${name}".`)
    }

    const fallbackTitle = args.title ?? titleFromId(idFromName(name))
    const title = args.title ?? (asker ? await prompt(asker, "Display title:", fallbackTitle) : fallbackTitle)

    if (asker && args.mainSet === undefined)
      mainProcess = await confirm(asker, "Include an Electron main-process part (Ipc, native menu item)?", true)

    const description = args.description ?? `${title}: an OpenCode Desktop GUI plugin.`

    if (existsSync(target) && readdirSync(target).length > 0 && !args.force) {
      const overwrite = asker ? await confirm(asker, `${directory} is not empty. Write into it anyway?`, false) : false
      if (!overwrite) fail(`${directory} is not empty. Pass --force to write into it.`)
    }

    asker?.close()

    const features = { server, main: mainProcess }
    const tokens = {
      PLUGIN_ID: id,
      SLUG: slugify(id.replace(/\./g, "-")) || "plugin",
      TITLE: title,
      DESCRIPTION: description,
      PACKAGE_NAME: name,
      PLUGIN_DIR: target.split(path.sep).join("/"),
    }

    mkdirSync(target, { recursive: true })

    for (const file of walk(TEMPLATE)) {
      const feature = FEATURE_FILES[file]
      if (feature && !features[feature]) continue

      const output = file === "_gitignore" ? ".gitignore" : file
      const destination = path.join(target, output)

      mkdirSync(path.dirname(destination), { recursive: true })
      writeFileSync(destination, render(readFileSync(path.join(TEMPLATE, file), "utf8"), features, tokens))
    }

    writeFileSync(
      path.join(target, "package.json"),
      JSON.stringify(packageJson({ name, description, features }), null, 2) + "\n",
    )

    console.log(`\n\x1b[32m✔\x1b[0m Created ${title} in ${target}`)
    console.log(`  plugin id: ${id}`)
    console.log(`  parts: gui${server ? " + server" : ""}${mainProcess ? " + main process" : ""}\n`)

    let installed = false
    if (args.install) {
      if (hasBun()) {
        console.log("Installing dependencies with bun…\n")
        installed = spawnSync("bun", ["install"], { cwd: target, stdio: "inherit" }).status === 0
        if (installed) installed = spawnSync("bun", ["run", "build"], { cwd: target, stdio: "inherit" }).status === 0
        if (!installed) console.log("\x1b[33mwarn\x1b[0m Install or first build failed; run it yourself below.")
      } else {
        console.log("\x1b[33mwarn\x1b[0m bun was not found; install dependencies yourself.")
      }
    }

    const cd = path.relative(process.cwd(), target) || "."
    console.log(`
Next steps:

  cd ${cd}${installed ? "" : "\n  bun install"}
  bun run dev

Then add the plugin to your global OpenCode config (~/.config/opencode/opencode.jsonc)
and restart OpenCode Desktop once:

  {
    "plugins": ["${tokens.PLUGIN_DIR}"]
  }

Every rebuild then reloads the GUI. Docs: https://opencode.ai/v2/docs/build/plugins/gui
`)
  } finally {
    asker?.close()
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
