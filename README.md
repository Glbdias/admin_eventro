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
