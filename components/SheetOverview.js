(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetOverview(props) {
    const {
      Card,
      gridCols,
      ABILITIES,
      formatBonus,
      sheet,
      xpCeil,
      abilityMods,
      skillSummary,
      inventoryHighlights,
      inventoryCount,
      notesPreview,
    } = props;


    const quickStatsCard = Card({
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
        [
          ["Armor Class", sheet.ac],
          ["HP", `${sheet.hp.current ?? 0}/${sheet.hp.max ?? 0}`],
          ["Temp HP", sheet.hp.temp ?? 0],
          ["Inspiration", sheet.inspiration ? "Yes" : "No"],
          ["XP", sheet.xp.toLocaleString()],
          ["Next Level", xpCeil.toLocaleString()],
        ].map(([label, value]) =>
          React.createElement(
            "div",
            {
              key: label,
              style: {
                display: "grid",
                gap: 4,
                padding: "0.65rem",
                borderRadius: 12,
                border: "1px solid rgba(125, 211, 252, 0.2)",
              },
            },
            React.createElement("span", { className: "ui-label" }, label),
            React.createElement(
              "span",
              { style: { fontWeight: 600, fontSize: "1.1rem" } },
              value
            )
          )
        )
      ),
    });

    const abilityCard = Card({
      children: React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: gridCols(
              "repeat(auto-fit, minmax(140px, 1fr))"
            ),
          },
        },
        ABILITIES.map(({ key, label }) => {
          const score = sheet.abilities?.[key] ?? 10;
          const mod = abilityMods[key];
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
                textAlign: "center",
              },
            },
            React.createElement(
              "div",
              { className: "ui-label", style: { textTransform: "uppercase" } },
              label
            ),
            React.createElement(
              "div",
              { style: { fontSize: 28, fontWeight: 700 } },
              score
            ),
            React.createElement(
              "div",
              {
                className: "tag",
                style: { justifyContent: "center", margin: "0 auto" },
              },
              mod >= 0 ? `+${mod}` : mod
            )
          );
        })
      ),
    });

    const skillsSnapshotCard = !skillSummary
      ? null
      : Card({
          children: React.createElement(
            "div",
            { className: "grid gap-2" },
            React.createElement(
              "div",
              { className: "ui-label" },
              "Skills Snapshot"
            ),
            React.createElement(
              "div",
              {
                className: "sheet-skill-stats",
                style: {
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: gridCols(
                    "repeat(auto-fit, minmax(160px, 1fr))"
                  ),
                },
              },
              [
                {
                  label: "Trained skills",
                  value: skillSummary.proficientCount,
                },
                {
                  label: "Best bonus",
                  value: skillSummary.bestSkill
                    ? `${skillSummary.bestSkill.skill.label} (${formatBonus(
                        skillSummary.bestSkill.bonus
                      )})`
                    : "--",
                },
                {
                  label: "Passive Perception",
                  value:
                    skillSummary.passivePerception != null
                      ? skillSummary.passivePerception
                      : "--",
                },
                {
                  label: "Passive Investigation",
                  value:
                    skillSummary.passiveInvestigation != null
                      ? skillSummary.passiveInvestigation
                      : "--",
                },
                {
                  label: "Passive Insight",
                  value:
                    skillSummary.passiveInsight != null
                      ? skillSummary.passiveInsight
                      : "--",
                },
              ].map((stat) =>
                React.createElement(
                  "div",
                  {
                    key: stat.label,
                    style: {
                      border: "1px solid rgba(148,163,184,0.3)",
                      borderRadius: 10,
                      padding: "0.75rem",
                      background: "rgba(15,23,42,0.35)",
                    },
                  },
                  React.createElement(
                    "div",
                    { style: { fontSize: 12, opacity: 0.7 } },
                    stat.label
                  ),
                  React.createElement(
                    "div",
                    { style: { fontSize: 18, fontWeight: 600 } },
                    stat.value
                  )
                )
              )
            )
          ),
        });

    const inventoryPreviewLimit = 4;
    const normalizedInventory = Array.isArray(inventoryHighlights)
      ? inventoryHighlights.filter(Boolean)
      : [];
    const inventoryList = normalizedInventory.slice(0, inventoryPreviewLimit);
    const parsedInventoryCount = Number(inventoryCount);
    const totalInventoryItems = Number.isFinite(parsedInventoryCount)
      ? parsedInventoryCount
      : normalizedInventory.length;
    const remainingInventory = Math.max(
      0,
      totalInventoryItems - inventoryList.length
    );

    const inventoryCard = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        React.createElement(
          "div",
          {
            className: "ui-label",
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
          },
          "Pack Highlights",
          React.createElement(
            "span",
            {
              className: "tag",
              style: { fontSize: 12, letterSpacing: 0.5 },
            },
            `${totalInventoryItems} item${
              totalInventoryItems === 1 ? "" : "s"
            }`
          )
        ),
        inventoryList.length === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No gear logged yet. Add items from the Inventory tab."
            )
          : React.createElement(
              "ul",
              {
                style: {
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 8,
                },
              },
              inventoryList.map((item, index) => {
                const key =
                  item.id ||
                  (item.name && `${item.name}-${index}`) ||
                  `item-${index}`;
                const qtyLabel =
                  item.qty !== undefined && item.qty !== ""
                    ? `x${item.qty}`
                    : null;
                return React.createElement(
                  "li",
                  {
                    key,
                    style: {
                      border: "1px solid rgba(148,163,184,0.3)",
                      borderRadius: 10,
                      padding: "0.5rem 0.75rem",
                      background: "rgba(15,23,42,0.35)",
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        fontWeight: 600,
                      },
                    },
                    React.createElement(
                      "span",
                      { style: { textTransform: "none" } },
                      item.name || "Unnamed item"
                    ),
                    qtyLabel
                      ? React.createElement(
                          "span",
                          {
                            className: "tag",
                            style: { fontSize: 12, letterSpacing: 0.5 },
                          },
                          qtyLabel
                        )
                      : null
                  ),
                  item.note
                    ? React.createElement(
                        "div",
                        {
                          className: "ui-hint",
                          style: {
                            marginTop: 4,
                            textTransform: "none",
                            whiteSpace: "normal",
                          },
                        },
                        item.note
                      )
                    : null
                );
              })
            ),
        remainingInventory > 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              `+${remainingInventory} more item${
                remainingInventory === 1 ? "" : "s"
              } in pack`
            )
          : null
      ),
    });

    const notesText = (notesPreview || "").trim();
    const maxPreviewChars = 600;
    const hasMoreNotes = notesText.length > maxPreviewChars;
    const noteSnippet = hasMoreNotes
      ? `${notesText.slice(0, maxPreviewChars).trim()}…`
      : notesText;

    const notesCard = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        React.createElement("div", { className: "ui-label" }, "Campaign Notes"),
        noteSnippet
          ? React.createElement(
              "div",
              {
                style: {
                  border: "1px solid rgba(148,163,184,0.3)",
                  borderRadius: 12,
                  padding: "0.75rem",
                  background: "rgba(15,23,42,0.35)",
                  lineHeight: 1.5,
                  whiteSpace: "pre-line",
                },
              },
              noteSnippet
            )
          : React.createElement(
              "div",
              { className: "ui-hint" },
              "No notes yet. Head to the Notes tab to start a journal."
            ),
        hasMoreNotes
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "Preview truncated. Open the Notes tab to read the rest."
            )
          : null
      ),
    });

    const statCards = [
      quickStatsCard,
      abilityCard,
      skillsSnapshotCard,
    ].filter(Boolean);
    const bottomCards = [inventoryCard, notesCard].filter(Boolean);

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      statCards.length
        ? React.createElement(
            "div",
            {
              className: "grid gap-4",
              style: {
                gridTemplateColumns: gridCols(
                  "repeat(auto-fit, minmax(260px, 1fr))"
                ),
              },
            },
            statCards
          )
        : null,
      bottomCards.length
        ? React.createElement(
            "div",
            {
              className: "grid gap-4",
              style: {
                gridTemplateColumns: gridCols(
                  "repeat(auto-fit, minmax(260px, 1fr))"
                ),
              },
            },
            bottomCards
          )
        : null
    );
  }

  Components.Overview = SheetOverview;
})();
