(function () {
  const AppNS = (window.App = window.App || {});
  const Components = (AppNS.SheetComponents = AppNS.SheetComponents || {});
  const React = window.React;
  if (!React) return;

  function SheetInventory({
    Card,
    Field,
    Btn,
    gearCatalogSection,
    inventory,
    addInventoryItem,
    updateInventoryItem,
    removeInventoryItem,
  }) {
    const list = Array.isArray(inventory) ? inventory : [];
    return Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        gearCatalogSection,
        list.length === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No gear yet. Add what your character carries."
            )
          : list.map((item) =>
              React.createElement(
                "div",
                {
                  key: item.id,
                  style: {
                    border: "1px solid rgba(125,211,252,0.2)",
                    borderRadius: 12,
                    padding: "0.75rem",
                    display: "grid",
                    gap: 8,
                  },
                },
                Field({
                  label: "Item name",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: item.name,
                    onChange: (e) =>
                      updateInventoryItem(item.id, "name", e.target.value),
                  }),
                }),
                Field({
                  label: "Quantity",
                  children: React.createElement("input", {
                    className: "ui-input",
                    type: "number",
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                    min: 0,
                    value: item.qty,
                    onChange: (e) =>
                      updateInventoryItem(
                        item.id,
                        "qty",
                        Math.max(0, Number(e.target.value) || 0)
                      ),
                  }),
                }),
                Field({
                  label: "Notes",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: item.note,
                    placeholder: "Properties, weight, effects...",
                    onChange: (e) =>
                      updateInventoryItem(item.id, "note", e.target.value),
                  }),
                }),
                Btn({
                  type: "button",
                  onClick: () => removeInventoryItem(item.id),
                  children: "Remove item",
                })
              )
            ),
        Btn({ type: "button", onClick: addInventoryItem, children: "+ Add item" })
      ),
    });
  }

  Components.Inventory = SheetInventory;
})();
