"use client";

import { FormEvent, useEffect, useState } from "react";

type Category = { id: number; name: string; slug: string };
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
  cover_image: string;
  category?: { id: number };
  location: { name: string; city: string };
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
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  function expireSession() {
    localStorage.removeItem("eventro_admin_token");
    setModal(false);
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
    ]);
    if (responses.some((response) => response.status === 401)) {
      expireSession();
      return;
    }
    if (responses.some((response) => !response.ok))
      throw new Error("Sessão expirada.");
    setCategories(await responses[0].json());
    setEvents(await responses[1].json());
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
      );
    }
  }
  function update(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function logout() {
    localStorage.clear();
    setToken("");
  }

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
        <div className="toast toast-success">
          ✓ <span>{toast}</span>
        </div>
      )}
      <aside className="admin-sidebar">
        <span className="brand">EVENTRO ADMIN</span>
        <nav>
          <button className="sidebar-link" onClick={() => setView("dashboard")}>
            ▦ Visão geral
          </button>
          <button className="sidebar-link" onClick={() => setView("events")}>
            ▤ Eventos
          </button>
          <button
            className="sidebar-link"
            onClick={() => setView("categories")}
          >
            ◉ Categorias
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
                  ? "Categorias"
                  : "Painel de operação"}
            </h1>
          </div>
          {view === "events" && (
            <button className="create-button" onClick={openCreate}>
              ＋ Criar evento
            </button>
          )}
        </header>
        {view === "events" ? (
          <section className="category-table-panel">
            <div className="category-table">
              <div className="category-table-head">
                <span>Evento</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              {events.map((event) => (
                <div className="category-table-row" key={event.id}>
                  <strong>{event.title}</strong>
                  <span>
                    {event.is_published ? "Publicado" : event.moderation_status}
                  </span>
                  <div>
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
        ) : view === "categories" ? (
          <section className="category-table-panel">
            <div className="section-bar">
              <h2>Catálogo de categorias</h2>
              <button className="create-button">＋ Nova categoria</button>
            </div>
            <div className="category-table">
              {categories.map((category) => (
                <div className="category-table-row" key={category.id}>
                  <strong>{category.name}</strong>
                  <span>{category.slug}</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="metrics">
            <div className="metric">
              <span>Eventos</span>
              <strong>{events.length}</strong>
            </div>
            <div className="metric">
              <span>Categorias</span>
              <strong>{categories.length}</strong>
            </div>
          </div>
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
    </div>
  );
}
