// English copy. Other locales go beside it in Plugin.define({ i18n }); English fills every key a locale lacks.
export const en = {
  title: "__TITLE__",
  "command.toggle": "Toggle __TITLE__ panel",
  "command.hello": "Say hello from __TITLE__",
  "panel.title": "__TITLE__",
  "panel.heading": "__TITLE__",
  "panel.body": "This panel is contributed by the __TITLE__ plugin. Edit src/gui/panel.tsx to change it.",
  "panel.session": "Session directory: {{directory}}",
  "panel.greet": "Greet",
  // #if server
  "panel.server": "Ask the server part",
  // #endif
  // #if main
  "panel.main": "Ask the main process",
  "menu.about": "About __TITLE__",
  // #endif
  "settings.title": "__TITLE__",
  "settings.greeting": "Greeting",
  "settings.status": "Show status bar item",
  "settings.status.description": "Shows a small __TITLE__ label at the bottom of the window.",
  "status.label": "__TITLE__ is running",
  "toast.hello": "{{greeting}} from __TITLE__!",
} satisfies Record<string, string>
