// i18n (UI strings) — Phase 3
(function(){
  const DICT = {
    en: {
      // App & auth
      app_title: 'Divine Interface',
      logout: 'Logout',
      login: 'Login',
      username: 'Username',
      password: 'Password',
      need_credentials: 'Please enter username & password',
      invalid: 'Invalid credentials.',
      admin_setup: 'Admin Setup',
      admin_setup_tip: 'No users found. Create an Admin account to begin.',
      admin_username: 'Admin Username',
      admin_password: 'Admin Password',
      create_admin: 'Create Admin',
      welcome: (o)=> `Welcome, ${o?.name||'hero'}!`,
      app_hint: 'Modular shell is active. Store and Character Sheet are available.',

      // Navigation
      nav_store: 'Store',
      nav_sheet: 'Character Sheet',

      // Common labels / Character Sheet
      sheet_title: 'Character Sheet',
      name: 'Name',
      class: 'Class',
      level: 'Level',
      patron: 'God / Patron',
      alignment: 'Alignment',
      proficiency: 'Proficiency',
      ac: 'AC',
      hp: 'HP',
      speed: 'Speed',
      skills: 'Skills',
      inventory: 'Inventory',
      spells: 'Spells/Features',
      notes: 'Notes',
      back: 'Back',
      save: 'Save',
      saved: 'Saved'
    },

    el: {
      // App & auth
      app_title: 'Θείο Περιβάλλον',
      logout: 'Αποσύνδεση',
      login: 'Σύνδεση',
      username: 'Όνομα χρήστη',
      password: 'Κωδικός',
      need_credentials: 'Συμπλήρωσε όνομα χρήστη και κωδικό',
      invalid: 'Μη έγκυρα στοιχεία.',
      admin_setup: 'Ρύθμιση Διαχειριστή',
      admin_setup_tip: 'Δεν υπάρχουν χρήστες. Δημιούργησε λογαριασμό Διαχειριστή για να ξεκινήσεις.',
      admin_username: 'Όνομα Διαχειριστή',
      admin_password: 'Κωδικός Διαχειριστή',
      create_admin: 'Δημιουργία Διαχειριστή',
      welcome: (o)=> `Καλώς ήρθες, ${o?.name||'ήρωα'}!`,
      app_hint: 'Το modular κέλυφος είναι ενεργό. Το Κατάστημα και το Φύλλο Χαρακτήρα είναι διαθέσιμα.',

      // Navigation
      nav_store: 'Κατάστημα',
      nav_sheet: 'Φύλλο Χαρακτήρα',

      // Common labels / Character Sheet
      sheet_title: 'Φύλλο Χαρακτήρα',
      name: 'Όνομα',
      class: 'Κλάση',
      level: 'Επίπεδο',
      patron: 'Θεός / Προστάτης',
      alignment: 'Στοίχιση',
      proficiency: 'Επιδεξιότητα',
      ac: 'ΘΠ (AC)',
      hp: 'Ζωή (HP)',
      speed: 'Ταχύτητα',
      skills: 'Ικανότητες',
      inventory: 'Εξοπλισμός',
      spells: 'Ξόρκια/Ικανότητες',
      notes: 'Σημειώσεις',
      back: 'Πίσω',
      save: 'Αποθήκευση',
      saved: 'Αποθηκεύτηκε'
    }
  };

  let LANG = localStorage.getItem('divine_lang') || 'en';
  function t(key, obj){
    const dict = DICT[LANG] || DICT.en;
    const val = dict[key];
    if(typeof val === 'function') return val(obj);
    return val || key;
  }
  function setLang(v){ LANG = v; localStorage.setItem('divine_lang', v); }

  window.I18N = { t, setLang };
})();
