(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useState } = React;

  const supa = AppNS.supabase || null;
  const RemoteStore = window.RemoteStore || null;
  const hasRemote = !!RemoteStore;

  const LS_USERS = "di.users.local.v1";
  const LS_PROFILES = "di.store.profiles.v1";

  const loadUsersLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_USERS) || "[]");
    } catch {
      return [];
    }
  };
  const saveUsersLocal = (users) => {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  };

  const loadProfilesLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_PROFILES) || "{}");
    } catch {
      return {};
    }
  };
  const saveProfileLocal = (owner, profile) => {
    const all = loadProfilesLocal();
    all[owner] = profile;
    localStorage.setItem(LS_PROFILES, JSON.stringify(all));
  };

  const randId = () => Math.random().toString(36).slice(2, 10);
  const defaultProfile = (username) => ({
    id: randId(),
    name: username || "",
    god: "Tyr/Bahamut",
    level: 1,
    fp: 10,
    owned: [],
    lock: false,
    sheet: null,
  });

  async function loadUsersAny() {
    if (hasRemote) {
      try {
        const data = await RemoteStore.loadUsers();
        if (Array.isArray(data)) return data;
      } catch (err) {
        console.warn("[Admin] Remote loadUsers failed", err);
      }
    }
    return loadUsersLocal();
  }

  async function persistUsersAny(users) {
    if (hasRemote) {
      try {
        await RemoteStore.saveUsers(users);
      } catch (err) {
        console.error("[Admin] saveUsers failed", err);
        throw err;
      }
    } else {
      saveUsersLocal(users);
    }
  }

  async function deleteUserRemote(username) {
    if (!username) return;
    if (hasRemote && supa) {
      const { error } = await supa.from("di_users").delete().eq("username", username);
      if (error) throw error;
    } else if (!hasRemote) {
      const users = loadUsersLocal().filter((u) => u.username !== username);
      saveUsersLocal(users);
    }
  }

  async function loadProfilesAny() {
    if (hasRemote) {
      try {
        return await RemoteStore.loadProfiles();
      } catch (err) {
        console.warn("[Admin] Remote loadProfiles failed", err);
      }
    }
    return loadProfilesLocal();
  }

  async function loadProfileAny(owner) {
    if (!owner) return null;
    if (hasRemote) {
      try {
        return await RemoteStore.loadProfile(owner);
      } catch (err) {
        console.warn("[Admin] Remote loadProfile failed", err);
      }
    }
    const all = loadProfilesLocal();
    return all[owner] || null;
  }

  async function saveProfileAny(owner, profile) {
    if (!owner) return;
    if (hasRemote) {
      await RemoteStore.saveProfile(owner, profile);
    } else {
      saveProfileLocal(owner, profile);
    }
  }

  const Card = ({ className = "", children, ...rest }) =>
    React.createElement(
      "div",
      { ...rest, className: ["card", className].filter(Boolean).join(" ") },
      children
    );
  const Btn = ({ className = "", children, ...rest }) =>
    React.createElement(
      "button",
      { ...rest, className: ["btn", className].filter(Boolean).join(" ") },
      children
    );
  const Field = ({ label, hint, children }) =>
    React.createElement(
      "label",
      { className: "ui-field" },
      label ? React.createElement("span", { className: "ui-label" }, label) : null,
      children,
      hint ? React.createElement("span", { className: "ui-hint" }, hint) : null
    );

  function AdminPage() {
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [users, setUsers] = useState([]);
    const [userFilter, setUserFilter] = useState("");
    const [passwordDrafts, setPasswordDrafts] = useState({});
    const [savingUsers, setSavingUsers] = useState(false);

    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [profiles, setProfiles] = useState([]);
    const [profileFilter, setProfileFilter] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    const [newUser, setNewUser] = useState({
      username: "",
      password: "",
      role: "player",
    });

    useEffect(() => {
      refreshUsers();
      refreshProfiles();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function refreshUsers() {
      setLoadingUsers(true);
      const list = await loadUsersAny();
      setUsers(Array.isArray(list) ? list : []);
      setLoadingUsers(false);
    }

    async function refreshProfiles() {
      setLoadingProfiles(true);
      const map = await loadProfilesAny();
      const arr = Object.entries(map || {}).map(([owner, profile]) => ({
        owner,
        profile: profile || defaultProfile(owner),
      }));
      arr.sort((a, b) => a.owner.localeCompare(b.owner));
      setProfiles(arr);
      setLoadingProfiles(false);
    }

    const filteredUsers = useMemo(() => {
      const q = userFilter.trim().toLowerCase();
      const list = Array.isArray(users) ? users.slice() : [];
      list.sort((a, b) => a.username.localeCompare(b.username));
      if (!q) return list;
      return list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.role || "").toLowerCase().includes(q)
      );
    }, [users, userFilter]);

    const filteredProfiles = useMemo(() => {
      const q = profileFilter.trim().toLowerCase();
      if (!q) return profiles;
      return profiles.filter(({ owner, profile }) => {
        const haystack = [
          owner,
          profile?.god,
          profile?.name,
          String(profile?.fp ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }, [profiles, profileFilter]);

    const stats = useMemo(() => {
      const totalUsers = users.length;
      const adminCount = users.filter((u) => u.role === "admin").length;
      const playerCount = totalUsers - adminCount;
      const lockedProfiles = profiles.filter((p) => p.profile?.lock).length;
      const totalFP = profiles.reduce(
        (sum, p) => sum + Math.max(Number(p.profile?.fp ?? 0), 0),
        0
      );
      return { totalUsers, adminCount, playerCount, lockedProfiles, totalFP };
    }, [users, profiles]);

    const userCards =
      filteredUsers.length === 0
        ? React.createElement(
            Card,
            { style: { opacity: 0.7 } },
            loadingUsers ? "Loading users..." : "No users found."
          )
        : filteredUsers.map((user) =>
            Card({
              key: user.username,
              children: React.createElement(
                "div",
                { className: "grid gap-3" },
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
                    user.username
                  ),
                  React.createElement(
                    "span",
                    { className: "tag" },
                    user.role === "admin" ? "Administrator" : "Player"
                  )
                ),
                Field({
                  label: "Role",
                  children: React.createElement(
                    "select",
                    {
                      className: "ui-select",
                      value: user.role || "player",
                      onChange: (e) => updateUser(user.username, { role: e.target.value }),
                    },
                    [
                      React.createElement("option", { key: "player", value: "player" }, "Player"),
                      React.createElement("option", { key: "admin", value: "admin" }, "Admin"),
                    ]
                  ),
                }),
                Field({
                  label: "Set new password",
                  children: React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      },
                    },
                    React.createElement("input", {
                      className: "ui-input",
                      type: "text",
                      placeholder: "Leave blank to keep current",
                      value: passwordDrafts[user.username] || "",
                      onChange: (e) =>
                        setPasswordDrafts((prev) => ({
                          ...prev,
                          [user.username]: e.target.value,
                        })),
                    }),
                    Btn({
                      type: "button",
                      className: "btn-primary",
                      onClick: () => applyPassword(user.username),
                      disabled: !passwordDrafts[user.username],
                      children: "Apply",
                    })
                  ),
                }),
                Btn({
                  type: "button",
                  className: "btn-muted",
                  onClick: () => removeUser(user.username),
                  children: "Remove user",
                })
              ),
            })
          );

    const profileCards =
      filteredProfiles.length === 0
        ? React.createElement(
            Card,
            { style: { opacity: 0.7 } },
            loadingProfiles ? "Loading profiles..." : "No profiles found."
          )
        : filteredProfiles.map(({ owner, profile }) => {
            const ownedCount = Array.isArray(profile?.owned)
              ? profile.owned.length
              : 0;
            const lastUpdated = profile?.sheet?.updatedAt || profile?.updatedAt;
            return Card({
              key: owner,
              children: React.createElement(
                "div",
                { className: "grid gap-3" },
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
                    owner
                  ),
                  React.createElement(
                    "div",
                    { className: "tag" },
                    profile?.god || "No patron"
                  )
                ),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    },
                  },
                  [
                    ["FP", profile?.fp ?? 0],
                    ["Level", profile?.level ?? 1],
                    ["Owned items", ownedCount],
                    ["Store lock", profile?.lock ? "Locked" : "Open"],
                  ].map(([label, value]) =>
                    React.createElement(
                      "div",
                      {
                        key: label,
                        className: "card",
                        style: {
                          padding: "0.6rem",
                          border: "1px solid rgba(125,211,252,0.2)",
                          background: "rgba(8,12,20,0.5)",
                        },
                      },
                      React.createElement("div", { className: "ui-label" }, label),
                      React.createElement("div", { style: { fontWeight: 600 } }, value)
                    )
                  )
                ),
                Field({
                  label: "Faith points",
                  children: React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      },
                    },
                    ["-5", "-1", "+1", "+5"].map((delta) =>
                      Btn({
                        key: delta,
                        type: "button",
                        onClick: () => adjustProfileFP(owner, Number(delta)),
                        children: delta,
                      })
                    ),
                    React.createElement("input", {
                      className: "ui-input",
                      type: "number",
                      defaultValue: profile?.fp ?? 0,
                      onKeyDown: (e) => {
                        if (e.key === "Enter") setProfileFP(owner, Number(e.currentTarget.value));
                      },
                    })
                  ),
                }),
                Field({
                  label: "Lock store access",
                  children: Btn({
                    type: "button",
                    className: profile?.lock ? "tab-btn-active" : "",
                    onClick: () => toggleLock(owner),
                    children: profile?.lock ? "Locked" : "Unlocked",
                  }),
                }),
                Field({
                  label: "Set patron",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: profile?.god || "",
                    placeholder: "Tyr/Bahamut",
                    onChange: (e) => patchProfile(owner, { god: e.target.value }),
                  }),
                }),
                lastUpdated
                  ? React.createElement(
                      "div",
                      { className: "ui-hint" },
                      "Sheet last saved ",
                      new Date(lastUpdated).toLocaleString()
                    )
                  : null,
                Btn({
                  type: "button",
                  className: "btn-muted",
                  onClick: () => resetProfile(owner),
                  children: "Reset to defaults",
                })
              ),
            });
          });

    const missingProfiles = useMemo(() => {
      const userNames = new Set(users.map((u) => u.username));
      const profileNames = new Set(profiles.map((p) => p.owner));
      return Array.from(userNames).filter((name) => !profileNames.has(name));
    }, [users, profiles]);

    async function updateUser(username, patch) {
      if (!username) return;
      setSavingUsers(true);
      const next = users.map((u) =>
        u.username === username ? { ...u, ...patch } : u
      );
      setUsers(next);
      try {
        await persistUsersAny(next);
        AppNS.toast && AppNS.toast("User updated.");
      } catch (err) {
        console.error("[Admin] updateUser failed", err);
        AppNS.toast && AppNS.toast("Failed to update user.");
        refreshUsers();
      } finally {
        setSavingUsers(false);
      }
    }

    async function applyPassword(username) {
      const pwd = passwordDrafts[username];
      if (!pwd) return;
      await updateUser(username, { password: pwd });
      setPasswordDrafts((prev) => ({ ...prev, [username]: "" }));
    }

    async function removeUser(username) {
      if (!window.confirm(`Remove user "${username}"? This cannot be undone.`)) {
        return;
      }
      setSavingUsers(true);
      try {
        await deleteUserRemote(username);
        const next = users.filter((u) => u.username !== username);
        setUsers(next);
        await persistUsersAny(next);
        AppNS.toast && AppNS.toast("User removed.");
      } catch (err) {
        console.error("[Admin] removeUser failed", err);
        AppNS.toast && AppNS.toast("Failed to remove user.");
        refreshUsers();
      } finally {
        setSavingUsers(false);
      }
    }

    async function createUser(e) {
      e.preventDefault();
      const username = newUser.username.trim();
      if (!username || username.length < 3) {
        AppNS.toast && AppNS.toast("Username must be at least 3 characters.");
        return;
      }
      if (users.some((u) => u.username === username)) {
        AppNS.toast && AppNS.toast("Username already exists.");
        return;
      }
      if (!newUser.password || newUser.password.length < 4) {
        AppNS.toast && AppNS.toast("Password must be at least 4 characters.");
        return;
      }
      const next = [
        ...users,
        {
          id: randId(),
          username,
          password: newUser.password,
          role: newUser.role || "player",
        },
      ];
      setSavingUsers(true);
      try {
        await persistUsersAny(next);
        setUsers(next);
        setNewUser({ username: "", password: "", role: "player" });
        AppNS.toast && AppNS.toast("User created.");
      } catch (err) {
        console.error("[Admin] createUser failed", err);
        AppNS.toast && AppNS.toast("Failed to create user.");
      } finally {
        setSavingUsers(false);
      }
    }

    async function adjustProfileFP(owner, delta) {
      const profile = profiles.find((p) => p.owner === owner)?.profile;
      if (!profile) return;
      await setProfileFP(owner, (profile.fp ?? 0) + delta);
    }

    async function setProfileFP(owner, fp) {
      const profile = profiles.find((p) => p.owner === owner)?.profile;
      if (!profile) return;
      const next = { ...profile, fp: Math.max(0, Number(fp) || 0) };
      await saveProfile(owner, next, "Faith points updated.");
    }

    async function toggleLock(owner) {
      const profile = profiles.find((p) => p.owner === owner)?.profile;
      if (!profile) return;
      const next = { ...profile, lock: !profile.lock };
      await saveProfile(owner, next, next.lock ? "Store locked." : "Store unlocked.");
    }

    async function resetProfile(owner) {
      if (!window.confirm("Reset this profile to defaults?")) return;
      const profile = defaultProfile(owner);
      await saveProfile(owner, profile, "Profile reset.");
      refreshProfiles();
    }

    async function patchProfile(owner, patch) {
      const profile = profiles.find((p) => p.owner === owner)?.profile;
      if (!profile) return;
      const next = { ...profile, ...patch };
      await saveProfile(owner, next);
    }

    async function saveProfile(owner, profile, toastMessage) {
      setProfileSaving(true);
      try {
        await saveProfileAny(owner, profile);
        setProfiles((prev) =>
          prev.map((entry) =>
            entry.owner === owner ? { owner, profile } : entry
          )
        );
        if (toastMessage) AppNS.toast && AppNS.toast(toastMessage);
      } catch (err) {
        console.error("[Admin] saveProfile failed", err);
        AppNS.toast && AppNS.toast("Failed to update profile.");
        refreshProfiles();
      } finally {
        setProfileSaving(false);
      }
    }

    async function createProfile(owner) {
      const existing = await loadProfileAny(owner);
      if (existing) {
        AppNS.toast && AppNS.toast("Profile already exists.");
        return;
      }
      const profile = defaultProfile(owner);
      await saveProfile(owner, profile, "Profile created.");
      refreshProfiles();
    }

    const heroCard = Card({
      className: "grid gap-3",
      children: React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            },
          },
          [
            ["Users", stats.totalUsers],
            ["Admins", stats.adminCount],
            ["Players", stats.playerCount],
            ["Locked stores", stats.lockedProfiles],
            ["Total FP", stats.totalFP],
          ].map(([label, value]) =>
            React.createElement(
              "div",
              {
                key: label,
                style: {
                  border: "1px solid rgba(125,211,252,0.2)",
                  borderRadius: 12,
                  padding: "0.75rem",
                  display: "grid",
                  gap: 6,
                  textAlign: "center",
                  background: "rgba(12,20,32,0.55)",
                },
              },
              React.createElement("div", { className: "ui-label" }, label),
              React.createElement(
                "div",
                { style: { fontSize: 24, fontWeight: 700 } },
                value
              )
            )
          )
        ),
        React.createElement(
          "div",
          { className: "flex flex-wrap gap-2" },
          Btn({
            type: "button",
            onClick: refreshUsers,
            children: loadingUsers ? "Refreshing users..." : "Refresh users",
          }),
          Btn({
            type: "button",
            onClick: refreshProfiles,
            children: loadingProfiles ? "Refreshing profiles..." : "Refresh profiles",
          }),
          profileSaving || savingUsers
            ? React.createElement(
                "span",
                { className: "ui-hint", style: { alignSelf: "center" } },
                "Saving changes..."
              )
            : null
        )
      ),
    });

    const newUserForm = Card({
      className: "grid gap-3",
      children: React.createElement(
        "form",
        {
          className: "grid gap-3",
          onSubmit: createUser,
        },
        React.createElement("h3", { style: { fontWeight: 600 } }, "Invite new user"),
        Field({
          label: "Username",
          children: React.createElement("input", {
            className: "ui-input",
            value: newUser.username,
            onChange: (e) =>
              setNewUser((prev) => ({ ...prev, username: e.target.value })),
            placeholder: "astral-knight",
          }),
        }),
        Field({
          label: "Password",
          children: React.createElement("input", {
            className: "ui-input",
            value: newUser.password,
            onChange: (e) =>
              setNewUser((prev) => ({ ...prev, password: e.target.value })),
            placeholder: "temporary password",
          }),
        }),
        Field({
          label: "Role",
          children: React.createElement(
            "select",
            {
              className: "ui-select",
              value: newUser.role,
              onChange: (e) =>
                setNewUser((prev) => ({ ...prev, role: e.target.value })),
            },
            [
              React.createElement("option", { key: "player", value: "player" }, "Player"),
              React.createElement("option", { key: "admin", value: "admin" }, "Admin"),
            ]
          ),
        }),
        Btn({
          type: "submit",
          className: "btn-primary",
          disabled: savingUsers,
          children: savingUsers ? "Creating..." : "Create user",
        })
      ),
    });

    const missingProfilesCard =
      missingProfiles.length === 0
        ? null
        : Card({
            className: "grid gap-2",
            children: React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                { style: { fontWeight: 600 } },
                "Users without profiles"
              ),
              React.createElement(
                "div",
                { className: "ui-hint" },
                "Create default profiles so they can accrue faith points."
              ),
              React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  },
                },
                missingProfiles.map((owner) =>
                  Card({
                    key: owner,
                    className: "grid gap-2",
                    children: React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(
                        "div",
                        { style: { fontWeight: 600 } },
                        owner
                      ),
                      Btn({
                        type: "button",
                        onClick: () => createProfile(owner),
                        className: "btn-primary",
                        children: "Create profile",
                      })
                    )
                  })
                )
              )
            ),
          });

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      heroCard,
      Card({
        className: "grid gap-3",
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement("h2", { style: { fontWeight: 600 } }, "User registry"),
          Field({
            label: "Filter users",
            children: React.createElement("input", {
              className: "ui-input",
              value: userFilter,
              onChange: (e) => setUserFilter(e.target.value),
              placeholder: "Search username or role",
            }),
          }),
          newUserForm,
          React.createElement(
            "div",
            { className: "grid gap-2" },
            userCards
          )
        ),
      }),
      Card({
        className: "grid gap-3",
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement("h2", { style: { fontWeight: 600 } }, "Player profiles"),
          Field({
            label: "Filter profiles",
            children: React.createElement("input", {
              className: "ui-input",
              value: profileFilter,
              onChange: (e) => setProfileFilter(e.target.value),
              placeholder: "Search by owner, patron, FP...",
            }),
          }),
          missingProfilesCard,
          React.createElement(
            "div",
            { className: "grid gap-2" },
            profileCards
          )
        ),
      })
    );
  }

  AppNS.AdminPage = AdminPage;
})();
