import sys

with open("src/components/tiles/QuickTileCreate.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Let's locate the main sections
start_marker = '<section className={panelClass}>'
end_marker = '      </section>\n    </>\n  );\n}'

start_idx = code.find(start_marker)
end_idx = code.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    sys.exit(1)

# We will modify the panelClass definition to be base panel only
code = code.replace('''  const panelClass = isDesktop
    ? [
        "fixed inset-y-0 right-0 z-[56]",
        "w-[28rem] flex flex-col overflow-hidden",
        "bg-surface-1 shadow-lg",
        "border-l border-border",
        "[animation:slideInFromRight_0.22s_ease-out]",
      ].join(" ")
    : [
        "fixed inset-x-0 bottom-0 z-[56]",
        "h-[80vh] flex flex-col overflow-hidden",
        "rounded-t-2xl bg-surface-1 shadow-lg",
        "[animation:slideInFromBottom_0.22s_ease-out]",
      ].join(" ");''', '''  const basePanelClass = isDesktop
    ? cn(
        "fixed inset-y-0 right-0 z-[56]",
        "w-[32rem] flex flex-col bg-surface-1 shadow-lg border-l border-border transition-all duration-300 ease-out",
        activePanel !== "base" ? "-translate-x-6 brightness-[0.7]" : "translate-x-0",
        "[animation:slideInFromRight_0.22s_ease-out]"
      )
    : cn(
        "fixed inset-x-0 bottom-0 z-[56]",
        "h-[80vh] flex flex-col rounded-t-2xl bg-surface-1 shadow-lg transition-all duration-300 ease-out",
        activePanel !== "base" ? "translate-y-6 brightness-[0.7]" : "translate-y-0",
        "[animation:slideInFromBottom_0.22s_ease-out]"
      );

  const subPanelClass = (panelName: string) => isDesktop
    ? cn(
        "fixed inset-y-0 right-0 z-[57]",
        "w-[28rem] flex flex-col bg-surface-1 shadow-2xl border-l border-border transition-transform duration-300 ease-out",
        activePanel === panelName ? "translate-x-0" : "translate-x-full pointer-events-none"
      )
    : cn(
        "fixed inset-x-0 bottom-0 z-[57]",
        "h-[75vh] flex flex-col rounded-t-2xl bg-surface-1 shadow-2xl transition-transform duration-300 ease-out",
        activePanel === panelName ? "translate-y-0" : "translate-y-full pointer-events-none"
      );''')

# Now let's carefully replace the DOM
# Since the current DOM is:
# <section className={panelClass}>
#   <div header>
#   <div className="relative flex-1 overflow-hidden">
#      <div base panel>
#      <div schedule panel>
#      <div recurrence panel>
#      <div meta panel>
#   </div>
#   <div footer>
# </section>

# We want:
# <section className={basePanelClass}>
#   <div header base>
#   <div base content>
#   <div footer>
# </section>
# <section className={subPanelClass("schedule")}>
#   <div header schedule>
#   <div schedule content>
# </section>
# <section className={subPanelClass("recurrence")}>
#   <div header recurrence>
#   <div recurrence content>
# </section>
# <section className={subPanelClass("meta")}>
#   <div header meta>
#   <div meta content>
# </section>

# Let's extract the pieces!

def get_block(text, start_str, end_str):
    s = text.find(start_str)
    if s == -1: return ""
    e = text.find(end_str, s)
    if e == -1: return ""
    return text[s:e]

header = get_block(code, '<div className="flex h-14 shrink-0', '<div className="relative flex-1 overflow-hidden">')

base_panel_start = code.find('{/* Base Panel */}')
schedule_panel_start = code.find('{/* Schedule & Splitting Panel */}')
recurrence_panel_start = code.find('{/* Recurrence & Objective Panel */}')
meta_panel_start = code.find('{/* Project & Metadata Panel */}')
footer_start = code.find('{/* Footer Actions */}')
footer_end = code.find('</section>', footer_start)

base_panel = code[base_panel_start:schedule_panel_start]
schedule_panel = code[schedule_panel_start:recurrence_panel_start]
recurrence_panel = code[recurrence_panel_start:meta_panel_start]
meta_panel = code[meta_panel_start:code.rfind('</div>', meta_panel_start, footer_start)] # Strip the ending </div> of relative flex-1
footer = code[footer_start:footer_end]

# Clean up panels: they currently have `<div className={cn("absolute inset-0 ...")}>`
# We will just strip that wrapper!
def strip_wrapper(panel_html):
    # Find the first <div className={cn( ... )}>
    match_start = panel_html.find('<div\n            className={cn(')
    if match_start == -1: return panel_html
    # Find the close of this tag ">"
    tag_close = panel_html.find('>', match_start)
    
    # We want everything after tag_close + 1 up to the second to last </div>
    inner = panel_html[tag_close+1:]
    inner = inner[:inner.rfind('</div>')]
    return inner.strip()

base_inner = strip_wrapper(base_panel)
schedule_inner = strip_wrapper(schedule_panel)
recurrence_inner = strip_wrapper(recurrence_panel)
meta_inner = strip_wrapper(meta_panel)

# Build the new DOM
new_dom = f'''      <section className={{basePanelClass}}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-foreground">{{t("quickCreate.title")}}</h2>
          <button
            type="button"
            onClick={{close}}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            aria-label={{locale === "ja" ? "パネルを閉じる" : "Close panel"}}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {base_inner}
        </div>
{footer}      </section>

      {{/* Sub Panel: Schedule */}}
      <section className={{subPanelClass("schedule")}}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={{() => setActivePanel("base")}}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {{t("quickCreate.back") || "Back"}}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Schedule & Splitting</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {schedule_inner}
        </div>
      </section>

      {{/* Sub Panel: Recurrence */}}
      <section className={{subPanelClass("recurrence")}}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={{() => setActivePanel("base")}}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {{t("quickCreate.back") || "Back"}}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Recurrence & Objective</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {recurrence_inner}
        </div>
      </section>

      {{/* Sub Panel: Meta */}}
      <section className={{subPanelClass("meta")}}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={{() => setActivePanel("base")}}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {{t("quickCreate.back") || "Back"}}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Project & Metadata</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {meta_inner}
        </div>
      </section>'''

# Replace the whole DOM segment
old_dom = code[code.find('<section className={panelClass}>'):footer_end+len('</section>')]
new_code = code.replace(old_dom, new_dom)

with open("src/components/tiles/QuickTileCreate.tsx", "w", encoding="utf-8") as f:
    f.write(new_code)

print("Done")
