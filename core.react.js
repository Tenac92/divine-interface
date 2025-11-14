(function () {
  const AppNS = (window.App = window.App || {});
  const CoreNS = (window.Core = window.Core || {});
  const { useState, useEffect } = React;

  // ---------- Session store ----------
  const SESSION_KEY = "di.session.v1";
  const sessionListeners = new Set();
  let currentSession = null;

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.username !== "string") return null;
      return parsed;
    } catch (err) {
      console.warn("[Core] Failed to read stored session:", err);
      return null;
    }
  }

  function persistSession() {
    try {
      if (!currentSession) {
        localStorage.removeItem(SESSION_KEY);
      } else {
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      }
    } catch (err) {
      console.warn("[Core] Failed to persist session:", err);
    }
  }

  function emitSession() {
    sessionListeners.forEach((fn) => {
      try {
        fn(currentSession);
      } catch (err) {
        console.error("[Core] Session listener error:", err);
      }
    });
  }

  currentSession = readStoredSession();

  CoreNS.getSession = function () {
    return currentSession;
  };
  CoreNS.subscribe = function (fn) {
    if (typeof fn !== "function") return () => {};
    sessionListeners.add(fn);
    fn(currentSession);
    return () => sessionListeners.delete(fn);
  };
  CoreNS.setSession = function (next) {
    if (next) {
      currentSession = {
        userId: next.userId || next.id || null,
        username: String(next.username || "").trim(),
        role: next.role || "player",
        loggedInAt: next.loggedInAt || Date.now(),
      };
    } else {
      currentSession = null;
    }
    persistSession();
    emitSession();
  };
  CoreNS.clearSession = function () {
    CoreNS.setSession(null);
  };
  CoreNS.logout = function () {
    CoreNS.setSession(null);
  };
  CoreNS.login = async function (usernameRaw, passwordRaw) {
    const username = String(usernameRaw || "").trim();
    const password = String(passwordRaw || "");
    if (!username || !password) {
      throw new Error("Enter both username and password.");
    }
    const supa = (window.App && window.App.supabase) || null;
    if (!supa) {
      throw new Error("Supabase client not ready. Try again in a moment.");
    }
    const { data, error } = await supa
      .from("di_users")
      .select("id, username, password, role")
      .eq("username", username)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw error;
    }
    if (!data || data.password !== password) {
      throw new Error("Invalid username or password.");
    }
    const session = {
      userId: data.id,
      username: data.username,
      role: data.role || "player",
    };
    CoreNS.setSession(session);
    return session;
  };

  // ---------- Tiny hash router ----------
  function getPath() {
    const h = location.hash || "#/sheet";
    return h.startsWith("#") ? h.slice(1) : h;
  }
  function useHashRoute() {
    const [path, setPath] = useState(getPath());
    useEffect(() => {
      const onHash = () => setPath(getPath());
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);
    const nav = (to) => {
      if (!to.startsWith("/")) to = "/" + to;
      location.hash = to;
    };
    return { path, nav };
  }
  function NavLink({ to, children }) {
    const cur = getPath();
    const isActive = cur === to;
    return React.createElement(
      "a",
      { href: "#" + to, className: "btn " + (isActive ? "active-link" : "") },
      children
    );
  }

  // ---------- Theme / Lang ----------
  function useTheme() {
    const key = "divine_theme";
    const [theme, setTheme] = useState(
      () => localStorage.getItem(key) || "dark"
    );
    useEffect(() => {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(key, theme);
    }, [theme]);
    return { theme, setTheme };
  }
  function useLang() {
    const key = "divine_lang";
    const [lang, setLang] = useState(() => localStorage.getItem(key) || "en");
    useEffect(() => localStorage.setItem(key, lang), [lang]);
    return { lang, setLang };
  }

  function ToastHost() {
    const [msg, setMsg] = useState(null);
    useEffect(() => {
      AppNS.toast = (m) => {
        setMsg(m);
        setTimeout(() => setMsg(null), 1600);
      };
    }, []);
    return msg ? React.createElement("div", { className: "toast" }, msg) : null;
  }

  function Navbar({ session, onToggleTheme, onLogout }) {
    const isLoggedIn = !!session;
    const isAdmin = session?.role === "admin";
    return React.createElement(
      "header",
      {
        className:
          "flex items-center justify-between mb-4 sticky top-0 z-10 backdrop-blur",
      },
      React.createElement(
        "h1",
        { className: "text-2xl font-semibold" },
        "dIVINE INTERFACE+"
      ),
      React.createElement(
        "nav",
        { className: "flex items-center gap-2 flex-wrap" },
        isLoggedIn && React.createElement(NavLink, { to: "/sheet" }, "Sheet"),
        isLoggedIn &&
          React.createElement(NavLink, { to: "/combat" }, "Combat"),
        isLoggedIn && React.createElement(NavLink, { to: "/store" }, "Store"),
        isLoggedIn &&
          isAdmin &&
          React.createElement(NavLink, { to: "/admin" }, "Admin"),
        React.createElement(
          "button",
          { className: "btn", onClick: onToggleTheme },
          "Light / Dark"
        ),
        isLoggedIn &&
          React.createElement(
            "span",
            { className: "opacity-70 text-sm" },
            session.username
          ),
        isLoggedIn &&
          React.createElement(
            "button",
            { className: "btn", onClick: onLogout },
            "Logout"
          )
      )
    );
  }

  function LoginScreen() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const supaReady = !!(window.App && window.App.supabase);

    const onSubmit = async (e) => {
      e.preventDefault();
      setError(null);
      try {
        setLoading(true);
        const session = await CoreNS.login(username, password);
        if (AppNS.toast) {
          AppNS.toast(`Welcome back, ${session.username}!`);
        }
      } catch (err) {
        const msg =
          err?.message ||
          (typeof err === "string" ? err : "Login failed. Try again.");
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    return React.createElement(
      "div",
      { className: "max-w-md mx-auto mt-16 card space-y-4" },
      React.createElement(
        "h2",
        { className: "text-xl font-semibold text-center" },
        "Player Login"
      ),
      React.createElement(
        "p",
        { className: "text-sm opacity-80 text-center" },
        "Sign in with your campaign credentials to access your sheet and store."
      ),
      !supaReady &&
        React.createElement(
          "div",
          {
            className:
              "text-sm border border-yellow-400/40 bg-yellow-400/10 text-yellow-100 rounded-lg p-3",
          },
          "Supabase connection is still starting. If login fails, please try again shortly."
        ),
      error &&
        React.createElement(
          "div",
          {
            className:
              "text-sm border border-red-400/40 bg-red-500/10 text-red-100 rounded-lg p-3",
          },
          error
        ),
      React.createElement(
        "form",
        { className: "grid gap-3", onSubmit },
        React.createElement(
          "label",
          { className: "grid gap-1 text-sm" },
          React.createElement("span", { className: "opacity-80" }, "Username"),
          React.createElement("input", {
            className: "btn w-full",
            autoComplete: "username",
            value: username,
            onChange: (e) => setUsername(e.target.value),
            disabled: loading,
            required: true,
          })
        ),
        React.createElement(
          "label",
          { className: "grid gap-1 text-sm" },
          React.createElement("span", { className: "opacity-80" }, "Password"),
          React.createElement("input", {
            className: "btn w-full",
            type: "password",
            autoComplete: "current-password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            disabled: loading,
            required: true,
          })
        ),
        React.createElement(
          "button",
          {
            className: "btn font-semibold",
            type: "submit",
            disabled: loading || !username || !password,
          },
          loading ? "Signing in..." : "Sign In"
        )
      )
    );
  }

  function AppShell() {
    const { path } = useHashRoute();
    const themeState = useTheme();
    const langState = useLang();
    const [session, setSession] = useState(() =>
      CoreNS.getSession ? CoreNS.getSession() : null
    );
    useEffect(() => {
      if (typeof CoreNS.subscribe !== "function") return;
      return CoreNS.subscribe((next) => setSession(next));
    }, []);

    AppNS.theme = themeState;
    AppNS.lang = langState;

    // Simple router switch
    let pageEl = null;
    if (!session) {
      pageEl = React.createElement(LoginScreen);
    } else if (path === "/admin") {
      pageEl =
        session.role === "admin"
          ? React.createElement(AppNS.AdminPage)
          : React.createElement(
              "div",
              { className: "card max-w-lg mx-auto" },
              React.createElement(
                "h2",
                { className: "text-lg font-semibold mb-2" },
                "Access restricted"
              ),
              React.createElement(
                "p",
                { className: "text-sm opacity-75" },
                "Only administrators can open the control panel."
              )
            );
    } else if (path === "/combat") {
      const CombatPage = AppNS.CombatPage || AppNS.SheetPage;
      const combatProps =
        CombatPage === AppNS.SheetPage
          ? { initialTab: "combat", lockedTab: "combat", hideTabs: true }
          : null;
      pageEl = React.createElement(CombatPage, combatProps);
    } else if (path === "/store") {
      pageEl = React.createElement(AppNS.StorePage);
    } else {
      pageEl = React.createElement(AppNS.SheetPage); // default /sheet
    }

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Navbar, {
        session,
        onToggleTheme: () =>
          AppNS.theme.setTheme(AppNS.theme.theme === "dark" ? "light" : "dark"),
        onLogout: () => CoreNS.logout(),
      }),
      pageEl,
      React.createElement(ToastHost, null)
    );
  }

  AppNS.AppShell = AppShell;
})();
