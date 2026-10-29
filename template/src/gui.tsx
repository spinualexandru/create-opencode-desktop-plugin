import { Plugin } from "@opencode/plugin/gui"
import { definition } from "./gui/definition"
// #if main
import { main } from "./gui/main"
// #endif
import { setup } from "./gui/window"

// The "./gui-experimental" entry. Windows run `setup`; the Electron main process runs `main`.
// #if main
export default Plugin.define({ ...definition, setup, main })
// #else
export default Plugin.define({ ...definition, setup })
// #endif
