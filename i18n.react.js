(function () {
  const AppNS = (window.App = window.App || {});
  const dict = {
    en: {
      new: "New",
      export: "Export",
      import: "Import",
      save: "Save",
      load: "Load…",
      skills: "Skills",
      notes: "Notes",
    },
    el: {
      new: "Νέος",
      export: "Εξαγωγή",
      import: "Εισαγωγή",
      save: "Αποθήκευση",
      load: "Φόρτωση…",
      skills: "Δεξιότητες",
      notes: "Σημειώσεις",
    },
  };
  AppNS.t = (k) =>
    (dict[(AppNS.lang && AppNS.lang.lang) || "en"] || dict.en)[k] || k;
})();
