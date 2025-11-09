(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetSpells({
    Card,
    Btn,
    spellCatalogSection,
    spellStatsBar,
    totalSpells,
    spellFilterControls,
    groupedSpells,
    spellLevelStats,
    toggleSpellLevelCollapse,
    isLevelCollapsed,
    setPreparedForLevel,
    renderSpellEditor,
    addSpell,
    levelLabel,
  }) {
    const content =
      groupedSpells.length === 0
        ? React.createElement(
            "div",
            { className: "ui-hint" },
            "No spells match the current filters."
          )
        : groupedSpells.map(([level, spells]) => {
            const stats =
              spellLevelStats.get(level) || {
                total: spells.length,
                prepared: spells.filter((sp) => sp.prepared).length,
              };
            const collapsed = isLevelCollapsed(level);
            return React.createElement(
              "div",
              {
                key: level,
                className: ["sheet-spell-group", collapsed ? "collapsed" : ""]
                  .filter(Boolean)
                  .join(" "),
              },
              React.createElement(
                "div",
                { className: "sheet-spell-group-header" },
                React.createElement(
                  "div",
                  { className: "sheet-spell-group-title" },
                  levelLabel(level)
                ),
                React.createElement(
                  "div",
                  { className: "sheet-spell-group-meta" },
                  `${stats.prepared}/${stats.total} prepared`
                ),
                React.createElement(
                  "div",
                  { className: "sheet-spell-group-actions" },
                  Btn({
                    type: "button",
                    className: "btn-muted",
                    onClick: () => toggleSpellLevelCollapse(level),
                    children: collapsed ? "Expand" : "Collapse",
                  }),
                  stats.prepared < stats.total
                    ? Btn({
                        type: "button",
                        className: "btn-primary",
                        onClick: () => setPreparedForLevel(level, true),
                        children: "Prepare all",
                      })
                    : null,
                  stats.prepared > 0
                    ? Btn({
                        type: "button",
                        className: "btn-muted",
                        onClick: () => setPreparedForLevel(level, false),
                        children: "Clear prepared",
                      })
                    : null
                )
              ),
              collapsed
                ? React.createElement(
                    "div",
                    {
                      className: "sheet-spell-group-collapsed-hint",
                      style: { fontSize: 12, opacity: 0.7, padding: "0 4px 8px" },
                    },
                    `${spells.length} spell${spells.length === 1 ? "" : "s"} hidden`
                  )
                : React.createElement(
                    "div",
                    { className: "sheet-spell-group-body" },
                    spells.map((spell) => renderSpellEditor(spell))
                  )
            );
          });

    return Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        spellCatalogSection,
        spellStatsBar,
        totalSpells === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No spells recorded yet. Use the catalog above or add them manually."
            )
          : React.createElement(
              React.Fragment,
              null,
              spellFilterControls,
              content
            ),
        Btn({ type: "button", onClick: addSpell, children: "+ Add spell" })
      ),
    });
  }

  Components.Spells = SheetSpells;
})();
