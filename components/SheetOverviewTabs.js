(function () {
  const AppNS = (window.App = window.App || {});
  const React = window.React;
  if (!React) return;
  const { useState } = React;
  const Components = AppNS.SheetComponents || {};
  const RawOverview = Components.Overview;
  if (!RawOverview) return;

  function SheetOverviewTabs(props) {
    const { preparedSpellLevels = [] } = props;
    const sorted = preparedSpellLevels.slice().sort((a, b) => a - b);
    const levelKeys = sorted.map((lvl) => String(lvl));
    const initial = levelKeys[0] || "0";
    const [active, setActive] = useState(initial);
    const current = levelKeys.includes(String(active)) ? String(active) : initial;
    return React.createElement(RawOverview, Object.assign({}, props, {
      activeSpellLevel: current,
      onSpellLevelTabChange: setActive,
    }));
  }

  AppNS.SheetComponents.Overview = SheetOverviewTabs;
})();
