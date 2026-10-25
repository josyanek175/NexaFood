# NexaFood

Monorepo com API Fastify/PostgreSQL, interface React/TanStack Start e contratos
compartilhados. A reorganização anterior à revisão foi preservada no snapshot
`7e1e879` e na branch `backup/review-20261025-before`.

## Desenvolvimento

```sh
npm ci
npm run build -w @nexafood/shared
npm run dev:api
npm run dev:web
```

Configure a API conforme `apps/api/.env.example` e a interface conforme
`apps/web/.env.example`. Nunca publique o `.env` real. A API usa a porta 3333 por
padrão. `VITE_API_BASE_URL` deve apontar para a API. `CORS_ORIGINS` precisa conter
a origem completa da interface, sem caminhos. Use HTTPS na hospedagem.

Migrações existentes ficam em `apps/api/drizzle`, de 0000 até 0004. O servidor
não as aplica automaticamente ao iniciar. Faça backup do banco e execute a
migração somente no ambiente escolhido:

```sh
npm run db:migrate -w @nexafood/api
```

`db:seed` é exclusivo de desenvolvimento; não execute em produção.

## Verificações

```sh
npm test
npm run build
```

A checagem estrita adicional da interface é:

```sh
npx tsc --noEmit -p apps/web/tsconfig.json
```

## Estado da operação

Cardápio, carrinho, pedidos, cozinha, mesas e configurações usam a API. Financeiro
e relatórios apresentam pedidos reais, com filtro e CSV; ainda não fazem
conciliação de recebimentos. Listagens estão limitadas aos últimos 200 pedidos.

Cupons, marketplaces, entregas com motorista, configuração de impressoras e
administração global ainda precisam de serviços reais. Essas rotas mostram
indisponibilidade em vez de executar ações de demonstração. Impressão de cupom
no pedido e KDS continua disponível pelo navegador.

O build web atual do Nitro usa Cloudflare. Não substituir uma implantação antiga
por este monorepo sem configurar separadamente web, API, banco e migrações.

Veja `docs/REVIEW-20261025.md` para a entrega validada nesta revisão.
