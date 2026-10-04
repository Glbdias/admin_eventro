// Uso: node scripts/importar-eventos.mjs <arquivo.json> [--dry-run]
// Variáveis: EVENTRO_USER, EVENTRO_PASSWORD, NEXT_PUBLIC_API_URL (padrão http://localhost:8000/api)
import { readFileSync } from "node:fs";

const [file, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const limitFlag = flags.find((flag) => flag.startsWith("--limit="));
const limit = limitFlag ? Number(limitFlag.split("=")[1]) : Infinity;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const { EVENTRO_USER: username, EVENTRO_PASSWORD: password } = process.env;

if (!file || (!dryRun && (!username || !password))) {
  console.error(
    "Uso: node scripts/importar-eventos.mjs <arquivo.json> [--dry-run]\n" +
      "Defina EVENTRO_USER e EVENTRO_PASSWORD.",
  );
  process.exit(1);
}

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const events = JSON.parse(raw);

async function api(path, options = {}, token) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

// Categoria do site -> radicais aceitos no nome da categoria do Eventro (ajuste se precisar).
const MAPA_CATEGORIAS = {
  cultural: ["cultur"],
  gastronomico: ["gastronom"],
  esportivos: ["esport"],
  religioso: ["espiritual", "relig"],
  "rodeio crioulo": ["rodeio", "tradicion", "cultur"],
  "encontros tecnicos": ["encontro", "congress", "tecnic", "negoci"],
  "feirasexposicoes": ["feira", "expo", "outros"],
  "feiras/exposicoes": ["feira", "expo", "outros"],
};

function findCategory(categories, source) {
  const key = normalize(source);
  const stems = [...(MAPA_CATEGORIAS[key] ?? []), key];
  for (const stem of stems) {
    const found = categories.find(
      (c) => normalize(c.name).includes(stem) || normalize(c.slug).includes(stem),
    );
    if (found) return found;
  }
  return undefined;
}

let token = "";
let categories = [];
let existing = [];
if (!dryRun) {
  const auth = await api("/auth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  token = auth.access;
  categories = await api("/admin/categories/", {}, token);
  existing = await api("/admin/events/", {}, token);
}

const usedSlugs = new Set(existing.map((event) => event.slug));
const usedUrls = new Set(existing.map((event) => event.info_url).filter(Boolean));
let created = 0;
let skipped = 0;
let failed = 0;

for (const item of events) {
  if (created >= limit) break;
  const url = item.contato?.link_mais_informacoes ?? "";
  const title = item.nome_evento;
  const category = findCategory(categories, item.categoria);

  // Títulos repetidos geram slugs iguais; o id da URL de origem desambigua.
  const sourceId = url.match(/(\d+)\/?$/)?.[1];
  let slug = slugify(title);
  if (usedSlugs.has(slug) && sourceId) slug = `${slug}-${sourceId}`;

  if (url && usedUrls.has(url)) {
    console.log(`= já existe: ${title} (${url})`);
    skipped++;
    continue;
  }
  if (!dryRun && !category) {
    console.warn(
      `! categoria "${item.categoria}" sem correspondente (existentes: ${categories.map((c) => c.name).join(", ")}): ${title}`,
    );
    failed++;
    continue;
  }

  const fields = {
    title,
    slug,
    description: item.descricao ?? "",
    info_url: url,
    whatsapp_phone: item.contato?.whatsapp_contato ?? "",
    starts_at: item.data_inicio ?? "",
    ends_at: item.data_fim ?? "",
    category_id: category ? String(category.id) : "",
    location_name: item.local?.nome_local ?? "",
    location_postal_code: item.local?.cep ?? "",
    location_city: item.local?.cidade ?? "",
    location_state: item.local?.uf ?? "",
    location_address: item.local?.endereco ?? "",
  };

  if (dryRun) {
    console.log(`[dry-run] ${title} | ${slug} | ${fields.starts_at} | ${fields.location_city}/${fields.location_state}`);
    continue;
  }

  const payload = new FormData();
  Object.entries(fields).forEach(([key, value]) => payload.append(key, value));
  if (item.cartaz_url) {
    try {
      const image = await fetch(item.cartaz_url);
      if (image.ok) payload.append("cover_image", await image.blob(), "cartaz.jpg");
    } catch {
      console.warn(`! não foi possível baixar o cartaz de ${title}`);
    }
  }

  try {
    await api("/admin/events/create/", { method: "POST", body: payload }, token);
    usedSlugs.add(slug);
    if (url) usedUrls.add(url);
    console.log(`+ criado: ${title}`);
    created++;
  } catch (error) {
    console.error(`x falhou: ${title} -> ${error.message}`);
    failed++;
  }
}

console.log(`\nCriados: ${created} | Ignorados: ${skipped} | Falhas: ${failed}`);
