# Eventro Admin

Painel separado para moderar perfis e eventos da plataforma Eventro.

## Configuracao

```bash
copy .env.example .env.local
npm install
npm run dev -- --port 3001
```

Abra http://localhost:3001. Use o usuario criado pelo comando `make createsuperuser` no repositorio `eventro`.

O painel consome a API Django e so permite moderacao para usuarios com `is_staff` ou `is_superuser`.

## Operacao

- A tela ocupa toda a area disponivel e organiza metricas, perfis pendentes e eventos pendentes.
- Staff e superusuarios podem usar `Criar evento` para publicar eventos diretamente pela area administrativa.
- Eventos criados pelo admin entram aprovados e publicados; eventos enviados pelo publico continuam passando pela fila normal.
- A criacao aceita inicio, fim, categoria, local, descricao e imagem de capa.

## Importacao automatica de eventos (turismo.rs.gov.br)

Dois scripts em `scripts/`: um extrai os eventos do site e outro cadastra na API do Eventro.

### 1. Extrair eventos do site

```powershell
pip install requests beautifulsoup4
python scripts\extrair_eventos.py eventos_eventro.json
```

- Le a listagem em `https://www.turismo.rs.gov.br/turismo/evento/listar/` (as 7 paginas vem no mesmo HTML) e abre a pagina de cada evento.
- Gera um JSON com titulo, categoria (tipo do site), descricao (campo **Programacao**), datas, cidade/UF, local, endereco e link de origem.
- Demora cerca de 1 minuto (pausa de 1s entre paginas, com novas tentativas se o site derrubar a conexao).
- O site so informa a data: o inicio fica 09:00 e o fim 22:00 (horario de Brasilia). CEP, WhatsApp e cartaz ficam vazios quando nao existem.

### 2. Cadastrar na API

```powershell
$env:EVENTRO_USER="usuario"; $env:EVENTRO_PASSWORD="senha"
$env:NEXT_PUBLIC_API_URL="https://sua-api/api"   # padrao: http://localhost:8000/api

node scripts\importar-eventos.mjs eventos_eventro.json --dry-run   # so mostra, nao envia
node scripts\importar-eventos.mjs eventos_eventro.json --limit=1   # cadastra apenas 1 (teste)
node scripts\importar-eventos.mjs eventos_eventro.json             # cadastra todos
```

- O usuario precisa ser `is_staff`. Nao grave a senha em arquivos.
- Eventos ja cadastrados sao ignorados (comparacao pelo `info_url`), entao e seguro rodar de novo para **atualizar a lista com eventos novos**.
- Para recadastrar um evento, exclua-o antes no admin.
- A categoria do site e ligada a uma categoria existente no Eventro por radical do nome (Cultural -> Cultura, Gastronomico -> Gastronomia, Esportivos -> Esportes, Religioso -> Espiritualidade, Feiras/Exposicoes -> Outros etc.). A tabela fica em `MAPA_CATEGORIAS` no inicio de `importar-eventos.mjs`. Sem correspondencia, o evento e pulado e as categorias existentes sao listadas.
- Os horarios sao enviados com fuso `-03:00` e gravados corretamente. O banco guarda em UTC; a exibicao precisa usar `America/Sao_Paulo`.

### Fluxo para atualizar eventos

```powershell
python scripts\extrair_eventos.py eventos_eventro.json
node scripts\importar-eventos.mjs eventos_eventro.json --dry-run
node scripts\importar-eventos.mjs eventos_eventro.json
```

### API local para testes

No repositorio `eventro`: `make dev-back` (ou `backend\venv\Scripts\python.exe manage.py runserver 8000` dentro de `backend`).
- Limites da API: nome do local 400 e endereco 240 caracteres. Se o nome do local passar disso, o importador usa a cidade como local e move o texto original para o fim da descricao.
A home mostra os 20 primeiros eventos (constante `INITIAL_VISIBLE` em `frontend/app/components/EventSearchResults.tsx`) e o botao **Ver tudo (N eventos)** leva para `/eventos`, mantendo a categoria e a busca escolhidas.

A pagina `/eventos` (`frontend/app/eventos/page.tsx` + `components/AllEvents.tsx`) tem busca, filtro por categoria e paginacao de 20 por pagina. O estado fica na URL: `?q=`, `?categoria=` e `?pagina=`.
- Limites da API: nome do local 400 e endereco 240 caracteres. Se o nome do local passar disso, o importador usa a cidade como local e move o texto original para o fim da descricao.
