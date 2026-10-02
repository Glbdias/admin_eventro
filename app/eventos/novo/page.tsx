"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string; slug: string };
type EventDetails = {
  title: string;
  description: string;
  info_url: string;
  whatsapp_phone: string;
  starts_at: string;
  ends_at: string | null;
  cover_image: string;
  category?: { id: number };
  location: { name: string; postal_code: string; address: string; city: string; state: string };
};
type EventForm = {
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
const steps = ["Informações básicas", "Local & data", "Cartaz", "Links & contato"];
const states = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
const emptyForm: EventForm = {
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function NewEventPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [token, setToken] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem("eventro_admin_token");
    if (!savedToken) {
      router.replace("/");
      return;
    }

    const requestedEventId = new URLSearchParams(window.location.search).get("edit");
    setEventId(requestedEventId);
    setToken(savedToken);

    async function loadFormData() {
      const headers = { Authorization: `Bearer ${savedToken}` };
      const [categoryResponse, eventResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/categories/`, { headers }),
        requestedEventId
          ? fetch(`${apiUrl}/admin/events/${requestedEventId}/manage/`, { headers })
          : Promise.resolve(null),
      ]);
      if (categoryResponse.status === 401 || eventResponse?.status === 401) {
          window.localStorage.removeItem("eventro_admin_token");
          router.replace("/");
          return;
      }
      if (!categoryResponse.ok) throw new Error("Não foi possível carregar as categorias.");
      setCategories(await categoryResponse.json());

      if (eventResponse) {
        if (!eventResponse.ok) throw new Error("Não foi possível carregar o evento para edição.");
        const event: EventDetails = await eventResponse.json();
        setForm({
          title: event.title,
          description: event.description || "",
          info_url: event.info_url || "",
          whatsapp_phone: event.whatsapp_phone || "",
          starts_at: toDateTimeLocal(event.starts_at),
          ends_at: toDateTimeLocal(event.ends_at),
          category_id: event.category?.id ? String(event.category.id) : "",
          location_name: event.location?.name || "",
          location_postal_code: event.location?.postal_code || "",
          location_city: event.location?.city || "",
          location_state: event.location?.state || "",
          location_address: event.location?.address || "",
        });
        setPosterPreview(event.cover_image || "");
      }
    }

    loadFormData().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar dados.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!poster) return;
    const previewUrl = URL.createObjectURL(poster);
    setPosterPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [poster]);

  function update(field: keyof EventForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function advanceStep() {
    if (!formRef.current?.reportValidity()) return;
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const payload = new FormData();
    Object.entries({
      ...form,
      slug: slugify(form.title),
      ends_at: form.ends_at,
    }).forEach(([key, value]) => payload.append(key, value));
    if (poster) payload.append("cover_image", poster);

    try {
      const response = await fetch(
        eventId
          ? `${apiUrl}/admin/events/${eventId}/manage/`
          : `${apiUrl}/admin/events/create/`,
        {
        method: eventId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
        },
      );
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.localStorage.removeItem("eventro_admin_token");
        router.replace("/");
        return;
      }
      if (!response.ok) {
        const message = result.detail || Object.values(result).flat().join(" ") || "Não foi possível salvar o evento.";
        throw new Error(message);
      }
      router.replace("/");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="event-editor-loading">Carregando formulário...</main>;
  if (!token) return null;

  return (
    <main className="event-creation-page">
      <header className="event-creation-header">
        <button type="button" className="event-back-button" onClick={() => router.back()}>
          <span aria-hidden="true">←</span> Voltar
        </button>
        <div className="event-creation-heading">
          <div>
            <span className="event-editor-eyebrow">EVENTRO ADMIN · EVENTOS</span>
            <h1>{eventId ? "Editar evento" : "Criar evento"}</h1>
          </div>
          <span className="event-step-count">ETAPA {activeStep + 1} DE {steps.length}</span>
        </div>
      </header>

      <nav className="event-stepper" aria-label="Etapas do evento">
        {steps.map((step, index) => (
          <div className={`event-step ${index === activeStep ? "is-active" : ""} ${index < activeStep ? "is-complete" : ""}`} key={step}>
            <span className="event-step-number">{index < activeStep ? "✓" : index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </nav>

      <form ref={formRef} id="event-creation-form" onSubmit={submit}>
        <div className="event-creation-content">
          <section className="event-creation-panel">
            <div className="event-panel-heading">
              <div>
                <span className="event-panel-kicker">CARTÃO {activeStep + 1}</span>
                <h2>{steps[activeStep]}</h2>
              </div>
              <span className="event-panel-index">0{activeStep + 1}</span>
            </div>

            {activeStep === 0 && (
              <div className="event-fields">
                <label className="event-field event-field-wide">
                  <span>Nome do evento</span>
                  <input value={form.title} onChange={(event) => update("title", event.target.value)} maxLength={180} required placeholder="Ex.: Festival de Inverno" />
                </label>
                <label className="event-field event-field-wide">
                  <span>Descrição</span>
                  <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} placeholder="Apresente a programação e os detalhes do evento" />
                </label>
                <label className="event-field">
                  <span>Categoria</span>
                  <select value={form.category_id} onChange={(event) => update("category_id", event.target.value)} required>
                    <option value="">Selecione uma categoria</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="event-field">
                  <span>Começa em</span>
                  <input type="datetime-local" value={form.starts_at} onChange={(event) => update("starts_at", event.target.value)} required />
                </label>
                <label className="event-field">
                  <span>Termina em</span>
                  <input type="datetime-local" value={form.ends_at} onChange={(event) => update("ends_at", event.target.value)} />
                </label>
              </div>
            )}

            {activeStep === 1 && (
              <div className="event-fields">
                <label className="event-field event-field-wide">
                  <span>Nome do local</span>
                  <input value={form.location_name} onChange={(event) => update("location_name", event.target.value)} maxLength={160} required placeholder="Ex.: Centro de eventos" />
                </label>
                <label className="event-field">
                  <span>Cidade</span>
                  <input value={form.location_city} onChange={(event) => update("location_city", event.target.value)} maxLength={100} required placeholder="Ex.: Porto Alegre" />
                </label>
                <label className="event-field">
                  <span>UF</span>
                  <select value={form.location_state} onChange={(event) => update("location_state", event.target.value)}>
                    <option value="">Selecione</option>
                    {states.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </label>
                <label className="event-field event-field-wide">
                  <span>Endereço</span>
                  <input value={form.location_address} onChange={(event) => update("location_address", event.target.value)} maxLength={240} placeholder="Rua, número e complemento" />
                </label>
                <label className="event-field">
                  <span>CEP</span>
                  <input inputMode="numeric" value={form.location_postal_code} onChange={(event) => update("location_postal_code", event.target.value.replace(/\D/g, "").slice(0, 8))} maxLength={8} placeholder="Somente números" />
                </label>
              </div>
            )}

            {activeStep === 2 && (
              <div className="event-poster-step">
                <label className="event-upload-zone" htmlFor="event-poster-upload">
                  <input id="event-poster-upload" type="file" accept="image/*" onChange={(event) => setPoster(event.target.files?.[0] || null)} />
                  <span className="event-upload-icon" aria-hidden="true">↑</span>
                  <strong>{poster?.name || "Adicionar cartaz"}</strong>
                  <span>Selecione uma imagem para a divulgação do evento</span>
                </label>
                {posterPreview && <img className="event-poster-preview" src={posterPreview} alt="Pré-visualização do cartaz" />}
              </div>
            )}

            {activeStep === 3 && (
              <div className="event-fields">
                <label className="event-field event-field-wide">
                  <span>Link para mais informações</span>
                  <input type="url" value={form.info_url} onChange={(event) => update("info_url", event.target.value)} placeholder="https://www.exemplo.com.br" />
                </label>
                <label className="event-field">
                  <span>WhatsApp para contato</span>
                  <input type="tel" value={form.whatsapp_phone} onChange={(event) => update("whatsapp_phone", event.target.value)} placeholder="(11) 99999-9999" />
                </label>
              </div>
            )}
          </section>

          <aside className="event-creation-preview">
            <span className="event-panel-kicker">PRÉ-VISUALIZAÇÃO</span>
            <div className="event-preview-poster">
              {posterPreview ? <img src={posterPreview} alt="Cartaz do evento" /> : <span>Cartaz do evento</span>}
            </div>
            <div className="event-preview-copy">
              <span>{categories.find((category) => String(category.id) === form.category_id)?.name || "Categoria"}</span>
              <h3>{form.title || "Nome do evento"}</h3>
              <p>{[form.location_name, form.location_city].filter(Boolean).join(" · ") || "Local do evento"}</p>
              <p>{form.starts_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(form.starts_at)) : "Data e horário"}</p>
            </div>
          </aside>
        </div>

        {error && <p className="event-creation-error" role="alert">{error}</p>}

        <footer className="event-creation-footer">
          <button type="button" className="event-creation-cancel" onClick={() => router.back()}>Cancelar</button>
          <div>
            {activeStep > 0 && <button type="button" className="event-creation-previous" onClick={() => setActiveStep((current) => current - 1)}>Anterior</button>}
            {activeStep < steps.length - 1 ? (
              <button type="button" className="event-creation-next" onClick={(event) => { event.preventDefault(); advanceStep(); }}>Continuar <span aria-hidden="true">→</span></button>
            ) : (
              <button type="submit" className="event-creation-next" disabled={saving}>{saving ? "Salvando..." : eventId ? "Salvar alterações" : "Publicar evento"}</button>
            )}
          </div>
        </footer>
      </form>
    </main>
  );
}
