(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetSkills({
    Card,
    skillSearchField,
    skillSummary,
    gridCols,
    ABILITIES,
    abilityMods,
    skillsByAbility,
    renderSkillRow,
    formatBonus,
  }) {
    const summaryBar = !skillSummary
      ? null
      : React.createElement(
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
        );

    const abilityCards = ABILITIES.map(({ key, label }) => {
      const abilitySkills = skillsByAbility.get(key) || [];
      if (!abilitySkills.length) return null;
      return React.createElement(
        "div",
        {
          key: key,
          className: "sheet-skill-card",
          style: {
            border: "1px solid rgba(125,211,252,0.2)",
            borderRadius: 12,
            padding: "0.75rem",
            display: "grid",
            gap: 10,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
          },
          React.createElement(
            "div",
            { style: { fontWeight: 600 } },
            label
          ),
          React.createElement(
            "span",
            {
              className: "tag",
              style: { borderColor: "rgba(125,211,252,0.35)" },
            },
            `Mod ${formatBonus(abilityMods[key] || 0)}`
          )
        ),
        React.createElement(
          "div",
          { className: "grid", style: { gap: 8 } },
          abilitySkills.map((skill) => renderSkillRow(skill))
        )
      );
    }).filter(Boolean);

    return Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        skillSearchField,
        summaryBar,
        abilityCards.length
          ? abilityCards
          : React.createElement(
              "div",
              { className: "ui-hint" },
              "No skills match your filter."
            )
      ),
    });
  }

  Components.Skills = SheetSkills;
})();
