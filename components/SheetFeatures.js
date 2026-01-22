(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;
  const { useMemo, useState } = React;

  const toSlugTitle = (slug) =>
    (slug || "")
      .toString()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const summarizeLevelRow = (row) => {
    const stats = [];
    if (Number.isFinite(Number(row?.proficiency_bonus))) {
      stats.push({ label: "Prof", value: `+${row.proficiency_bonus}` });
    }
    if (row?.class_die) {
      stats.push({ label: "Class Die", value: String(row.class_die).toUpperCase() });
    }
    if (Number(row?.cantrips_known) > 0) {
      stats.push({ label: "Cantrips", value: String(row.cantrips_known) });
    }
    if (Number(row?.prepared_spells) > 0) {
      stats.push({ label: "Prepared", value: String(row.prepared_spells) });
    }
    if (row?.spell_slots && typeof row.spell_slots === "object") {
      Object.entries(row.spell_slots).forEach(([key, value]) => {
        if (value === "" || value === null || typeof value === "undefined") return;
        const label = /^\d+$/.test(String(key))
          ? `Lvl ${Number(key)} Slots`
          : toSlugTitle(key);
        stats.push({ label, value: String(value) });
      });
    }
    return stats;
  };

  function SheetFeatures(props) {
    const {
      Card,
      Btn,
      classNameLabel = "",
      classSlug = "",
      sheetLevel = 1,
      featureState = {},
      onRefresh = () => {},
      classLevelData = null,
      subclassOptions = [],
      activeSubclass = null,
      subclassFeatures = [],
      onSelectSubclass = null,
      canSelectSubclass = false,
    } = props;

    const {
      status = "idle",
      progression = [],
      featureIndex,
      error,
      supportsApi = true,
    } = featureState || {};

    const [filterMode, setFilterMode] = useState("current");

    const featureMap = useMemo(() => {
      if (featureIndex instanceof Map) return featureIndex;
      if (Array.isArray(featureIndex)) return new Map(featureIndex);
      if (featureIndex && typeof featureIndex === "object") {
        return new Map(Object.entries(featureIndex));
      }
      return new Map();
    }, [featureIndex]);

    const subclassList =
      Array.isArray(subclassOptions) && subclassOptions.length
        ? subclassOptions
        : Array.isArray(featureState?.subclasses)
        ? featureState.subclasses
        : [];

    const activeSubclassSlug = activeSubclass?.slug || "";
    const resolvedSubclass =
      subclassList.find((sub) => sub?.subclass_slug === activeSubclassSlug) ||
      null;

    const normalizedRows = useMemo(() => {
      const rows = Array.isArray(progression) ? progression : [];
      return rows.map((row) => {
        const level = Number(row?.level) || 0;
        const unlocked = level > 0 ? level <= (Number(sheetLevel) || 1) : false;
        const slugs = Array.isArray(row?.feature_slugs) ? row.feature_slugs : [];
        const features = slugs.map(
          (slug) => featureMap.get(slug) || { feature_slug: slug }
        );
        return {
          raw: row,
          level,
          isUnlocked: unlocked,
          stats: summarizeLevelRow(row),
          features,
        };
      });
    }, [progression, featureMap, sheetLevel]);

    const visibleRows = (filterMode === "all"
      ? normalizedRows
      : normalizedRows.filter((row) => row.isUnlocked)
    ).sort((a, b) => a.level - b.level);

    if (!classSlug) {
      return Card({
        children: React.createElement(
          "div",
          { className: "ui-hint" },
          "Add a class name to your sheet to see the official feature list."
        ),
      });
    }
    if (!supportsApi) {
      return Card({
        children: React.createElement(
          "div",
          { className: "ui-hint" },
          "Class feature data needs Supabase REST access. Double-check your environment variables."
        ),
      });
    }

    const errorBanner =
      status === "error"
        ? Card({
            style: {
              borderColor: "rgba(239,68,68,0.45)",
              background: "rgba(239,68,68,0.08)",
            },
            children: React.createElement(
              "div",
              { className: "grid gap-2" },
              React.createElement(
                "div",
                { style: { fontWeight: 600, color: "#ef4444" } },
                "Feature download failed"
              ),
              React.createElement(
                "div",
                { className: "ui-hint", style: { textTransform: "none" } },
                error?.message ||
                  "The request was blocked or returned invalid data."
              ),
              React.createElement(
                Btn,
                { type: "button", onClick: onRefresh },
                "Try again"
              )
            ),
          })
        : null;

    const statusHint =
      status === "loading"
        ? Card({
            children: React.createElement(
              "div",
              { className: "ui-hint" },
              "Loading class progression…"
            ),
          })
        : null;

    const headerCard = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
              alignItems: "center",
            },
          },
          React.createElement(
            "div",
            { style: { display: "grid", gap: 2 } },
            React.createElement("div", { className: "ui-label" }, "Class Reference"),
            React.createElement(
              "div",
              { style: { fontSize: "1.2rem", fontWeight: 600 } },
              classNameLabel || toSlugTitle(classSlug)
            ),
            React.createElement(
              "div",
              { className: "ui-hint", style: { textTransform: "none" } },
              `Character level: ${sheetLevel}`
            )
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            React.createElement(
              Btn,
              {
                type: "button",
                onClick: () =>
                  setFilterMode((mode) => (mode === "all" ? "current" : "all")),
              },
              filterMode === "all" ? "Show unlocked only" : "Show all levels"
            ),
            React.createElement(
              Btn,
              { type: "button", onClick: onRefresh, disabled: status === "loading" },
              status === "loading" ? "Refreshing…" : "Refresh data"
            )
          )
        )
      ),
    });

    const classLevelStats = classLevelData ? summarizeLevelRow(classLevelData) : [];

    const classSummaryCard = !classLevelData
      ? null
      : Card({
          children: React.createElement(
            "div",
            { className: "grid gap-2" },
            React.createElement(
              "div",
              { className: "ui-label" },
              "Current Level Snapshot"
            ),
            classLevelStats.length
              ? React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    },
                  },
                  classLevelStats.map((stat, index) =>
                    React.createElement(
                      "span",
                      {
                        key: `${stat.label}-${index}`,
                        className: "tag",
                        style: { fontSize: "0.8rem" },
                      },
                      React.createElement("span", null, stat.label),
                      React.createElement(
                        "strong",
                        { style: { marginLeft: 4 } },
                        stat.value
                      )
                    )
                  )
                )
              : React.createElement(
                  "div",
                  { className: "ui-hint" },
                  "No numeric stats provided for this level."
                ),
            classLevelData.notes
              ? React.createElement(
                  "div",
                  {
                    className: "ui-hint",
                    style: { textTransform: "none" },
                  },
                  classLevelData.notes
                )
              : null
          ),
        });

    const subclassSelectionHint = !classSlug
      ? "Select a class to view subclasses."
      : !subclassList.length
      ? "No subclass data is available for this class."
      : canSelectSubclass
      ? "Choose a subclass to highlight its features."
      : "Reach level 3 to unlock subclass selection.";

    const subclassCards = subclassList.map((sub) => {
      const isActive = sub?.subclass_slug === activeSubclassSlug;
      const summary = sub?.summary || "No summary available.";
      const actionButton =
        typeof onSelectSubclass === "function"
          ? React.createElement(
              Btn,
              {
                type: "button",
                className: isActive ? "btn-primary" : "btn-muted",
                onClick: () => onSelectSubclass(sub.subclass_slug),
                disabled: !canSelectSubclass || isActive,
              },
              isActive ? "Selected" : canSelectSubclass ? "Select" : "Locked"
            )
          : null;
      return Card({
        key: sub.subclass_slug,
        style: {
          borderColor: isActive
            ? "rgba(125,211,252,0.6)"
            : "rgba(148,163,184,0.25)",
          background: isActive
            ? "rgba(125,211,252,0.08)"
            : "rgba(15,23,42,0.25)",
        },
        children: React.createElement(
          "div",
          { className: "grid gap-2" },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              },
            },
            React.createElement(
              "div",
              { style: { fontWeight: 600 } },
              sub?.title || toSlugTitle(sub?.subclass_slug || "Subclass")
            ),
            actionButton
          ),
          React.createElement(
            "div",
            {
              className: "ui-hint",
              style: { textTransform: "none", lineHeight: 1.5 },
            },
            summary
          ),
          sub?.source
            ? React.createElement(
                "div",
                { className: "ui-hint", style: { fontStyle: "italic" } },
                sub.source
              )
            : null
        ),
      });
    });

    const clearSubclassButton =
      resolvedSubclass &&
      typeof onSelectSubclass === "function" &&
      subclassList.length
        ? React.createElement(
            Btn,
            {
              type: "button",
              className: "btn-muted",
              onClick: () => onSelectSubclass(""),
            },
            "Clear selection"
          )
        : null;

    const subclassSection = !subclassList.length
      ? null
      : Card({
          children: React.createElement(
            "div",
            { className: "grid gap-3" },
            React.createElement(
              "div",
              { className: "ui-label" },
              "Subclass Options"
            ),
            React.createElement(
              "div",
              { className: "ui-hint", style: { textTransform: "none" } },
              subclassSelectionHint
            ),
            React.createElement(
              "div",
              {
                className: "grid gap-3",
                style: {
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                },
              },
              subclassCards
            ),
            clearSubclassButton
          ),
        });

    const levelCards = visibleRows.map((row, levelIndex) =>
      Card({
        key: row.level || `level-${levelIndex}`,
        style: row.isUnlocked
          ? { borderColor: "rgba(34,197,94,0.35)" }
          : { opacity: 0.9 },
        children: React.createElement(
          "div",
          { className: "grid gap-3" },
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
              { style: { fontWeight: 600, fontSize: "1.1rem" } },
              `Level ${row.level}`
            ),
            React.createElement(
              "span",
              {
                className: "tag",
                style: {
                  borderColor: row.isUnlocked
                    ? "rgba(34,197,94,0.6)"
                    : "rgba(148,163,184,0.4)",
                  color: row.isUnlocked ? "#22c55e" : "inherit",
                },
              },
              row.isUnlocked ? "Unlocked" : "Future"
            )
          ),
          row.stats.length
            ? React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  },
                },
                row.stats.map((stat, index) =>
                  React.createElement(
                    "div",
                    {
                      key: `${row.level}-${stat.label}-${index}`,
                      className: "tag",
                      style: { fontSize: "0.8rem" },
                    },
                    React.createElement("span", null, stat.label),
                    React.createElement(
                      "strong",
                      { style: { marginLeft: 4 } },
                      stat.value
                    )
                  )
                )
              )
            : null,
          row.features.length
            ? React.createElement(
                "div",
                { className: "grid gap-2" },
                row.features.map((feature, featureIndex) =>
                  React.createElement(
                    "div",
                    {
                      key:
                        feature?.feature_slug ||
                        `feature-${row.level}-${featureIndex}`,
                      style: {
                        border: "1px solid rgba(148,163,184,0.35)",
                        borderRadius: 12,
                        padding: "0.75rem",
                        background: row.isUnlocked
                          ? "rgba(59,130,246,0.04)"
                          : "rgba(15,23,42,0.35)",
                      },
                    },
                    React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                        },
                      },
                      React.createElement(
                        "div",
                        { style: { fontWeight: 600 } },
                        feature?.title || toSlugTitle(feature?.feature_slug || "Feature")
                      ),
                      feature?.feature_type
                        ? React.createElement(
                            "span",
                            { className: "tag", style: { fontSize: "0.75rem" } },
                            toSlugTitle(feature.feature_type)
                          )
                        : null
                    ),
                    feature?.short_text
                      ? React.createElement(
                          "div",
                          {
                            className: "ui-hint",
                            style: {
                              textTransform: "none",
                              lineHeight: 1.5,
                            },
                          },
                          feature.short_text
                        )
                      : null,
                    feature?.detail_md
                      ? React.createElement(
                          "details",
                          { style: { marginTop: 8 } },
                          React.createElement(
                            "summary",
                            {
                              style: {
                                cursor: "pointer",
                                fontWeight: 600,
                              },
                            },
                            "Full description"
                          ),
                          React.createElement(
                            "div",
                            {
                              style: {
                                marginTop: 6,
                                textTransform: "none",
                                whiteSpace: "pre-line",
                                lineHeight: 1.5,
                              },
                            },
                            feature.detail_md
                          )
                        )
                      : null,
                    feature?.source
                      ? React.createElement(
                          "div",
                          {
                            className: "ui-hint",
                            style: {
                              marginTop: 6,
                              fontStyle: "italic",
                            },
                          },
                          feature.source
                        )
                      : null
                  )
                )
              )
            : React.createElement(
                "div",
                { className: "ui-hint" },
                "No feature slug metadata for this level."
              ),
          row.raw?.notes
            ? React.createElement(
                "div",
                {
                  className: "ui-hint",
                  style: { textTransform: "none", marginTop: 4 },
                },
                row.raw.notes
              )
            : null
        ),
      })
    );

    const subclassFeatureSection = resolvedSubclass
      ? Card({
          children: React.createElement(
            "div",
            { className: "grid gap-3" },
            React.createElement(
              "div",
              { className: "ui-label" },
              `${resolvedSubclass.title || "Subclass"} Features`
            ),
            subclassFeatures.length
              ? subclassFeatures.map((feature, featureIndex) =>
                  Card({
                    key:
                      feature?.feature_slug ||
                    `${resolvedSubclass.subclass_slug}-${featureIndex}`,
                    children: React.createElement(
                      "div",
                      { className: "grid gap-2" },
                      React.createElement(
                        "div",
                        {
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                          },
                        },
                        React.createElement(
                          "div",
                          { style: { fontWeight: 600 } },
                          feature?.title ||
                            toSlugTitle(feature?.feature_slug || "Feature")
                        ),
                        feature?.level
                          ? React.createElement(
                              "span",
                              { className: "tag" },
                              `Level ${feature.level}`
                            )
                          : null
                      ),
                      feature?.short_text
                        ? React.createElement(
                            "div",
                            {
                              className: "ui-hint",
                              style: { textTransform: "none", lineHeight: 1.5 },
                            },
                            feature.short_text
                          )
                        : null,
                      feature?.detail_md
                        ? React.createElement(
                            "details",
                            { style: { marginTop: 6 } },
                            React.createElement(
                              "summary",
                              {
                                style: {
                                  cursor: "pointer",
                                  fontWeight: 600,
                                },
                              },
                              "Full description"
                            ),
                            React.createElement(
                              "div",
                              {
                                style: {
                                  marginTop: 6,
                                  textTransform: "none",
                                  whiteSpace: "pre-line",
                                  lineHeight: 1.5,
                                },
                              },
                              feature.detail_md
                            )
                          )
                        : null,
                      feature?.source
                        ? React.createElement(
                            "div",
                            {
                              className: "ui-hint",
                              style: {
                                textTransform: "none",
                                fontStyle: "italic",
                              },
                            },
                            feature.source
                          )
                        : null
                    ),
                  })
                )
              : React.createElement(
                  "div",
                  { className: "ui-hint" },
                  "No subclass features returned from Supabase."
                )
          ),
        })
      : subclassList.length && canSelectSubclass
      ? Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Choose a subclass to view its feature breakdown."
          ),
        })
      : null;

    const emptyMessage =
      visibleRows.length === 0 && status !== "loading"
        ? Card({
            children: React.createElement(
              "div",
              { className: "ui-hint" },
              filterMode === "all"
                ? "No rows returned from Supabase."
                : "No features unlocked yet at this level."
            ),
          })
        : null;

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      headerCard,
      classSummaryCard,
      subclassSection,
      errorBanner,
      !errorBanner && statusHint,
      emptyMessage,
      levelCards,
      subclassFeatureSection
    );
  }

  Components.Features = SheetFeatures;
})();
