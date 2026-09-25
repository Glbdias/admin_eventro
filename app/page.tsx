"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = { id: number; name: string; slug: string };
type DashboardMetrics = {
  users: number;
  organizers: number;
  pending_organizers: number;
  events: number;
  approved_events: number;
  pending_events: number;
  views: number;
  favorites: number;
};
type DashboardOrganizer = {
  id: number;
  name: string;
  email: string;
  status: string;
  published: number;
  views: number;
  favorites: number;
};
type DashboardData = {
  metrics: DashboardMetrics;
  top_organizers: DashboardOrganizer[];
};

type AdminUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  document_type: string | null;
  document_number: string | null;
  role: string;
  review_status: string;
  review_note: string;
  date_joined: string;
};

type Event = {
  id: number;
  title: string;
  description: string;
  info_url: string;
  whatsapp_phone: string;
  starts_at: string;
  ends_at: string | null;
  is_published: boolean;
  moderation_status: string;
  moderation_note: string;
  cover_image: string;
  category?: { id: number; name: string; slug: string };
  location: { name: string; city: string };
  organizer?: AdminUser;
  created_at?: string;
  updated_at?: string;
};
type Form = {
  title: string;
  description: string;
  info_url: string;
  whatsapp_phone: string;
  starts_at: string;
  ends_at: string;
  category_id: string;
  location_name: string;
  location_postal_code: string;
  location_city: string;
  location_state: string;
  location_address: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const emptyForm: Form = {
  title: "",
  description: "",
  info_url: "",
  whatsapp_phone: "",
  starts_at: "",
  ends_at: "",
  category_id: "",
  location_name: "",
  location_postal_code: "",
  location_city: "",
  location_state: "",
  location_address: "",
};
const emptyDashboard: DashboardData = {
  metrics: {
    users: 0,
    organizers: 0,
    pending_organizers: 0,
    events: 0,
    approved_events: 0,
    pending_events: 0,
    views: 0,
    favorites: 0,
  },
  top_organizers: [],
};
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "-");

export default function AdminHome() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [view, setView] = useState("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [rankingSort, setRankingSort] = useState<"published" | "views" | "favorites">("published");
  const [modal, setModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedUserEvents, setSelectedUserEvents] = useState<Event[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "warning" | "error">("success");
  const [error, setError] = useState("");

  const fieldLabels: Record<string, string> = {
    title: "Nome do evento",
    starts_at: "Data de início",
    category_id: "Categoria",
    location_name: "Nome do local",
    location_city: "Cidade do local",
    location_address: "Endereço do local",
    location_state: "UF do local",
    location_postal_code: "CEP do local",
  };

  function formatApiError(data: Record<string, unknown>) {
    const entries = Object.entries(data || {}).filter(([key]) => key !== "detail");
    if (!entries.length) return "";
    const messages = entries.flatMap(([field, value]) => {
      const label = fieldLabels[field] || field;
      if (Array.isArray(value)) {
        return value.map((item) => `${label}: ${String(item)}`);
      }
      return `${label}: ${String(value)}`;
    });
    return messages.join(" | ");
  }

  const notify = (message: string, tone: "success" | "warning" | "error" = "success") => {
    setToastTone(tone);
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  function expireSession() {
    localStorage.removeItem("eventro_admin_token");
    setModal(false);
    setSelectedEvent(null);
    setSelectedUser(null);
    setToken("");
    setError("Sua sessão expirou. Entre novamente para continuar.");
  }
  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      expireSession();
      throw new Error("Sessão expirada.");
    }
    if (!response.ok)
      throw new Error(
        data.detail ||
          formatApiError(data) ||
          Object.values(data).flat().join(" ") ||
          "Ação não autorizada.",
      );
    return data;
  }
  async function load(activeToken = token) {
    const headers = { Authorization: `Bearer ${activeToken}` };
    const responses = await Promise.all([
      fetch(`${apiUrl}/admin/categories/`, { headers }),
      fetch(`${apiUrl}/admin/events/`, { headers }),
      fetch(`${apiUrl}/admin/dashboard/`, { headers }),
      fetch(`${apiUrl}/admin/users/`, { headers }),
    ]);
    if (responses.some((response) => response.status === 401)) {
      expireSession();
      return;
    }
    if (responses.some((response) => !response.ok))
      throw new Error("Sessão expirada.");
    setCategories(await responses[0].json());
    setEvents(await responses[1].json());
    setDashboard(await responses[2].json());
    setUsers(await responses[3].json());
  }
  useEffect(() => {
    const saved = localStorage.getItem("eventro_admin_token");
    if (saved) {
      setToken(saved);
      load(saved).catch((loadError) => setError(loadError.message));
    }
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Usuário ou senha inválidos.");
      localStorage.setItem("eventro_admin_token", data.access);
      setToken(data.access);
      await load(data.access);
      notify("Login realizado.");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Falha ao entrar.",
      );
    }
  }
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPoster(null);
    setPosterPreview("");
    setModal(true);
  }

  function openEventDetails(event: Event) {
    setSelectedEvent(event);
  }

  async function openUserDetails(user: AdminUser) {
    setSelectedUser(user);
    try {
      const userEvents = await request(`/admin/events/?organizer=${user.id}`);
      setSelectedUserEvents(userEvents);
    } catch {
      setSelectedUserEvents([]);
    }
  }

  function closeUserDetails() {
    setSelectedUser(null);
    setSelectedUserEvents([]);
  }
  function openEdit(event: Event) {
    setEditingId(event.id);
    setForm({
      ...emptyForm,
      title: event.title,
      description: event.description || "",
      info_url: event.info_url || "",
      whatsapp_phone: event.whatsapp_phone || "",
      starts_at: event.starts_at.slice(0, 16),
      ends_at: event.ends_at ? event.ends_at.slice(0, 16) : "",
      category_id: event.category?.id ? String(event.category.id) : "",
      location_name: event.location?.name || "",
      location_city: event.location?.city || "",
    });
    setPoster(null);
    setPosterPreview(event.cover_image || "");
    setModal(true);
  }
  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = new FormData();
      Object.entries({
        ...form,
        slug: slugify(form.title),
        ends_at: form.ends_at || "",
      }).forEach(([key, value]) => payload.append(key, value));
      if (poster) payload.append("cover_image", poster);
      const endpoint = editingId
        ? `${apiUrl}/admin/events/${editingId}/manage/`
        : `${apiUrl}/admin/events/create/`;
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok)
        throw new Error(
          data.detail ||
            formatApiError(data) ||
            Object.values(data).flat().join(" ") ||
            "Falha ao salvar.",
        );
      setModal(false);
      await load();
      notify(editingId ? "Evento atualizado." : "Evento publicado.");
    } catch (saveError) {
      notify(
        saveError instanceof Error
          ? saveError.message
          : "Falha ao salvar evento.",
        "warning",
      );
    }
  }
  async function deleteEvent(id: number) {
    if (!window.confirm("Excluir este evento?")) return;
    try {
      await request(`/admin/events/${id}/manage/`, { method: "DELETE" });
      await load();
      notify("Evento excluído.");
    } catch (actionError) {
      notify(
        actionError instanceof Error
          ? actionError.message
          : "Falha ao excluir.",
        "error",
      );
    }
  }

  async function moderateEvent(id: number, moderationStatus: "approved" | "rejected") {
    try {
      await request(`/admin/events/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          moderation_status: moderationStatus,
          moderation_note:
            moderationStatus === "approved"
              ? "Aprovado pela equipe administrativa."
              : "Evento recusado pela equipe administrativa.",
          is_published: moderationStatus === "approved",
        }),
      });
      await load();
      notify(moderationStatus === "approved" ? "Evento aprovado." : "Evento recusado.");
    } catch (actionError) {
      notify(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível moderar o evento.",
        "error",
      );
    }
  }

  async function moderateUser(id: number, reviewStatus: "approved" | "rejected") {
    try {
      await request(`/admin/users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          review_status: reviewStatus,
          review_note:
            reviewStatus === "approved"
              ? "Perfil aprovado pela equipe administrativa."
              : "Perfil recusado. Revise seus dados e tente novamente.",
        }),
      });
      await load();
      if (selectedUser?.id === id) {
        const updated = await request(`/admin/users/${id}/`);
        setSelectedUser(updated);
      }
      notify(reviewStatus === "approved" ? "Perfil aprovado." : "Perfil recusado.");
    } catch (actionError) {
      notify(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível moderar o usuário.",
        "error",
      );
    }
  }

  function update(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function logout() {
    localStorage.removeItem("eventro_admin_token");
    setToken("");
  }

  const rankingItems = [...dashboard.top_organizers].sort((a, b) => {
    if (rankingSort === "views") return b.views - a.views;
    if (rankingSort === "favorites") return b.favorites - a.favorites;
    return b.published - a.published;
  });

  function reviewStatusLabel(status: string) {
    if (status === "approved") return "APROVADO";
    if (status === "rejected") return "RECUSADO";
    return "PENDENTE";
  }

  function reviewStatusClass(status: string) {
    if (status === "approved") return "status status-approved";
    if (status === "rejected") return "status status-rejected";
    return "status status-pending";
  }

  function eventStatusLabel(event: Event) {
    if (event.moderation_status === "approved" && event.is_published) return "Publicado";
    if (event.moderation_status === "approved") return "Aprovado";
    if (event.moderation_status === "rejected") return "Recusado";
    return "Em análise";
  }

  const filteredUsers = users.filter((user) => {
    const searchable = [
      user.first_name,
      user.last_name,
      user.username,
      user.email,
      user.document_number || "",
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(userSearch.toLowerCase());
  });

  if (!token)
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand">EVENTRO ADMIN</div>
          <h1>Organize o que vai ao ar.</h1>
          <form className="form" onSubmit={login}>
            <label>
              Usuário
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="primary">Entrar no painel</button>
            {error && <p className="error">{error}</p>}
          </form>
        </section>
      </main>
    );

  return (
    <div className="admin-layout">
      {toast && (
        <div className={`toast ${toastTone === "success" ? "toast-success" : toastTone === "warning" ? "toast-warning" : "toast-error"}`}>
          <span>{toastTone === "success" ? "✓" : "!"}</span>
          <span>{toast}</span>
        </div>
      )}
      <aside className="admin-sidebar">
        <span className="brand">EVENTRO ADMIN</span>
        <nav>
          <button
            className={`sidebar-link ${view === "dashboard" ? "is-active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            ▦ Visão geral
          </button>
          <button
            className={`sidebar-link ${view === "events" ? "is-active" : ""}`}
            onClick={() => setView("events")}
          >
            ▤ Eventos
          </button>
          <button
            className={`sidebar-link ${view === "categories" ? "is-active" : ""}`}
            onClick={() => setView("categories")}
          >
            ◉ Categorias
          </button>
          <button
            className={`sidebar-link ${view === "users" ? "is-active" : ""}`}
            onClick={() => setView("users")}
          >
            ◎ Usuários
          </button>
        </nav>
        <button className="sidebar-logout" onClick={logout}>
          Sair da conta
        </button>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div>
            <span className="eyebrow">Central de revisão</span>
            <h1>
              {view === "events"
                ? "Gerenciar eventos"
                : view === "categories"
                  ? "Catálogo de categorias"
                  : view === "users"
                    ? "Usuários cadastrados"
                  : "Dashboard"}
            </h1>
          </div>
          {view === "dashboard" && (
            <div className="profile-pill">G</div>
          )}
          {view === "events" && (
            <button className="create-button" onClick={openCreate}>
              ＋ Criar evento
            </button>
          )}
        </header>
        {view === "events" ? (
          <section className="category-table-panel">
            <div className="category-table events-table">
              <div className="category-table-head events-table-head">
                <span>Evento</span>
                <span>Organizador</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              {events.map((event) => (
                <div className="category-table-row events-table-row" key={event.id}>
                  <strong>{event.title}</strong>
                  <span>{event.organizer?.first_name || event.organizer?.username || "-"}</span>
                  <span>
                    {eventStatusLabel(event)}
                  </span>
                  <div>
                    <button onClick={() => openEventDetails(event)}>Consultar</button>
                    {event.moderation_status === "pending" && (
                      <>
                        <button onClick={() => moderateEvent(event.id, "approved")}>Aprovar</button>
                        <button onClick={() => moderateEvent(event.id, "rejected")}>Recusar</button>
                      </>
                    )}
                    <button onClick={() => openEdit(event)}>Editar</button>
                    <button
                      className="danger-text"
                      onClick={() => deleteEvent(event.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : view === "users" ? (
          <section className="category-table-panel">
            <div className="section-bar">
              <div>
                <h2>Usuários da plataforma</h2>
                <p>{filteredUsers.length} usuário(s) encontrado(s)</p>
              </div>
              <input
                className="search-input"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Buscar por nome, email ou documento"
              />
            </div>
            <div className="category-table users-table">
              <div className="category-table-head users-table-head">
                <span>Nome</span>
                <span>Email</span>
                <span>Papel</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              {filteredUsers.map((user) => (
                <div className="category-table-row users-table-row" key={user.id}>
                  <strong>{user.first_name || user.username}</strong>
                  <span>{user.email}</span>
                  <span>{user.role === "organizer" ? "Divulgador" : "Visitante"}</span>
                  <span className={reviewStatusClass(user.review_status)}>
                    {reviewStatusLabel(user.review_status)}
                  </span>
                  <div>
                    <button onClick={() => openUserDetails(user)}>Consultar</button>
                    <button onClick={() => moderateUser(user.id, "approved")}>Aprovar</button>
                    <button onClick={() => moderateUser(user.id, "rejected")}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : view === "categories" ? (
          <section className="category-table-panel">
            <div className="section-bar">
              <h2>Categorias disponíveis</h2>
              <p>{categories.length} categoria(s) cadastrada(s)</p>
            </div>
            <div className="category-table">
              <div className="category-table-head categories-table-head">
                <span>Nome</span>
                <span>Slug</span>
              </div>
              {categories.map((category) => (
                <div className="category-table-row categories-table-row" key={category.id}>
                  <strong>{category.name}</strong>
                  <span>{category.slug}</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="dashboard-metrics">
              <div className="metric-card">
                <span>Usuários</span>
                <strong>{dashboard.metrics.users}</strong>
              </div>
              <div className="metric-card">
                <span>Divulgadores</span>
                <strong>{dashboard.metrics.organizers}</strong>
              </div>
              <div className="metric-card">
                <span>Org. pendentes</span>
                <strong>{dashboard.metrics.pending_organizers}</strong>
              </div>
              <div className="metric-card">
                <span>Eventos</span>
                <strong>{dashboard.metrics.events}</strong>
              </div>
              <div className="metric-card">
                <span>Aprovados</span>
                <strong>{dashboard.metrics.approved_events}</strong>
              </div>
              <div className="metric-card">
                <span>Pendentes</span>
                <strong>{dashboard.metrics.pending_events}</strong>
              </div>
              <div className="metric-card">
                <span>Views</span>
                <strong>{dashboard.metrics.views}</strong>
              </div>
              <div className="metric-card">
                <span>Favoritos</span>
                <strong>{dashboard.metrics.favorites}</strong>
              </div>
            </section>

            <section className="ranking-panel">
              <div className="ranking-head">
                <div>
                  <h2>Eventos publicados por divulgador</h2>
                  <p>{rankingItems.length} divulgador(es) com eventos aprovados</p>
                </div>
                <label className="ranking-sort">
                  <span>Ordenar</span>
                  <select
                    value={rankingSort}
                    onChange={(event) =>
                      setRankingSort(
                        event.target.value as "published" | "views" | "favorites",
                      )
                    }
                  >
                    <option value="published">Mais eventos publicados</option>
                    <option value="views">Mais views</option>
                    <option value="favorites">Mais favoritos</option>
                  </select>
                </label>
              </div>

              <div className="ranking-table">
                <div className="ranking-table-head">
                  <span>Divulgador</span>
                  <span>Status</span>
                  <span>Publicados</span>
                  <span>Views</span>
                  <span>Favoritos</span>
                </div>
                {rankingItems.map((organizer) => (
                  <div className="ranking-table-row" key={organizer.id}>
                    <div>
                      <strong>{organizer.name}</strong>
                      <span>{organizer.email}</span>
                    </div>
                    <span className={reviewStatusClass(organizer.status)}>
                      {reviewStatusLabel(organizer.status)}
                    </span>
                    <strong>{organizer.published}</strong>
                    <span>{organizer.views}</span>
                    <span>{organizer.favorites}</span>
                  </div>
                ))}
                {rankingItems.length === 0 && (
                  <div className="ranking-empty">
                    Nenhum divulgador com eventos aprovados no momento.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      {modal && (
        <div className="modal-backdrop">
          <section className="event-modal large-modal">
            <div className="modal-header">
              <h2>{editingId ? "Editar evento" : "Criar evento"}</h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setModal(false)}>×</button>
            </div>
            <form className="form create-form" onSubmit={saveEvent}>
              <div className="event-form-body">
              <label>
                Nome
                <input
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  required
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Opcional"
                />
              </label>
              <div className="form-grid">
                <label>
                  Começa em
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(event) =>
                      update("starts_at", event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  Termina em
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(event) => update("ends_at", event.target.value)}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Categoria
                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      update("category_id", event.target.value)
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="file-field">
                  Cartaz
                  <input
                    id="poster-upload"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setPoster(file);
                      setPosterPreview(
                        file ? URL.createObjectURL(file) : posterPreview,
                      );
                    }}
                  />
                  <span>{poster?.name || "Escolher imagem do cartaz"}</span>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Nome do local
                  <input
                    value={form.location_name}
                    onChange={(event) => update("location_name", event.target.value)}
                    required={!editingId}
                    placeholder="Ex.: Centro de Eventos"
                  />
                </label>
                <label>
                  Cidade
                  <input
                    value={form.location_city}
                    onChange={(event) => update("location_city", event.target.value)}
                    required={!editingId}
                    placeholder="Ex.: Caxias do Sul"
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Endereço
                  <input
                    value={form.location_address}
                    onChange={(event) => update("location_address", event.target.value)}
                    placeholder="Ex.: Rua Exemplo, 123"
                  />
                </label>
                <label>
                  UF
                  <select
                    value={form.location_state}
                    onChange={(event) => update("location_state", event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                CEP (opcional)
                <input
                  value={form.location_postal_code}
                  onChange={(event) => update("location_postal_code", event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Somente números"
                  inputMode="numeric"
                />
              </label>
              <div className="form-grid">
                <label>
                  Link para mais informações (opcional)
                  <input
                    type="url"
                    value={form.info_url}
                    onChange={(event) => update("info_url", event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <label>
                  WhatsApp para informações (opcional)
                  <input
                    type="tel"
                    value={form.whatsapp_phone}
                    onChange={(event) =>
                      update("whatsapp_phone", event.target.value)
                    }
                    placeholder="(54) 99999-9999"
                  />
                </label>
              </div>
              {posterPreview && (
                <label className="poster-preview" htmlFor="poster-upload">
                  <img src={posterPreview} alt="Preview do cartaz" />
                </label>
              )}
              </div>
              <footer className="modal-footer">
                <button type="button" className="secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button className="primary">{editingId ? "Salvar alterações" : "Publicar evento"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {selectedEvent && (
        <div className="modal-backdrop">
          <section className="event-modal small-modal">
            <div className="modal-header">
              <h2>Consulta de evento</h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="event-details">
              <p><strong>Título:</strong> {selectedEvent.title}</p>
              <p><strong>Descrição:</strong> {selectedEvent.description || "Sem descrição"}</p>
              <p><strong>Organizador:</strong> {selectedEvent.organizer?.first_name || selectedEvent.organizer?.username || "-"}</p>
              <p><strong>Email:</strong> {selectedEvent.organizer?.email || "-"}</p>
              <p><strong>Categoria:</strong> {selectedEvent.category?.name || "-"}</p>
              <p><strong>Local:</strong> {selectedEvent.location?.name} - {selectedEvent.location?.city}</p>
              <p><strong>Status:</strong> {eventStatusLabel(selectedEvent)}</p>
              <p><strong>Nota da moderação:</strong> {selectedEvent.moderation_note || "Sem observações"}</p>
              {selectedEvent.info_url && (
                <p><strong>Link:</strong> <a href={selectedEvent.info_url} target="_blank" rel="noreferrer">Abrir informações</a></p>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedUser && (
        <div className="modal-backdrop">
          <section className="event-modal small-modal">
            <div className="modal-header">
              <h2>Dados do usuário</h2>
              <button type="button" aria-label="Fechar modal" onClick={closeUserDetails}>×</button>
            </div>
            <div className="event-details">
              <p><strong>Nome:</strong> {selectedUser.first_name || selectedUser.username}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Papel:</strong> {selectedUser.role === "organizer" ? "Divulgador" : "Visitante"}</p>
              <p><strong>Status:</strong> {reviewStatusLabel(selectedUser.review_status)}</p>
              <p><strong>Documento:</strong> {selectedUser.document_type?.toUpperCase() || "-"} {selectedUser.document_number || ""}</p>
              <p><strong>Observação:</strong> {selectedUser.review_note || "Sem observações"}</p>
              <div className="review-actions">
                <button className="approve" onClick={() => moderateUser(selectedUser.id, "approved")}>Aprovar perfil</button>
                <button className="reject" onClick={() => moderateUser(selectedUser.id, "rejected")}>Recusar perfil</button>
              </div>
              <h3>Eventos cadastrados</h3>
              {selectedUserEvents.length === 0 ? (
                <p className="empty">Este usuário ainda não cadastrou eventos.</p>
              ) : (
                selectedUserEvents.map((event) => (
                  <article className="submission-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <small>{eventStatusLabel(event)}</small>
                    </div>
                    {event.moderation_status === "pending" && (
                      <div className="review-actions">
                        <button className="approve" onClick={() => moderateEvent(event.id, "approved")}>Aprovar</button>
                        <button className="reject" onClick={() => moderateEvent(event.id, "rejected")}>Recusar</button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
