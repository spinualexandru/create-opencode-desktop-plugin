import { Schema } from "effect"
import { Ipc } from "@opencode/plugin/gui"

// Tokens shared between the window and the main process. Token ids must be the plugin id or start with "<id>.".
export const Native = Ipc.define({
  id: "__PLUGIN_ID__.native",
  methods: {
    info: {
      output: Schema.Struct({ platform: Schema.String, electron: Schema.String, windows: Schema.Number }),
    },
  },
})
