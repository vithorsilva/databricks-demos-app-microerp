# Feature Spec: Identidade visual DEX 2026

## Summary

Substitui o tema da [feat_0005_design_system_dex.md](feat_0005_design_system_dex.md) pelo
**design system oficial DEX (dex-design-system-2026-09)**. A feat_0005 usava uma paleta aproximada
(`#0d4a8b`, `#051a35`, `#ed1c24`), cantos arredondados, gradiente no header e ícones Lucide — tudo
fora do manual. Esta feature corrige cores, tipografia, formas e componentes de marca. Proposta
visual aprovada no canvas de Design "Micro ERP — Identidade DEX" (telas Início, Contas a Receber,
CRM e folha de componentes).

Não há modelo de dados nem API — o entregável é CSS e componentes React.

---

## Tokens (fonte: `tokens.json` do design system)

| Token DEX | Hex | Mapeado para |
|---|---|---|
| dex-azul | `#005996` | `--primary`, `--ring`, títulos, header |
| dex-vermelho | `#e61c24` | acento: barra do título, aba ativa, faixa de rodapé. Nunca texto |
| dex-marinho | `#0c1d40` | texto forte, valores |
| dex-ciano | `#89c5d3` | lasca do botão primário. Decorativo |
| dex-magenta | `#c22653` | `--destructive` (branco sobre ele 5.7:1; sobre o vermelho seria 4.4:1) |
| dex-texto-doc | `#262626` | `--foreground` |
| dex-cinza-texto | `#575756` | `--muted-foreground` |
| dex-cinza | `#d4d3d3` | `--border`, `--input` |

- **Tipografia:** Barlow (títulos, rótulos, números, botões) e Manrope (texto corrido), Google Fonts.
- **Forma:** todos os raios em 0. Botão primário com lateral direita inclinada a 14° e lasca ciano.
  Sem sombras (exceto marcadores da marca).
- **Somente tema claro:** `<html class="light">` impede que o bloco
  `@media (prefers-color-scheme: dark)` do AppKit sobrescreva os tokens.
- **Iconografia:** a marca proíbe misturar Lucide/Material. Ações viram botões de texto
  ("Dar baixa", "Excluir", "Editar"). `lucide-react` deixa de ser importado pelo app.

## Componentes de marca (`client/src/components/brand/`)

| Componente | Papel |
|---|---|
| `PageHeader` | barra vertical vermelha + título Barlow 600 em dex-azul + subtítulo; slot `actions` |
| `KpiCard` | card plano com barra superior azul (ou vermelha em `highlight`) e valor Barlow |
| `StatusBadge` | quadrado de cor + rótulo; tons `neutral`, `alert`, `brand`, `dark` |
| `TitleTab` | aba inclinada azul com lasca ciano (cabeçalho de painel) |
| `BrandBars` | marca de barras (azul, azul, vermelho) |
| `FooterStripe` | faixa de rodapé: hachura → barra longa → segmento vermelho |
| `Panel` | superfície com borda fina e título opcional |
| `ErrorBanner` / `EmptyState` | estados de erro e vazio padronizados |
| `FieldLabel` | rótulo Barlow em caixa alta para campos de formulário |

## Layout

- Header sólido dex-azul (64px), logo branca, navegação com traço vermelho na aba ativa,
  marca de barras à direita. Mobile: botão de texto "Menu" abre o Sheet.
- Área de conteúdo com grade quase invisível (≈3,5% de dex-azul) e largura máxima 1280px.
- `FooterStripe` fixo ao pé da página.

## Acceptance Criteria

- [ ] Nenhuma cor fora dos tokens acima nas telas do app (inclui gráficos do CRM e colunas do funil).
- [ ] Nenhum `rounded-*` visível; badges e cards com cantos retos.
- [ ] Nenhum import de `lucide-react` em `client/src`.
- [ ] Com o SO em modo escuro, o app continua no tema claro da marca.
- [ ] Foco visível (anel 2px dex-azul) em botões, inclusive o primário inclinado.
- [ ] `npm run typecheck` e `npm run lint` passam.
