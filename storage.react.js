(function () {
  const AppNS = (window.App = window.App || {});
  const supa = AppNS.supabase; // reuse the singleton from storage.supabase.js

  AppNS.getSession = async function () {
    if (!supa || !supa.auth) return null;
    const {
      data: { session },
    } = await supa.auth.getSession();
    return session || null;
  };
})();
