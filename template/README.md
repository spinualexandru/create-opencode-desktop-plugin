# __TITLE__

__DESCRIPTION__

An [OpenCode Desktop](https://opencode.ai) GUI plugin, built with the experimental
[GUI plugin SDK](https://opencode.ai/v2/docs/build/plugins/gui) (`@opencode/plugin/gui`).

> The GUI plugin API is experimental and may change between releases.

## What's inside

```
src/
<!-- #if server -->
├── index.ts            Server part: Plugin.define from @opencode/plugin (id "__PLUGIN_ID__")
├── rpc.ts              RPC contract between the server part and the GUI
<!-- #endif -->
├── gui.tsx             ./gui-experimental entry: Plugin.define({ ...definition, setup<!-- #if main -->, main<!-- #endif --> })
└── gui/
    ├── definition.ts   Stores and i18n
<!-- #if main -->
    ├── contract.ts     Ipc token shared by the window and the main process
    ├── main.ts         Electron main process: Ipc provider and a Help menu item
<!-- #endif -->
    ├── window.tsx      Window setup: panel, commands, launcher, titlebar pill, settings page
    ├── panel.tsx       Side panel component
    ├── settings.tsx    Settings page component
    ├── style.css       Styles injected with ctx.add(Style, css)
    └── i18n/en.ts      English copy
```

## Develop

```sh
bun install
bun run dev        # vite build --watch → dist/gui-experimental.cjs
```

Add the plugin's directory to your **global** OpenCode config, `~/.config/opencode/opencode.jsonc`
(the desktop app does not read `cli.json`):

```jsonc
{
  "plugins": ["__PLUGIN_DIR__"],
}
```

Restart OpenCode Desktop once. After that, every rebuild reloads the plugin's GUI in every window<!-- #if main --> and in the main process<!-- #endif -->.
Find it under **Settings > Extensions > Plugins**, run **__TITLE__** commands from the command palette, or open its
panel from the side panel's **+** menu.

## Scripts

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `bun run build`     | Builds `dist/gui-experimental.cjs` once        |
| `bun run dev`       | Rebuilds on every change                       |
| `bun run typecheck` | Type-checks the project with `tsc`             |

## Publish

`bun run build` runs before `npm publish` (`prepublishOnly`). Users then add the package name to
`plugins` in their `opencode.json(c)`; there is no separate GUI install step.

## Notes

- Only import shared modules the app provides (`effect`, `solid-js`, `solid-js/web`, `solid-js/store`,
  `@opencode/plugin/gui`, `@opencode/plugin/rpc`, `@opencode/client`, …). The build fails on any other
  `effect/*`, `solid-js/*`, or `@opencode/*` module.
- Both processes evaluate the same bundle. Keep window code inside `setup` and main-process code inside `main`;
  each process sees inert placeholders for the other's modules.
- Token ids (`Ipc`, `Contract`, `Registry`) must be the plugin id or start with `__PLUGIN_ID__.`.
