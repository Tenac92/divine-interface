(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetAbilities({ Card, gridCols, ABILITIES, abilities, abilityMods, onAbilityChange }) {
    return Card({
      children: React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: gridCols(
              "repeat(auto-fit, minmax(160px, 1fr))"
            ),
          },
        },
        ABILITIES.map(({ key, label }) => {
          const score = abilities?.[key] ?? 10;
          const mod = abilityMods[key] || 0;
          return React.createElement(
            "div",
            {
              key: key,
              style: {
                border: "1px solid rgba(125,211,252,0.2)",
                borderRadius: 12,
                padding: "0.75rem",
                display: "grid",
                gap: 6,
              },
            },
            React.createElement(
              "div",
              { className: "ui-label", style: { textTransform: "uppercase" } },
              label
            ),
            React.createElement(
              "div",
              { style: { fontSize: 24, fontWeight: 700 } },
              score
            ),
            React.createElement(
              "div",
              { className: "ui-hint" },
              `Modifier ${mod >= 0 ? "+" : ""}${mod}`
            ),
            React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 1,
              max: 30,
              value: score,
              onChange: (e) => onAbilityChange(key, e.target.value),
            })
          );
        })
      ),
    });
  }

  Components.Abilities = SheetAbilities;
})();
