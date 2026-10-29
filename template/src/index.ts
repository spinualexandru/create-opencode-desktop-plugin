import { Plugin } from "@opencode/plugin"
import { Hello } from "./rpc.ts"

// Server part: runs in the OpenCode server. Its id is also the GUI's id (ctx.id).
export default Plugin.define({
  id: "__PLUGIN_ID__",
  async setup(ctx) {
    await ctx.rpc.register(Hello, {
      greet: async (input) => {
        const { name } = input as { name: string }

        return { text: `Hello ${name}, from the __TITLE__ server part (OpenCode ${ctx.app.version}).` }
      },
    })
  },
})
