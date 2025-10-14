// i18n (UI strings only) — Phase 1
(function(){
  const DICT = {
    en: {
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
      app_hint: 'This is the modular shell. Store & Character Sheet will load in Phase 2–3.',
      nav_store: 'Store (coming)',
      nav_sheet: 'Character Sheet (coming)'
    },
    el: {
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
      app_hint: 'Αυτό είναι το modular κέλυφος. Το Store & το Φύλλο Χαρακτήρα θα φορτώσουν στις Φάσεις 2–3.',
      nav_store: 'Κατάστημα (σύντομα)',
      nav_sheet: 'Φύλλο Χαρακτήρα (σύντομα)'
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
