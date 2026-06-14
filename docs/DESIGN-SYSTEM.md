# Tastile Design System v2.0

## Overview

Tastileのデザインシステムは、スイスデザインとフラットデザインを基盤とし、ミニマルかつクリエイティブなGoogle/Notionライクなデザインを実現します。見た目は個別のコンポーネントごとの装飾値として決定せず、要素がどの階層に属し、どのような情報密度を持ち、どの方向へ操作されるかによって決定される。

## Structural Design Rules

### 1. 見た目は値ではなく構造から導出する

コンポーネントは、それ単体で角丸や余白を持つのではなく、必ず親要素との関係の中で形を持つ。

判断の順序は以下の通り：

1. その要素がどの親レイヤーに属するかを決める。
2. 親レイヤーの内側余白を決める。
3. 子要素の角丸は、親レイヤーの角丸と内側余白の関係から決める。
4. 子要素がさらに内包要素を持つ場合も、同じ規則を再帰的に適用する。

角丸の大きさそのものではなく、入れ子になった角丸の円中心が揃っていることが重要。

円中心を揃える計算式: `padding = 親の角丸 - 子の角丸`

例: 親 radius 16px、子 radius 12px の場合、padding = 4px

### 2. 角丸と余白は分離しない

角丸が大きい要素には、それに見合う余白が必要。外側の角丸が大きいほど、内側の余白も広くなる。内側の階層に進むほど、余白と角丸は一定の比率で減衰する。

### 3. グリッドは装飾ではなく判断基準

グリッドは画面に線を表示するためのものではなく、情報の位置、幅、整列、余白を判断するための基準。

確認事項：
- 左端と右端が偶然ではなく意図的に揃っているか
- テキストの開始位置が階層ごとに整理されているか
- コントロールの幅が内容量だけでばらついていないか
- 余白の変化が階層に従っているか
- 縦方向に情報を積みすぎて、リズムを壊していないか

### 4. 色は階層を作るために使う

基本の階層はグレースケールの面の違いによって作る。背景、面、内側の面、操作可能な面は、それぞれ近いトーンでありながら、十分に区別できる必要がある。

アクセントカラーは、小さな丸ポチ、状態マーカー、注意を向けるための最小単位に限定。

### 5. テキストは常に読める必要がある

テキストの前景色と背景色は、必ず十分なコントラストを持つ。アクセントカラーを文字色に使わない。

テキストの役割は、主情報、補助情報、状態情報、説明情報に分けて判断。常時必要な情報だけを通常状態で表示し、常時必要でない情報はホバーや展開状態に委ねる。

### 6. コントロールは横長の情報単位

コントロールはテキストだけに依存しない。基本構造は、アイコン、主ラベル、状態、補助操作、必要に応じてホバー時の補足から成る。

補足説明は、通常状態では隠し、ホバー時やフォーカス時に同じコントロール内で現れる。新しい行を追加してはならない。

### 7. ホバーは移動ではなく意味の露出

ホバー時に要素全体を移動させてはならない。ホバー表現の目的は、その要素が持つ意味や次の操作を少しだけ露出すること。

既存の構造の中で、操作の意味だけを明らかにする。

### 8. アイコンは装飾ではなく読解補助

アイコンは、テキストの代替ではなく、操作や状態を素早く理解するための補助。アイコンとテキストの間隔は、コントロール全体の高さ、角丸、内側余白との関係で決める。

### 9. 文書プレビューは見本ではなく再現

文書に書かれた原則、トークン、コンポーネント、レイアウト、禁止事項、実装方針が、実際に再現可能であることを確認するためのビュー。

### 10. 最終確認の観点

- 角丸の円中心が親子で揃っているか
- 余白の変化率が一定か
- テキストがすべて読めるか
- アクセントカラーが小さな状態表示に限定されているか
- ホバーによって要素全体が移動したり、レイアウトの高さが変わったりしていないか
- 文書に書かれたすべての内容がプレビュー上で確認できるか

## Design Principles

1. **フラットデザイン** - ボーダー、影、グラデーションを使わない
2. **階層構造** - 外側が大きく、内側が小さい角丸とスペーシング
3. **一貫性** - すべてのコンポーネントで統一された見た目
4. **読みやすさ** - 適切なコントラストとタイポグラフィ
5. **アクセシビリティ** - WCAG AA準拠のコントラスト比

## Color System

### Grayscale (Primary Palette)

| Token | Value | Purpose |
|-------|-------|---------|
| `gray-50` | #fafafa | Background |
| `gray-100` | #f5f5f5 | Surface 0 |
| `gray-200` | #e5e5e5 | Surface 1 |
| `gray-300` | #d4d4d4 | Subtle background |
| `gray-400` | #a3a3a3 | Muted Text |
| `gray-500` | #737373 | Subtext |
| `gray-600` | #525252 | Text |
| `gray-700` | #404040 | High Text |
| `gray-800` | #262626 | Dark Background |
| `gray-900` | #171717 | Dark Surface |
| `gray-950` | #0a0a0a | Dark Contrast |

### Brand Colors

| Token | Value | Purpose |
|-------|-------|---------|
| `indigo-50` | #eef2ff | Light Background |
| `indigo-100` | #e0e7ff | Light Highlight |
| `indigo-500` | #6366f1 | Main Accent |
| `indigo-600` | #4f46e5 | Hover |
| `indigo-700` | #4338ca | Active |

### Status Colors

| Token | Value | Purpose |
|-------|-------|---------|
| `success` | #22c55e | Complete |
| `warning` | #f59e0b | In Progress |
| `danger` | #ef4444 | Error |

### Semantic Tokens

```css
:root {
  /* Background */
  --background: var(--gray-50);
  --surface-0: var(--gray-100);
  --surface-1: var(--gray-200);
  --surface-2: var(--gray-300);
  
  /* Text */
  --foreground: var(--gray-950);
  --foreground-muted: var(--gray-600);
  --foreground-subtle: var(--gray-500);
  
  /* Brand */
  --primary: var(--indigo-500);
  --primary-foreground: #ffffff;
  --primary-hover: var(--indigo-600);
  --primary-active: var(--indigo-700);
  
  /* Status */
  --success: var(--success);
  --warning: var(--warning);
  --danger: var(--danger);
}

.dark {
  --background: var(--gray-950);
  --surface-0: var(--gray-900);
  --surface-1: var(--gray-800);
  --surface-2: var(--gray-700);
  
  --foreground: var(--gray-50);
  --foreground-muted: var(--gray-400);
  --foreground-subtle: var(--gray-500);
  
  --primary: var(--indigo-500);
  --primary-foreground: #000000;
  --primary-hover: var(--indigo-600);
  --primary-active: var(--indigo-700);
}
```

## Typography

### Font Families

```css
:root {
  /* Latin - Helvetica優先 */
  --font-sans: "Helvetica Neue", Helvetica, Arial, "Inter", system-ui, sans-serif;
  --font-mono: "Geist Mono", "SF Mono", "Monaco", "Inconsolata", "Fira Mono", monospace;
  
  /* Japanese */
  --font-jp: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  --font-jp-heading: "Zen Kaku Gothic New", "Noto Sans JP", "Hiragino Sans", sans-serif;
}
```

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|-------|------|--------|-------------|----------------|-----|
| `display-lg` | 56px | 600 | 1.10 | -1px | Hero headlines |
| `heading-1` | 48px | 600 | 1.15 | -0.5px | Page titles |
| `heading-2` | 36px | 600 | 1.20 | -0.5px | Section titles |
| `heading-3` | 28px | 600 | 1.25 | 0 | Card titles |
| `heading-4` | 22px | 600 | 1.30 | 0 | Feature titles |
| `heading-5` | 18px | 600 | 1.40 | 0 | Subheadings |
| `subtitle` | 18px | 400 | 1.50 | 0 | Hero subtitles |
| `body-md` | 16px | 400 | 1.55 | 0 | Primary body |
| `body-md-medium` | 16px | 500 | 1.55 | 0 | Body emphasis |
| `body-sm` | 14px | 400 | 1.50 | 0 | Secondary body |
| `body-sm-medium` | 14px | 500 | 1.50 | 0 | Button labels |
| `caption` | 13px | 400 | 1.40 | 0 | Captions |
| `caption-bold` | 13px | 600 | 1.40 | 0 | Badge labels |
| `micro` | 12px | 500 | 1.40 | 0 | Micro text |
| `micro-uppercase` | 11px | 600 | 1.40 | 1px | Labels |

### Principles

- Tight leading on display sizes (1.05-1.15)
- Negative letter-spacing on display sizes (-1px to -0.5px)
- Generous body leading (1.55) for readability
- 600 weight for headlines, 500 for buttons, 400 for body

## Spacing

### Base Unit

4px base unit with 4px increments.

### Scale

| Token | Value | Use |
|-------|-------|-----|
| `xxs` | 4px | Minimal spacing |
| `xs` | 8px | Tight spacing |
| `sm` | 12px | Small spacing |
| `md` | 16px | Default spacing |
| `lg` | 20px | Medium spacing |
| `xl` | 24px | Large spacing |
| `xxl` | 32px | Extra large spacing |
| `xxxl` | 40px | Section spacing |
| `section-sm` | 48px | Small section |
| `section` | 64px | Default section |
| `section-lg` | 96px | Large section |
| `hero` | 120px | Hero section |

### Usage Examples

```css
/* Component spacing */
.card { padding: var(--spacing-xl); }
.button { padding: var(--spacing-sm) var(--spacing-md); }
.input { padding: var(--spacing-sm) var(--spacing-md); }

/* Layout spacing */
.section { margin-bottom: var(--spacing-section); }
.stack > * + * { margin-top: var(--spacing-md); }
```

## Border Radius

### Scale

| Token | Value | Use |
|-------|-------|-----|
| `none` | 0 | Flat elements |
| `xs` | 4px | Core (innermost) |
| `sm` | 8px | Tags, small elements |
| `md` | 12px | Buttons, inputs, inner containers |
| `lg` | 16px | Cards, mid-level containers |
| `xl` | 24px | Large cards |
| `xxl` | 32px | Outer containers, featured elements |
| `xxxl` | 40px | Page-level wrappers |
| `full` | 9999px | Pills, badges |

### Principles

- **Flat first**: No border-radius by default
- **Layer-aware**: Inner elements have smaller radius than outer containers
- **Consistent**: Same component type uses same radius

### Nested Hierarchy Example

円中心を揃えた入れ子構造。外側ほど角丸が大きく、余白も広くなる。すべての余白は4px単位:

```
outer (radius-xxl: 32px) + padding 16px
  └─ mid (radius-lg: 16px) + padding 8px
       └─ inner (radius-sm: 8px) + padding 4px
            └─ core (radius-xs: 4px)
```

## Elevation

フラットデザイン原則により、**影、ボーダー、グラデーションは使用しない**。

階層はグレースケールの面の違い（background → surface-0 → surface-1 → surface-2）によって表現する。

## Components

### Buttons

#### Primary Button
```css
.button-primary {
  background: var(--foreground);
  color: var(--background);
  padding: 10px 18px;
  border-radius: var(--radius-md);
  font: var(--typography-body-sm-medium);
  border: none;
  cursor: pointer;
  transition: background 150ms ease;
  width: 100%;
  text-align: center;
}

.button-primary:hover {
  background: var(--gray-800);
}

.button-primary:active {
  background: var(--gray-900);
}

.button-primary:disabled {
  background: var(--gray-300);
  color: var(--gray-500);
  cursor: not-allowed;
}
```

#### Secondary Button
```css
.button-secondary {
  background: transparent;
  color: var(--foreground);
  padding: 10px 18px;
  border-radius: var(--radius-md);
  font: var(--typography-body-sm-medium);
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  width: 100%;
  text-align: center;
}

.button-secondary:hover {
  background: var(--surface-0);
}

.button-secondary:active {
  background: var(--surface-1);
}
```

#### Ghost Button
```css
.button-ghost {
  background: transparent;
  color: var(--foreground);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font: var(--typography-body-sm-medium);
  border: none;
  cursor: pointer;
  transition: background 150ms ease;
  width: 100%;
  text-align: center;
}

.button-ghost:hover {
  background: var(--surface-0);
}

.button-ghost:active {
  background: var(--surface-1);
}
```

### Cards

#### Base Card
```css
.card-base {
  background: var(--background);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
}

.card-base:hover {
  background: var(--surface-0);
}
```

#### Elevated Card
```css
.card-elevated {
  background: var(--surface-0);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
}
```

### Inputs

#### Text Input
```css
.input {
  background: var(--background);
  color: var(--foreground);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font: var(--typography-body-md);
  border: none;
  height: 44px;
  width: 100%;
  transition: background 150ms ease;
}

.input:focus {
  outline: none;
  background: var(--surface-0);
}

.input::placeholder {
  color: var(--foreground-subtle);
}
```

### Tabs

#### Pill Tabs
```css
.pill-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--foreground-muted);
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font: var(--typography-body-sm-medium);
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.pill-tab:hover {
  background: var(--surface-0);
}

.pill-tab.active {
  background: var(--foreground);
  color: var(--background);
}
```

#### Underline Tabs
```css
.underline-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--foreground-muted);
  padding: 12px 16px;
  font: var(--typography-body-sm-medium);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

.underline-tab:hover {
  color: var(--foreground);
}

.underline-tab.active {
  color: var(--foreground);
  border-bottom-color: var(--foreground);
}
```

### Badges

#### Status Badge with Text
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font: var(--typography-caption-bold);
}

.badge-success {
  background: var(--success);
  color: #ffffff;
}

.badge-warning {
  background: var(--warning);
  color: #000000;
}

.badge-danger {
  background: var(--danger);
  color: #ffffff;
}

.badge-outline {
  background: var(--surface-0);
  color: var(--foreground-muted);
}

.badge-soft {
  background: var(--surface-0);
  color: var(--foreground-muted);
}
```

### Notifications

#### Notification List
```css
.notification-list {
  display: flex;
  flex-direction: column;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--background);
  position: relative;
}

.notification:not(:last-child) {
  /* ボーダーなし — 背景色の違いで区別 */
}

.notification::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.notification-success::before {
  background: var(--success);
}

.notification-warning::before {
  background: var(--warning);
}

.notification-danger::before {
  background: var(--danger);
}

.notification-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font: var(--typography-body-sm-medium);
  margin-bottom: 4px;
}

.notification-message {
  font: var(--typography-body-sm);
  color: var(--foreground-muted);
  margin: 0;
}
```

### Hover States

#### Interactive Elements
```css
.hover-example {
  padding: 16px;
  background: var(--background);
  cursor: pointer;
  transition: all 150ms ease;
}

.hover-example:hover {
  background: var(--surface-0);
  color: var(--foreground);
}

.hover-example:active {
  background: var(--surface-1);
  color: var(--foreground);
}
```

## Layout

### Grid System

```css
.grid {
  display: grid;
  gap: var(--spacing-lg);
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 768px) {
  .grid-2,
  .grid-3,
  .grid-4 {
    grid-template-columns: 1fr;
  }
}
```

### Container

```css
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--spacing-xl);
}

@media (max-width: 768px) {
  .container {
    padding: 0 var(--spacing-md);
  }
}
```

### Stack

```css
.stack {
  display: flex;
  flex-direction: column;
}

.stack-sm > * + * {
  margin-top: var(--spacing-sm);
}

.stack-md > * + * {
  margin-top: var(--spacing-md);
}

.stack-lg > * + * {
  margin-top: var(--spacing-lg);
}
```

## Responsive Design

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | < 480px | Single column, 16px padding |
| Tablet | 480 – 1023px | 2-column grid, 24px padding |
| Desktop | 1024 – 1279px | 3-column grid, 32px padding |
| Wide | ≥ 1280px | 4-column grid, max-width 1280px |

### Touch Targets

- Minimum touch target: 44px × 44px
- Button height: 40-44px
- Input height: 44px

## Animation

### Transitions

```css
/* Default transition */
transition: all 150ms ease;

/* Specific transitions */
transition: background 150ms ease;
transition: color 150ms ease;
```

### Keyframes

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(8px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Do's and Don'ts

### Do

- Use grayscale as primary palette
- Use indigo sparingly for accents
- Maintain consistent spacing
- Use appropriate font weights for hierarchy
- Provide clear focus states
- Use subtle shadows for elevation

### Don't

- Don't use borders
- Don't use heavy shadows
- Don't use complex gradients
- Don't use decorative elements
- Don't use inconsistent spacing
- Don't use poor contrast ratios
- Don't use dotted lines

## Implementation

### CSS Variables

All design tokens are implemented as CSS custom properties in `globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-surface-0: var(--surface-0);
  --color-surface-1: var(--surface-1);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... etc */
}
```

### Tailwind Integration

Design tokens are mapped to Tailwind utility classes:

```css
/* Usage examples */
<div className="bg-surface-0 text-foreground p-xl rounded-lg">
<div className="bg-primary text-primary-foreground px-md py-sm rounded-md">
<div className="text-foreground-muted text-body-sm">
```

### Component Library

Components are built using Tailwind classes and the `cn()` utility:

```typescript
import { cn } from '@/lib/utils/cn';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={cn(
      'w-full px-md py-sm rounded-md font-medium transition-all duration-150 text-center',
      variant === 'primary' && 'bg-foreground text-background hover:bg-gray-800',
      variant === 'secondary' && 'bg-transparent text-foreground hover:bg-surface-0',
      variant === 'ghost' && 'bg-transparent text-foreground hover:bg-surface-0'
    )}>
      {children}
    </button>
  );
}
```

## Testing

### Visual Regression

- Use Chromatic for visual regression testing
- Test all components in both light and dark modes
- Verify responsive behavior at all breakpoints

### Accessibility

- Test with screen readers
- Verify keyboard navigation
- Check color contrast ratios
- Ensure proper ARIA attributes

## Migration Guide

### From v1 to v2

1. **Colors**: Replace zinc-based colors with semantic tokens
2. **Typography**: Update font weights and sizes
3. **Spacing**: Use consistent spacing tokens
4. **Components**: Update component styles to use new tokens
5. **Dark Mode**: Simplify to single dark theme

### Step-by-Step

1. Update `globals.css` with new design tokens
2. Replace hardcoded colors with semantic tokens
3. Update typography styles
4. Refactor component styles
5. Test in both light and dark modes
6. Verify responsive behavior

## References

- [Notion Design System](./DESIGN-MD/NOTION.md)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
