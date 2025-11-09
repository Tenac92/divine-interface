(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetNotes({ Card, Field, notes, onChange }) {
    return Card({
      children: Field({
        label: "Campaign notes",
        children: React.createElement("textarea", {
          className: "ui-input",
          style: { minHeight: 180, resize: "vertical" },
          value: notes || "",
          placeholder: "Backstory, session notes, bonds...",
          onChange: (e) => onChange(e.target.value),
        }),
      }),
    });
  }

  Components.Notes = SheetNotes;
})();
