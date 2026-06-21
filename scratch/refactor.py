import re

with open("src/components/tiles/QuickTileCreate.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# I will replace everything from `  const panelClass = isDesktop` to the end of the `return` statement.
start_idx = code.find("  const panelClass = isDesktop")
end_idx = code.find("  return (", start_idx)
# Let's find the closing `);` of the return statement.
return_end_idx = code.find("    </>\n  );\n}\n")

if start_idx == -1 or return_end_idx == -1:
    print("Could not find start or end")
    exit(1)

# Extract sections
base_panel_match = re.search(r'\{\/\* Base Panel \*\/}(.*?)\{\/\* Schedule \& Splitting Panel \*\/\}', code[start_idx:return_end_idx], re.DOTALL)
schedule_panel_match = re.search(r'\{\/\* Schedule \& Splitting Panel \*\/}(.*?)\{\/\* Recurrence \& Objective Panel \*\/\}', code[start_idx:return_end_idx], re.DOTALL)
recurrence_panel_match = re.search(r'\{\/\* Recurrence \& Objective Panel \*\/}(.*?)\{\/\* Project \& Metadata Panel \*\/\}', code[start_idx:return_end_idx], re.DOTALL)
meta_panel_match = re.search(r'\{\/\* Project \& Metadata Panel \*\/}(.*?)<\/div>\s*<\/section>', code[start_idx:return_end_idx], re.DOTALL)

def extract_inner_content(match_text):
    # The match text looks like:
    # <div className={cn("absolute inset-0 ...")}>
    #   <div className="space-y-4">
    #     ... content ...
    #   </div>
    # </div>
    # We want everything inside the first <div ...> ... </div>
    first_div_open = match_text.find('<div className="space-y-')
    if first_div_open == -1:
        first_div_open = match_text.find('<div className="flex')
    
    # We just need the inner content.
    # Actually, it's safer to just replace the wrapper manually.
    pass

# Instead of regex parsing the whole HTML, let's just use string replacements on the existing wrapper divs.

# 1. Remove panelClass
code = code[:start_idx] + code[end_idx:]

# 2. Replace <section className={panelClass}>
code = code.replace('<section className={panelClass}>', '''
      {/* --- Base Panel --- */}
      <section
        className={cn(
          "flex flex-col overflow-hidden bg-surface-1 shadow-lg transition-all duration-300 ease-out",
          isDesktop
            ? "fixed inset-y-0 right-0 z-[56] w-[32rem] border-l border-border [animation:slideInFromRight_0.22s_ease-out]"
            : "fixed inset-x-0 bottom-0 z-[56] h-[80vh] rounded-t-2xl [animation:slideInFromBottom_0.22s_ease-out]",
          activePanel !== "base" && isDesktop ? "-translate-x-6 brightness-75" : "translate-x-0",
          activePanel !== "base" && !isDesktop ? "translate-y-6 brightness-75" : "translate-y-0"
        )}
      >
''')

# 3. Replace the Header block
old_header = """        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          {activePanel === "base" ? (
            <h2 className="text-base font-semibold text-foreground">{t("quickCreate.title")}</h2>
          ) : (
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("quickCreate.back") || "Back"}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>"""

new_header = """        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-foreground">{t("quickCreate.title")}</h2>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>"""
code = code.replace(old_header, new_header)

# 4. Remove `<div className="relative flex-1 overflow-hidden">` around panels
code = code.replace('<div className="relative flex-1 overflow-hidden">', '')
# And the closing `</div>` right before `</section>`
code = code.replace('        </div>\n      </section>', '      </section>')

# 5. Base Panel inner wrapper
old_base_panel = """          {/* Base Panel */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto p-4 transition-transform duration-300",
              activePanel !== "base" ? "-translate-x-10 opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
            )}
          >"""
new_base_panel = """          {/* Base Panel Content */}
          <div className="flex flex-col overflow-y-auto p-4 h-[calc(100%-3.5rem)]">"""
code = code.replace(old_base_panel, new_base_panel)

# 6. Schedule Panel wrapper
old_schedule_panel = """          {/* Schedule & Splitting Panel */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto bg-surface-1 p-4 transition-transform duration-300",
              activePanel === "schedule" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}
          >"""
new_schedule_panel = """      </section>

      {/* Schedule & Splitting Panel */}
      <section
        className={cn(
          "flex flex-col overflow-hidden bg-surface-1 shadow-2xl transition-transform duration-300 ease-out",
          isDesktop
            ? "fixed inset-y-0 right-0 z-[57] w-[28rem] border-l border-border"
            : "fixed inset-x-0 bottom-0 z-[57] h-[75vh] rounded-t-2xl",
          activePanel === "schedule" ? "translate-x-0 translate-y-0" : (isDesktop ? "translate-x-full pointer-events-none" : "translate-y-full pointer-events-none")
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back") || "Back"}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Schedule & Splitting</h2>
        </div>
        <div className="flex flex-col overflow-y-auto p-4 h-[calc(100%-3.5rem)]">"""
code = code.replace(old_schedule_panel, new_schedule_panel)

# 7. Recurrence Panel wrapper
old_recurrence_panel = """          {/* Recurrence & Objective Panel */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto bg-surface-1 p-4 transition-transform duration-300",
              activePanel === "recurrence" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}
          >"""
new_recurrence_panel = """      </section>

      {/* Recurrence & Objective Panel */}
      <section
        className={cn(
          "flex flex-col overflow-hidden bg-surface-1 shadow-2xl transition-transform duration-300 ease-out",
          isDesktop
            ? "fixed inset-y-0 right-0 z-[57] w-[28rem] border-l border-border"
            : "fixed inset-x-0 bottom-0 z-[57] h-[75vh] rounded-t-2xl",
          activePanel === "recurrence" ? "translate-x-0 translate-y-0" : (isDesktop ? "translate-x-full pointer-events-none" : "translate-y-full pointer-events-none")
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back") || "Back"}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Recurrence & Objective</h2>
        </div>
        <div className="flex flex-col overflow-y-auto p-4 h-[calc(100%-3.5rem)]">"""
code = code.replace(old_recurrence_panel, new_recurrence_panel)

# 8. Meta Panel wrapper
old_meta_panel = """          {/* Project & Metadata Panel */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col overflow-y-auto bg-surface-1 p-4 transition-transform duration-300",
              activePanel === "meta" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
            )}
          >"""
new_meta_panel = """      </section>

      {/* Project & Metadata Panel */}
      <section
        className={cn(
          "flex flex-col overflow-hidden bg-surface-1 shadow-2xl transition-transform duration-300 ease-out",
          isDesktop
            ? "fixed inset-y-0 right-0 z-[57] w-[28rem] border-l border-border"
            : "fixed inset-x-0 bottom-0 z-[57] h-[75vh] rounded-t-2xl",
          activePanel === "meta" ? "translate-x-0 translate-y-0" : (isDesktop ? "translate-x-full pointer-events-none" : "translate-y-full pointer-events-none")
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <button
            type="button"
            onClick={() => setActivePanel("base")}
            className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("quickCreate.back") || "Back"}
          </button>
          <h2 className="text-sm font-semibold text-foreground">Project & Metadata</h2>
        </div>
        <div className="flex flex-col overflow-y-auto p-4 h-[calc(100%-3.5rem)]">"""
code = code.replace(old_meta_panel, new_meta_panel)


with open("src/components/tiles/QuickTileCreate.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Done replacing.")
