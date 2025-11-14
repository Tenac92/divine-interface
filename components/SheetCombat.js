(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;
  const { useState, useEffect, useMemo } = React;

  function SheetCombat(props) {
    const {
      Card,
      Field,
      Btn,
      gridCols,
      sheet,
      abilityMods = {},
      proficiency = 0,
      onAcChange = () => {},
      onHpChange = () => {},
      preparedSpellLevels = [],
      preparedSpellsByLevel = new Map(),
      spellSlots = [],
      levelLabel = (lvl) => `Level ${lvl}`,
      onSpellSlotTotalChange = () => {},
      onRefundSpellSlot = () => {},
      onResetSpellSlot = () => {},
      onPreparedSpellClick = () => {},
      weaponItems = [],
      onShortRest = () => {},
      onLongRest = () => {},
    } = props;

    const mobileNumberProps = { inputMode: "numeric", pattern: "[0-9]*" };
    const stepperButtonStyle = {
      borderRadius: 8,
      border: "1px solid rgba(148,163,184,0.4)",
      background: "rgba(15,23,42,0.35)",
      color: "#e2e8f0",
      fontWeight: 700,
      fontSize: 18,
      lineHeight: 1,
      padding: "0.15rem 0.65rem",
      minWidth: 36,
      minHeight: 36,
      cursor: "pointer",
    };

    const renderStepperField = ({
      label,
      value,
      min,
      onChange = () => {},
    }) => {
      const parseNumeric = (val) => {
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      };
      const resolveInitial = () =>
        typeof min === "number" ? min : 0;
      const handleStep = (direction) => {
        const parsed = parseNumeric(value);
        let nextValue =
          parsed === null ? resolveInitial() : parsed + direction;
        if (typeof min === "number") {
          nextValue = Math.max(min, nextValue);
        }
        onChange(String(nextValue));
      };
      const resolvedValue =
        value === null || typeof value === "undefined" ? "" : value;
      return Field({
        label,
        labelAlign: "center",
        children: React.createElement(
          "div",
          {
            className: "ui-stepper",
            style: {
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 8,
              alignItems: "center",
            },
          },
          [
            React.createElement(
              "button",
              {
                type: "button",
                "aria-label": `Decrease ${label}`,
                onClick: () => handleStep(-1),
                style: stepperButtonStyle,
              },
              "−"
            ),
            React.createElement(
              "input",
              Object.assign(
                {
                  className: "ui-input",
                  type: "text",
                  value: resolvedValue,
                  onChange: (e) => onChange(e.target.value),
                  style: { textAlign: "center" },
                },
                mobileNumberProps
              )
            ),
            React.createElement(
              "button",
              {
                type: "button",
                "aria-label": `Increase ${label}`,
                onClick: () => handleStep(1),
                style: stepperButtonStyle,
              },
              "+"
            ),
          ]
        ),
      });
    };

    const hpCard = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        React.createElement("div", { className: "ui-label" }, "Combat Vitals"),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            },
          },
          [
            React.createElement(
              Btn,
              { key: "short", type: "button", onClick: onShortRest },
              "Short Rest"
            ),
            React.createElement(
              Btn,
              {
                key: "long",
                type: "button",
                onClick: onLongRest,
              },
              "Long Rest"
            ),
          ]
        ),
        React.createElement(
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
          renderStepperField({
            label: "Armor Class",
            value: sheet.ac,
            min: 1,
            onChange: onAcChange,
          }),
          renderStepperField({
            label: "Max HP",
            value: sheet.hp?.max ?? 0,
            min: 1,
            onChange: (next) => onHpChange("max", next),
          }),
          renderStepperField({
            label: "Current HP",
            value: sheet.hp?.current ?? 0,
            min: 0,
            onChange: (next) => onHpChange("current", next),
          }),
          renderStepperField({
            label: "Temp HP",
            value: sheet.hp?.temp ?? 0,
            min: 0,
            onChange: (next) => onHpChange("temp", next),
          })
        )
      ),
    });

    const weaponAbilityKey = (weapon) => {
      const note = `${weapon.name || ""} ${weapon.note || ""}`.toLowerCase();
      if (/bow|crossbow|sling|dart|throw|finesse|rapier|dagger|dex/.test(note)) {
        return "dex";
      }
      return "str";
    };

    const extractDamageDice = (note) => {
      if (!note) return null;
      const match = /\d+d\d+(?:\s*[+\-]\s*\d+)?/i.exec(note);
      return match ? match[0].replace(/\s+/g, "") : null;
    };

    const weaponList = weaponItems.slice(0, 6);
    const weaponsCard = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        React.createElement("div", { className: "ui-label" }, "Weapon Loadout"),
        weaponList.length === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No weapons tracked yet. Add them from the Inventory tab or weapon catalog."
            )
          : React.createElement(
              "ul",
              {
                style: {
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 8,
                },
              },
              weaponList.map((weapon, idx) => {
                const abilityKey = weaponAbilityKey(weapon);
                const abilityBonus = abilityMods[abilityKey] ?? 0;
                const attackBonus = abilityBonus + proficiency;
                const damageDice = extractDamageDice(weapon.note);
                const damageBonus =
                  abilityBonus === 0
                    ? ""
                    : abilityBonus > 0
                    ? ` +${abilityBonus}`
                    : ` ${abilityBonus}`;
                return React.createElement(
                  "li",
                  {
                    key: weapon.id || `${weapon.name || "weapon"}-${idx}`,
                    style: {
                      border: "1px solid rgba(148,163,184,0.3)",
                      borderRadius: 10,
                      padding: "0.6rem 0.75rem",
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
                        fontWeight: 600,
                      },
                    },
                    React.createElement(
                      "span",
                      { style: { textTransform: "none" } },
                      weapon.name || "Unnamed weapon"
                    ),
                    weapon.qty
                      ? React.createElement(
                          "span",
                          { className: "tag", style: { fontSize: 12 } },
                          `x${weapon.qty}`
                        )
                      : null
                  ),
                  weapon.note
                    ? React.createElement(
                        "div",
                        {
                          className: "ui-hint",
                          style: { textTransform: "none", marginTop: 4 },
                        },
                        weapon.note
                      )
                    : null,
                  React.createElement(
                    "div",
                    {
                      className: "ui-hint",
                      style: {
                        marginTop: 4,
                        textTransform: "none",
                        fontSize: 12,
                      },
                    },
                    `Hit +${attackBonus} | Damage ${
                      damageDice || "â€”"
                    }${damageBonus}`
                  )
                );
              })
            ),
        weaponItems.length > weaponList.length
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              `+${weaponItems.length - weaponList.length} more weapon${
                weaponItems.length - weaponList.length === 1 ? "" : "s"
              } in inventory`
            )
          : null
      ),
    });

    const sortedLevels = useMemo(
      () => preparedSpellLevels.slice().sort((a, b) => a - b),
      [preparedSpellLevels]
    );
    const levelKeys = sortedLevels.map((lvl) => String(lvl));
    const [activeLevel, setActiveLevel] = useState(levelKeys[0] || "0");
    useEffect(() => {
      if (levelKeys.includes(activeLevel)) return;
      setActiveLevel(levelKeys[0] || "0");
    }, [activeLevel, levelKeys]);

    const renderLevelCard = (level, spells, slot) => {
      const displaySpells = spells.filter((spell) =>
        Boolean((spell?.name || "").trim())
      );
      const showSpells = displaySpells.length > 0;
      return React.createElement(
        "div",
        {
          key: level,
          style: {
            border: "1px solid rgba(148,163,184,0.3)",
            borderRadius: 12,
            padding: "0.75rem",
            display: "grid",
            gap: 8,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                fontWeight: 600,
                display: "flex",
                gap: 8,
                alignItems: "center",
              },
            },
            levelLabel(level)
          ),
          level === 0
            ? React.createElement(
                "span",
                { className: "ui-hint" },
                "Cantrips"
              )
            : React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  },
                },
                React.createElement(
                  "span",
                  null,
                  `Slots: ${slot.used}/${slot.total}`
                ),
                React.createElement(
                  "input",
                  Object.assign(
                    {
                      className: "ui-input",
                      type: "number",
                      min: 0,
                      style: { width: 70 },
                      value: slot.total,
                      onChange: (e) =>
                        onSpellSlotTotalChange(level, e.target.value),
                      title: "Total slots at this level",
                    },
                    mobileNumberProps
                  )
                ),
                slot.used > 0
                  ? React.createElement(
                      Btn,
                      {
                        type: "button",
                        className: "btn-muted",
                        onClick: () => onResetSpellSlot(level),
                      },
                      "Reset"
                    )
                  : null,
                slot.used > 0
                  ? React.createElement(
                      Btn,
                      {
                        type: "button",
                        className: "btn-muted",
                        onClick: () => onRefundSpellSlot(level),
                      },
                      "-1"
                    )
                  : null
              )
        ),
        showSpells
          ? React.createElement(
              "div",
              { style: { display: "grid", gap: 6 } },
              displaySpells.map((spell) => {
                const rangeText = (spell.range || "").trim();
                const durationText = (spell.duration || "").trim();
                const metaLine = [rangeText, durationText]
                  .filter(Boolean)
                  .join(" | ");
                return React.createElement(
                  "button",
                  {
                    key: spell.id,
                    className: "sheet-prepared-spell",
                    style: {
                      textAlign: "left",
                      borderRadius: 10,
                      padding: "0.5rem 0.75rem",
                      border: "1px solid rgba(59,130,246,0.3)",
                      background: "rgba(59,130,246,0.08)",
                    },
                    onDoubleClick: () => onPreparedSpellClick(spell),
                    title: "Double-click to spend a slot",
                  },
                  React.createElement(
                    "div",
                    { style: { fontWeight: 600 } },
                    spell.name.trim()
                  ),
                  spell.note
                    ? React.createElement(
                        "div",
                        {
                          className: "ui-hint",
                          style: { textTransform: "none" },
                        },
                        spell.note
                      )
                    : null,
                  metaLine
                    ? React.createElement(
                        "div",
                        {
                          className: "ui-hint",
                          style: { textTransform: "none", fontSize: 12 },
                        },
                        metaLine
                      )
                    : null,
                  React.createElement(
                    "details",
                    {
                      style: {
                        marginTop: 4,
                        fontSize: 12,
                        textAlign: "left",
                      },
                      onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(
                      "summary",
                      {
                        style: {
                          cursor: "pointer",
                          fontWeight: 600,
                          outline: "none",
                        },
                      },
                      "Description"
                    ),
                    React.createElement(
                      "div",
                      { style: { lineHeight: 1.5, paddingTop: 4 } },
                      (spell.description || "No description provided").trim()
                    )
                  )
                );
              })
            )
          : React.createElement(
              "div",
              {
                className: "ui-hint",
                style: { padding: "0.5rem", textAlign: "center" },
              },
              level === 0
                ? "No cantrips prepared yet."
                : "No prepared spells recorded for this level."
            )
      );
    };

    const spellCard =
      preparedSpellLevels.length === 0
        ? null
        : Card({
            children: React.createElement(
              "div",
              { className: "grid gap-3" },
              React.createElement(
                "div",
                { className: "ui-label" },
                "Prepared Spells & Slots"
              ),
              React.createElement(
                "div",
                {
                  className: "spell-level-tabs",
                  style: { display: "flex", flexWrap: "wrap", gap: 8 },
                },
                levelKeys.map((key) =>
                  React.createElement(
                    "button",
                    {
                      key,
                      className: "sheet-level-tab",
                      style: Object.assign(
                        {
                          borderRadius: 999,
                          border: "1px solid rgba(148,163,184,0.4)",
                          padding: "4px 12px",
                          background: "rgba(15,23,42,0.4)",
                          color: "#cbd5f5",
                          fontWeight: 600,
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        },
                        activeLevel === key
                          ? {
                              borderColor: "rgba(59,130,246,0.9)",
                              background: "rgba(59,130,246,0.25)",
                              color: "#e5edff",
                            }
                          : {}
                      ),
                      onClick: () => setActiveLevel(key),
                    },
                    levelLabel(Number(key))
                  )
                )
              ),
              renderLevelCard(
                Number(activeLevel),
                preparedSpellsByLevel.get(Number(activeLevel)) || [],
                spellSlots[Number(activeLevel)] || { total: 0, used: 0 }
              )
            ),
          });

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      hpCard,
      weaponsCard,
      spellCard
    );
  }

  Components.Combat = SheetCombat;
})();


