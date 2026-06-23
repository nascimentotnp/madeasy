
# Onda 5 — Permissões por perfil + Sidebar lateral

A base de papéis já existe (`admin`, `vendedor`, `financeiro`, `estoquista`) com RLS no banco e a página `/users`. Esta onda aplica as permissões na interface e troca o cabeçalho com botões por uma **sidebar lateral fixa**.

## O que será feito

### 1. Sidebar lateral (navegação principal)

- Envolver o `_authenticated/route.tsx` com `SidebarProvider` + nova `AppSidebar` em `src/components/app-sidebar.tsx`.
- Itens da sidebar:
  - **Estoque** → `/` (produtos, movimentações, clientes, caixa)
  - **Vendas** → `/sales`
  - **Financeiro** → `/finance`
  - **Relatórios** → `/reports`
  - **Usuários** → `/users` (só admin)
- Cabeçalho compacto com `SidebarTrigger` (recolhe para barra de ícones), nome do usuário e botão "Sair".
- Remover os botões duplicados de navegação dos headers internos de `index.tsx`, `sales.tsx`, `finance.tsx`, `reports.tsx`.

> **Sobre quebrar o `index.tsx` (1.804 linhas)** em rotas `/products`, `/movements`, `/customers`: deixo para uma onda futura. Refatorar agora arrisca quebrar várias features ao mesmo tempo. A sidebar já entrega a sensação de "menu lateral real" sem mover código.

### 2. Permissões por perfil na UI

Hook central `useMyRoles()` em `src/hooks/use-my-roles.ts` que retorna `{ roles, can }` com flags derivadas:

| Capacidade            | admin | vendedor | financeiro | estoquista |
| --------------------- | :---: | :------: | :--------: | :--------: |
| Ver Estoque           |   ✓   |     ✓    |      ✓     |      ✓     |
| Criar/editar produto  |   ✓   |          |            |      ✓     |
| Ajuste de inventário  |   ✓   |          |            |      ✓     |
| Movimentação avulsa   |   ✓   |          |            |      ✓     |
| Criar/editar cliente  |   ✓   |     ✓    |            |            |
| Criar venda           |   ✓   |     ✓    |            |            |
| Marcar venda como paga|   ✓   |          |      ✓     |            |
| Ver Financeiro        |   ✓   |          |      ✓     |            |
| Ver Relatórios        |   ✓   |          |      ✓     |            |
| Gerenciar usuários    |   ✓   |          |            |            |

### 3. Gates aplicados

- **Sidebar**: oculta itens que o usuário não pode ver.
- **Rotas protegidas** (`/finance`, `/reports`, `/users`): se o role não permite, mostra card "Acesso restrito" em vez de carregar a página.
- **Botões/Diálogos** em `index.tsx` e `sales.tsx`: o trigger só renderiza se `can.X` for verdadeiro. O RLS no banco já bloqueia tentativas — isso é só UX.

## Detalhes técnicos

- Não mexo no `route.tsx` gate de auth (`ssr: false`, `getUser`); apenas envolvo o `<Outlet />` no provider + sidebar.
- `useMyRoles` usa React Query (já em uso pelo `myRoles` server fn), com `staleTime: 5min` para evitar refetch.
- Sidebar usa o componente `shadcn/ui` já instalado (`src/components/ui/sidebar.tsx`), `collapsible="icon"`.
- Rota ativa marcada com `useRouterState`.
- Nenhuma migração de banco — RLS já está correto desde a Onda 0.

## Resultado

- Menu lateral consistente em todas as telas, com colapso para ícones.
- Usuário vendedor não vê o link "Financeiro" nem os botões de novo produto.
- Usuário financeiro entra no caixa mas não cria vendas.
- Admin continua vendo tudo.

Responda **"ok"** para eu implementar.
