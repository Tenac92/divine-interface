(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useState } = React;

  const supa = AppNS.supabase || null;
  const RemoteStore = window.RemoteStore || null;
  const hasRemote = !!RemoteStore;
  const MapStore = AppNS.MapStore || null;

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
    heroStatus: "",
    heroGreeting: "",
    heroMessage: "",
    sheet: null,
  });
  const formatBytes = (value) => {
    if (!value || Number.isNaN(value)) return "n/a";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };
  const formatDate = (value) => {
    if (!value) return "n/a";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleDateString();
  };

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
    const [profileModal, setProfileModal] = useState(null);

    const [mapsLoading, setMapsLoading] = useState(true);
    const [maps, setMaps] = useState([]);
    const [mapError, setMapError] = useState(null);
    const [mapName, setMapName] = useState("");
    const [mapFile, setMapFile] = useState(null);
    const [mapUploading, setMapUploading] = useState(false);
    const [mapRenames, setMapRenames] = useState({});
    const [defaultMapId, setDefaultMapId] = useState(null);

    const [newUser, setNewUser] = useState({
      username: "",
      password: "",
      role: "player",
    });

    useEffect(() => {
      refreshUsers();
      refreshProfiles();
      refreshMaps();
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

    async function refreshMaps() {
      if (!MapStore) {
        setMaps([]);
        setMapsLoading(false);
        setDefaultMapId(null);
        return;
      }
      setMapsLoading(true);
      setMapError(null);
      try {
        if (MapStore.refreshRemoteList) {
          await MapStore.refreshRemoteList();
        }
        const list = MapStore.listMaps();
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setMaps(list);
        setDefaultMapId(MapStore.getDefaultMapId());
      } catch (err) {
        setMapError(err?.message || "Failed to load maps.");
      } finally {
        setMapsLoading(false);
      }
    }

    async function handleMapUpload() {
      if (!MapStore) return;
      if (!mapFile) {
        setMapError("Select a JSON file to upload.");
        return;
      }
      try {
        setMapUploading(true);
        setMapError(null);
        await MapStore.importMapFile(mapFile, mapName);
        setMapName("");
        setMapFile(null);
        await refreshMaps();
      } catch (err) {
        setMapError(err?.message || "Failed to upload map.");
      } finally {
        setMapUploading(false);
      }
    }

    async function handleMapRename(id) {
      if (!MapStore) return;
      const nextName = mapRenames[id];
      if (!nextName) return;
      try {
        await MapStore.updateMapName(id, nextName);
      } catch (err) {
        setMapError(err?.message || "Failed to rename map.");
      }
      setMapRenames((prev) => ({ ...prev, [id]: "" }));
      await refreshMaps();
    }

    async function handleMapDelete(id) {
      if (!MapStore) return;
      try {
        await MapStore.removeMap(id);
      } catch (err) {
        setMapError(err?.message || "Failed to remove map.");
      }
      await refreshMaps();
    }

    async function handleMapDefault(id) {
      if (!MapStore) return;
      try {
        setDefaultMapId(await MapStore.setDefaultMap(id));
      } catch (err) {
        setMapError(err?.message || "Failed to set default map.");
      }
      await refreshMaps();
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

    const mapCards =
      mapsLoading
        ? Card({
            className: "grid gap-2",
            children: "Loading maps...",
          })
        : maps.length === 0
        ? Card({
            className: "grid gap-2",
            children: "No maps available.",
          })
        : React.createElement(
            "div",
            { className: "grid gap-2" },
            maps.map((entry) => {
              const isDefault = entry.id === defaultMapId;
              const isBuiltin = entry.source === "builtin";
              return Card({
                key: entry.id,
                className: "grid gap-2",
                children: React.createElement(
                  React.Fragment,
                  null,
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
                      entry.name || entry.id
                    ),
                    React.createElement(
                      "div",
                      { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                      React.createElement(
                        "span",
                        { className: "tag" },
                        isBuiltin ? "Built-in" : "Local"
                      ),
                      isDefault &&
                        React.createElement("span", { className: "tag" }, "Default")
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "ui-hint" },
                    "Updated: ",
                    formatDate(entry.updatedAt),
                    " | Size: ",
                    formatBytes(entry.size)
                  ),
                  React.createElement(
                    "div",
                    { className: "grid gap-2" },
                    React.createElement("input", {
                      className: "ui-input",
                      placeholder: "Rename map",
                      value: mapRenames[entry.id] || "",
                      onChange: (e) =>
                        setMapRenames((prev) => ({
                          ...prev,
                          [entry.id]: e.target.value,
                        })),
                    }),
                    React.createElement(
                      "div",
                      { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                      Btn({
                        type: "button",
                        onClick: () => handleMapRename(entry.id),
                        disabled: !(mapRenames[entry.id] || "").trim(),
                        children: "Rename",
                      }),
                      Btn({
                        type: "button",
                        onClick: () => handleMapDefault(entry.id),
                        className: "btn-muted",
                        children: "Set default",
                      }),
                      Btn({
                        type: "button",
                        onClick: () => handleMapDelete(entry.id),
                        className: "btn-muted",
                        disabled: isBuiltin,
                        children: isBuiltin ? "Built-in" : "Delete",
                      })
                    )
                  )
                ),
              });
            })
          );

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
            const stats = [
              { label: "Faith", value: profile?.fp ?? 0 },
              { label: "Level", value: profile?.level ?? 1 },
              { label: "Owned", value: ownedCount },
              { label: "Store", value: profile?.lock ? "Locked" : "Open" },
            ];
            const handleReset = (event) => {
              event.stopPropagation();
              resetProfile(owner);
            };
            return Card({
              key: owner,
              style: {
                cursor: "pointer",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              },
              onClick: () => openProfileModal(owner),
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
                    { style: { fontWeight: 600, fontSize: "1.05rem" } },
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
                  stats.map((stat) =>
                    React.createElement(
                      "div",
                      {
                        key: stat.label,
                        className: "card",
                        style: {
                          padding: "0.6rem",
                          border: "1px solid rgba(125,211,252,0.2)",
                          background: "rgba(8,12,20,0.5)",
                        },
                      },
                      React.createElement("div", { className: "ui-label" }, stat.label),
                      React.createElement("div", { style: { fontWeight: 600 } }, stat.value)
                    )
                  )
                ),
                React.createElement(
                  "div",
                  { className: "ui-hint", style: { textTransform: "none" } },
                  lastUpdated
                    ? `Last sheet save ${new Date(lastUpdated).toLocaleString()}`
                    : "No sheet activity recorded yet."
                ),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    },
                  },
                  [
                    Btn({
                      type: "button",
                      className: "btn-primary",
                      onClick: (event) => {
                        event.stopPropagation();
                        openProfileModal(owner);
                      },
                      children: "Manage profile",
                    }),
                    Btn({
                      type: "button",
                      className: "btn-muted",
                      onClick: handleReset,
                      children: "Reset to defaults",
                    }),
                  ]
                )
              ),
            });
          });    const missingProfiles = useMemo(() => {
      const userNames = new Set(users.map((u) => u.username));
      const profileNames = new Set(profiles.map((p) => p.owner));
      return Array.from(userNames).filter((name) => !profileNames.has(name));
    }, [users, profiles]);

    const openProfileModal = (owner) => {
      const entry = profiles.find((p) => p.owner === owner);
      if (!entry) return;
      const profile = entry.profile || defaultProfile(owner);
      setProfileModal({
        owner,
        draft: {
          ...profile,
          heroStatus: profile.heroStatus || "",
          heroGreeting: profile.heroGreeting || "",
          heroMessage: profile.heroMessage || "",
        },
      });
    };

    const closeProfileModal = () => {
      setProfileModal(null);
    };

    const updateModalDraft = (patch) => {
      setProfileModal((prev) => {
        if (!prev) return prev;
        return { ...prev, draft: { ...prev.draft, ...patch } };
      });
    };

    const adjustModalFp = (delta) => {
      setProfileModal((prev) => {
        if (!prev) return prev;
        const current = Number(prev.draft.fp ?? 0) || 0;
        const next = Math.max(0, current + delta);
        return { ...prev, draft: { ...prev.draft, fp: next } };
      });
    };

    const setModalFpValue = (value) => {
      setProfileModal((prev) => {
        if (!prev) return prev;
        if (value === "") {
          return { ...prev, draft: { ...prev.draft, fp: "" } };
        }
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return prev;
        return { ...prev, draft: { ...prev.draft, fp: Math.max(0, numeric) } };
      });
    };

    const saveModalProfile = async () => {
      if (!profileModal) return;
      const { owner, draft } = profileModal;
      const normalized = {
        ...draft,
        fp: Math.max(0, Number(draft.fp) || 0),
        heroStatus: draft.heroStatus || "",
        heroGreeting: draft.heroGreeting || "",
        heroMessage: draft.heroMessage || "",
      };
      await saveProfile(owner, normalized, "Profile updated.");
      closeProfileModal();
    };

    const resetModalProfile = async () => {
      if (!profileModal) return;
      await resetProfile(profileModal.owner);
      closeProfileModal();
    };

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

    async function resetProfile(owner) {
      if (!window.confirm("Reset this profile to defaults?")) return;
      const profile = defaultProfile(owner);
      await saveProfile(owner, profile, "Profile reset.");
      refreshProfiles();
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

    const profileModalNode = !profileModal
      ? null
      : (() => {
          const { owner, draft } = profileModal;
          const stats = [
            { label: "Faith", value: draft.fp ?? 0 },
            { label: "Level", value: draft.level ?? 1 },
            {
              label: "Owned",
              value: Array.isArray(draft.owned) ? draft.owned.length : 0,
            },
            { label: "Store", value: draft.lock ? "Locked" : "Open" },
          ];
          const lastUpdated =
            draft.sheet?.updatedAt || draft.updatedAt || draft.lastUpdated || null;
          return React.createElement(
            "div",
            {
              style: {
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.7)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
                zIndex: 2000,
              },
              onClick: (event) => {
                if (event.target === event.currentTarget) {
                  closeProfileModal();
                }
              },
            },
            Card({
              className: "grid gap-4",
              style: { width: "100%", maxWidth: 640 },
              children: React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    },
                  },
                  React.createElement(
                    "div",
                    { style: { fontWeight: 600, fontSize: "1.1rem" } },
                    `Managing ${owner}`
                  ),
                  Btn({
                    type: "button",
                    className: "btn-muted",
                    onClick: closeProfileModal,
                    children: "Close",
                  })
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
                  stats.map((stat) =>
                    React.createElement(
                      "div",
                      {
                        key: stat.label,
                        className: "card",
                        style: {
                          padding: "0.65rem",
                          border: "1px solid rgba(125,211,252,0.25)",
                          background: "rgba(10,16,28,0.55)",
                        },
                      },
                      React.createElement("div", { className: "ui-label" }, stat.label),
                      React.createElement("div", { style: { fontWeight: 600 } }, stat.value)
                    )
                  )
                ),
                Field({
                  label: "Faith points",
                  hint: "Use buttons for quick adjustments or enter an exact value.",
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
                        onClick: () => adjustModalFp(Number(delta)),
                        children: delta,
                      })
                    ),
                    React.createElement("input", {
                      className: "ui-input",
                      type: "number",
                      value: draft.fp === "" ? "" : String(draft.fp ?? 0),
                      onChange: (e) => setModalFpValue(e.target.value),
                    })
                  ),
                }),
                Field({
                  label: "Store lock",
                  children: Btn({
                    type: "button",
                    className: draft.lock ? "tab-btn-active" : "",
                    onClick: () => updateModalDraft({ lock: !draft.lock }),
                    children: draft.lock ? "Locked" : "Unlocked",
                  }),
                }),
                Field({
                  label: "Patron deity",
                  hint: "Leave blank to prompt players inside the store view.",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: draft.god || "",
                    placeholder: "Tyr/Bahamut",
                    onChange: (e) => updateModalDraft({ god: e.target.value }),
                  }),
                }),
                React.createElement(
                  "div",
                  {
                    className: "grid gap-2",
                    style: {
                      border: "1px dashed rgba(125,211,252,0.35)",
                      borderRadius: 12,
                      padding: "0.85rem",
                      background: "rgba(8,12,20,0.45)",
                    },
                  },
                  React.createElement(
                    "div",
                    { className: "ui-label" },
                    "Hero banner copy"
                  ),
                  Field({
                    label: "Status line",
                    hint: "Supports {{name}}, {{god}}, {{rank}}.",
                    children: React.createElement("input", {
                      className: "ui-input",
                      value: draft.heroStatus || "",
                      placeholder: "Transference Complete",
                      onChange: (e) => updateModalDraft({ heroStatus: e.target.value }),
                    }),
                  }),
                  Field({
                    label: "Greeting",
                    hint: "Headline copy. Supports {{name}} and {{god}}.",
                    children: React.createElement("input", {
                      className: "ui-input",
                      value: draft.heroGreeting || "",
                      placeholder: "Welcome, {{name}}",
                      onChange: (e) => updateModalDraft({ heroGreeting: e.target.value }),
                    }),
                  }),
                  Field({
                    label: "Description",
                    hint: "Multi-line body. Supports {{name}}, {{god}}, {{rank}}.",
                    children: React.createElement("textarea", {
                      className: "ui-input",
                      style: { minHeight: 90, resize: "vertical" },
                      value: draft.heroMessage || "",
                      placeholder:
                        "You arrive within the Sanctum Exchange. Align with {{god}}...",
                      onChange: (e) => updateModalDraft({ heroMessage: e.target.value }),
                    }),
                  })
                ),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                  },
                  React.createElement(
                    "div",
                    { className: "ui-hint" },
                    lastUpdated
                      ? `Last sheet save ${new Date(lastUpdated).toLocaleString()}`
                      : "No sheet activity recorded yet."
                  ),
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      },
                    },
                    [
                      Btn({
                        type: "button",
                        className: "btn-muted",
                        onClick: resetModalProfile,
                        children: "Reset profile",
                      }),
                      Btn({
                        type: "button",
                        className: "btn-muted",
                        onClick: closeProfileModal,
                        children: "Cancel",
                      }),
                      Btn({
                        type: "button",
                        className: "btn-primary",
                        disabled: profileSaving,
                        onClick: saveModalProfile,
                        children: profileSaving ? "Saving..." : "Save changes",
                      }),
                    ]
                  )
                )
              ),
            })
          );
        })();

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
<<<<<<< HEAD
      "div",
      { className: "grid gap-4" },
      heroCard,
      Card({
        className: "grid gap-3",
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement("h2", { style: { fontWeight: 600 } }, "Map library"),
          MapStore
            ? React.createElement(
                React.Fragment,
                null,
                Field({
                  label: "Map name",
                  hint: "Optional. If blank, we use the name inside the JSON.",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: mapName,
                    onChange: (e) => setMapName(e.target.value),
                    placeholder: "Seraphin Basin - Night Variant",
                  }),
                }),
                Field({
                  label: "Upload map JSON",
                  hint: "Admins can add multiple maps to the library.",
                  children: React.createElement("input", {
                    className: "ui-input",
                    type: "file",
                    accept: ".json,application/json",
                    onChange: (e) =>
                      setMapFile(e.target.files ? e.target.files[0] : null),
                  }),
                }),
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                  Btn({
                    type: "button",
                    className: "btn-primary",
                    onClick: handleMapUpload,
                    disabled: mapUploading || !mapFile,
                    children: mapUploading ? "Uploading..." : "Upload map",
                  }),
                  Btn({
                    type: "button",
                    className: "btn-muted",
                    onClick: refreshMaps,
                    children: "Refresh list",
                  })
                ),
                mapError &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-sm border border-red-400/40 bg-red-500/10 text-red-100 rounded-lg p-3",
                    },
                    mapError
                  ),
                mapCards
              )
            : React.createElement(
                "div",
                { className: "ui-hint" },
                "Map library is not available in this session."
              )
        ),
      }),
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
=======
      React.Fragment,
      null,
      profileModalNode,
      React.createElement(
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
>>>>>>> c1599cd (full sheet rework)
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
      )
    );
  }

  AppNS.AdminPage = AdminPage;
})();
