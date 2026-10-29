import { app, dialog } from "electron"
import { Plugin } from "@opencode/plugin/gui"
import { MenubarItem } from "@opencode/plugin/gui/main"
import { Native } from "./contract"

// Runs once in the Electron main process, with Node built-ins and electron.
export const main: Plugin.MainSetup = (ctx) => {
  ctx.log.write("info", "__PLUGIN_ID__ main started", { version: ctx.app.version })

  ctx.provide(Native, {
    info: () => ({
      platform: process.platform,
      electron: process.versions.electron ?? "unknown",
      windows: ctx.windows.list().length,
    }),
  })

  ctx.add(
    MenubarItem,
    (): MenubarItem => ({
      menu: "help",
      id: "about",
      label: ctx.t("menu.about"),
      run: (window) => {
        const options = { type: "info" as const, message: "__TITLE__", detail: `OpenCode ${app.getVersion()}` }

        void (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
      },
    }),
  )
}
