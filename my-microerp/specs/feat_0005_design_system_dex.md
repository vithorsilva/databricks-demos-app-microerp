# Feature Spec: Design System DEX

## Summary

Aplica a **identidade visual DEX (tema claro)** sobre o AppKit/shadcn do Micro ERP: mapeia os
tokens shadcn para a paleta da marca em [client/src/index.css](../client/src/index.css), adiciona
um pequeno conjunto de **componentes de marca** (`Redline`, `ColorBars`, `PageHeader`, `KpiCard`)
em `client/src/components/brand/`, e ajusta o layout em [client/src/App.tsx](../client/src/App.tsx)
(header com gradiente, logo colorida sobre branco, nav com estado ativo azul, `ColorBars` no rodapé).
Esta é a **primeira feature a implementar** (antes do CRM): assim toda página nova já nasce com a
marca. Diferente das demais specs, não há modelo de dados nem API — o entregável é puramente visual/CSS
e de componentes React.

---

## Data Model

Não se aplica — esta feature não cria tabelas, schemas Zod nem endpoints. O "modelo" aqui são os
**tokens de design** (CSS custom properties) e os **componentes de marca**.

### Paleta DEX (referência)

| Nome | Hex | Uso |
|------|-----|-----|
| dex-blue | `#0d4a8b` | Estrutural / interativo (primário) |
| dex-blue-dark | `#051a35` | Texto principal (foreground) |
| dex-red | `#ed1c24` | **Apenas acento / CTA** |
| dex-red-deep | `#c0141b` | Hover de CTA vermelho |
| bg-subtle | `#f4f5f8` | Sidebar / header / seções (muted) |
| fg-tertiary | `#6b7080` | Texto secundário (muted-foreground) |
| border | `#e8eaf0` | Bordas e inputs |
| success | `#1d8a3e` | Status pago / positivo |
| canvas | `#ffffff` | Fundo predominante |

---

## Token Mapping (`client/src/index.css`)

Hoje os tokens shadcn estão **comentados** dentro de `:root` (caem no default do AppKit) e existe um
bloco `@media (prefers-color-scheme: dark)` também comentado. Ações:

1. **Descomentar e sobrescrever `:root`** com os valores DEX abaixo.
2. **Remover/neutralizar** o bloco `@media (prefers-color-scheme: dark)` — a marca define **somente
   tema claro**. Não manter variantes escuras.
3. Adicionar **custom properties de marca** próprias (prefixo `--dex-*`) para usos pontuais que não têm
   token shadcn equivalente.

### Mapa de tokens shadcn → DEX

| Token shadcn | Valor DEX |
|---|---|
| `--primary` | `#0d4a8b` (dex-blue) |
| `--primary-foreground` | `#ffffff` |
| `--background` | `#ffffff` (canvas) |
| `--foreground` | `#051a35` (dex-blue-dark) |
| `--card` / `--card-foreground` | `#ffffff` / `#051a35` |
| `--popover` / `--popover-foreground` | `#ffffff` / `#051a35` |
| `--secondary` / `--secondary-foreground` | `#f4f5f8` / `#0d4a8b` |
| `--muted` | `#f4f5f8` (bg-subtle) |
| `--muted-foreground` | `#6b7080` (fg-tertiary) |
| `--accent` | `#ed1c24` (dex-red) — só acento |
| `--accent-foreground` | `#ffffff` |
| `--destructive` | `#ed1c24` (dex-red) |
| `--destructive-foreground` | `#ffffff` |
| `--success` / `--success-foreground` | `#1d8a3e` / `#ffffff` |
| `--warning` / `--warning-foreground` | conforme paleta (amarelo âmbar) / `#051a35` |
| `--border` / `--input` | `#e8eaf0` |
| `--ring` | `rgba(13,74,139,0.15)` (foco azul) |
| `--radius` | `6px` (cards 6–8px) |

> Os valores acima podem ser escritos como hex literal ou convertidos para `oklch` (formato atual do
> arquivo) — o importante é o resultado visual. Manter coerência com o formato escolhido.

### Custom properties de marca (adicionais)

```css
--dex-blue: #0d4a8b;
--dex-blue-dark: #051a35;
--dex-red: #ed1c24;
--dex-red-deep: #c0141b;
--grad-header: linear-gradient(90deg, #0d4a8b 0%, #051a35 100%);
--grad-blue: linear-gradient(135deg, #0d4a8b 0%, #1565b8 100%);
--shadow-card: 0 1px 3px rgba(5,26,53,0.08), 0 1px 2px rgba(5,26,53,0.04);
--shadow-modal: 0 10px 40px rgba(5,26,53,0.18);
```

---

## Frontend Behavior

### Componentes de marca — `client/src/components/brand/`

| Componente | Descrição | Regras |
|-----------|-----------|--------|
| `Redline` | Barra horizontal 56×4px, raio 2px, cor `--dex-red` | **Sempre antes** de título de página / section-tag |
| `ColorBars` | Assinatura de rodapé: faixas vermelho · azul · branco · azul · vermelho | Usada no rodapé do layout |
| `PageHeader` | Título de página com a **1ª palavra em `--dex-red`** (foco) + `Redline` acima + subtítulo opcional | Cabeçalho padrão de toda página de módulo |
| `KpiCard` | Card branco, borda `--border`, raio 6–8px | Hover: sobe 3px (`translateY(-3px)`) + `--shadow-card` + borda `--dex-red`; usado nos KPIs de AR/AP |

### Aplicação no layout (`client/src/App.tsx`)

- **Header**: faixa com `--grad-header`; **logo COLORIDA DEX** sobre fundo branco/claro do header.
- **Nav**: estado ativo em azul (`--primary`), conforme `navLinkClass` já existente (mantém o padrão
  shadcn de classes, agora coloridas pela marca). NavLinks finais:
  **Home · CRM · A Receber · A Pagar** (o link "Todos" pode ser mantido ou removido conforme decisão de
  produto; o ERP não depende dele).
- **Rodapé**: `ColorBars` ao final do `Layout`.

### Regras de aplicação (checklist do briefing DEX)

- [ ] Vermelho (`--dex-red`) **só como acento / CTA** — nunca como cor estrutural ou de grandes áreas.
- [ ] Azul (`--primary`) é a cor estrutural/interativa.
- [ ] **Sem emoji decorativo.** Setas/símbolos funcionais permitidos: `→ ↑ ↗ ★ ·`.
- [ ] CTA primário: fundo vermelho, hover `--dex-red-deep`.
- [ ] CTA secundário: borda azul, fundo transparente.
- [ ] Inputs com foco azul + `ring` (`--ring`).
- [ ] Cards **flat por padrão** (sem sombra forte); sombra só em hover (`KpiCard`) e modais.
- [ ] Canvas branco predominante; `bg-subtle` (`--muted`) para header/seções/sidebar.

### Estados da UI

Não há estados loading/error/empty/filled próprios (a feature não busca dados). Os estados visuais
relevantes são os **estados de interação** dos componentes: hover/active/focus de botões, links e
`KpiCard`, e o estado ativo do NavLink.

### Assets

- A **logo colorida** (`dex-color-*`) deve ser adicionada em `client/public/`. A spec registra o
  caminho esperado (ex.: `client/public/dex-color-logo.svg`) e a regra: a **versão branca da logo
  nunca é usada sobre fundo branco** (só a colorida sobre branco/claro).

---

## Error Cases

Não se aplica — feature sem backend nem validação de input. O único "erro" possível é visual
(token não aplicado / logo ausente), coberto pelos Acceptance Criteria.

---

## Migration

Não se aplica — sem alteração no banco de dados. As mudanças são em:
- [client/src/index.css](../client/src/index.css) (tokens),
- `client/src/components/brand/*` (novos componentes),
- [client/src/App.tsx](../client/src/App.tsx) (layout/nav/rodapé),
- `client/public/` (asset da logo).

---

## Acceptance Criteria

- [ ] O bloco `:root` em `index.css` está descomentado e usa os valores DEX (`--primary` = dex-blue, etc.)
- [ ] O bloco `@media (prefers-color-scheme: dark)` foi removido/neutralizado (app só em tema claro)
- [ ] As custom properties `--dex-red`, `--dex-red-deep`, `--grad-header`, `--shadow-card`/`--shadow-modal` existem
- [ ] `Redline`, `ColorBars`, `PageHeader` e `KpiCard` existem em `client/src/components/brand/`
- [ ] `PageHeader` renderiza a 1ª palavra do título em `--dex-red` com `Redline` acima
- [ ] `KpiCard` sobe 3px e ganha sombra + borda vermelha no hover
- [ ] O header do layout usa `--grad-header` e exibe a logo colorida DEX sobre fundo claro
- [ ] A nav exibe **Home · CRM · A Receber · A Pagar** com estado ativo azul
- [ ] `ColorBars` aparece no rodapé do `Layout`
- [ ] Nenhum emoji decorativo é usado; CTAs primários são vermelhos (hover `--dex-red-deep`)
- [ ] A logo colorida está em `client/public/` e a versão branca não é usada sobre branco
