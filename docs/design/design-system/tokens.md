# FindAI Design System Tokens & Guidelines

## 1. Color Palette Tokens

### Primary & Brand Colors
| Token Name | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--color-brand-primary` | `#101828` (Deep Navy) | `#F8FAFC` | Brand contrast, headings, primary navbar |
| `--color-accent-indigo` | `#635BFF` (Electric Indigo) | `#7971FF` | Primary action buttons, active tabs, focused states |
| `--color-accent-violet` | `#8B5CF6` (Soft Violet) | `#A78BFA` | AI badges, neural engine indicators, confidence meters |
| `--color-accent-teal` | `#0D9488` | `#14B8A6` | Verification badges, safe zones, confirmation steps |

### Surface & Background Tokens
| Token Name | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--bg-canvas` | `#F8FAFC` | `#0B0F19` | Application page background |
| `--bg-surface` | `#FFFFFF` | `#111827` | Card backgrounds, dialogs, modals |
| `--bg-surface-elevated` | `#FFFFFF` | `#1F2937` | Dropdowns, tooltips, popovers |
| `--bg-surface-subtle` | `#F1F5F9` | `#1E293B` | Table headers, chip backgrounds, disabled inputs |
| `--border-subtle` | `#E2E8F0` | `rgba(255, 255, 255, 0.08)` | Standard card borders and dividers |
| `--border-strong` | `#CBD5E1` | `rgba(255, 255, 255, 0.16)` | Focused inputs, active borders |

### Semantic State Colors
| Token Name | Color Value | Light Subtle Tint | Usage |
|---|---|---|---|
| `--color-success` | `#12B76A` | `#ECFDF3` | Found items, approved claims, completed handovers |
| `--color-lost` | `#F04438` | `#FEF3F2` | Lost items, rejected claims, danger actions |
| `--color-warning` | `#F79009` | `#FFFAEB` | Pending reviews, unconfirmed handovers, medium alerts |
| `--color-critical` | `#B42318` | `#FEF3F2` | Suspicious activity, security incident flags |

---

## 2. Typography Hierarchy
- **Heading Font**: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
- **Body Font**: `'Inter', system-ui, -apple-system, sans-serif`
- **Code/Monospace**: `'JetBrains Mono', 'Fira Code', monospace`

| Level | Size | Weight | Line Height | Tracking |
|---|---|---|---|---|
| Display / Hero | `2.75rem` (44px) | 800 (Extra Bold) | 1.15 | `-0.03em` |
| H1 Page Title | `1.875rem` (30px) | 700 (Bold) | 1.25 | `-0.02em` |
| H2 Section Heading | `1.375rem` (22px) | 600 (Semi Bold) | 1.35 | `-0.01em` |
| H3 Card Heading | `1.125rem` (18px) | 600 (Semi Bold) | 1.4 | `0` |
| Body Main | `0.9375rem` (15px) | 400 / 500 | 1.6 | `0` |
| Small / Meta | `0.8125rem` (13px) | 500 | 1.45 | `+0.01em` |
| Micro / Badge | `0.6875rem` (11px) | 600 (Semi Bold) | 1.2 | `+0.03em` |

---

## 3. Elevation & Radius Standards
- `--radius-sm`: `6px` (Small buttons, input tags)
- `--radius-md`: `10px` (Input fields, dropdowns, regular buttons)
- `--radius-lg`: `14px` (Cards, table containers, preview modals)
- `--radius-xl`: `20px` (Hero containers, large panels)
- `--shadow-sm`: `0 1px 3px rgba(16, 24, 40, 0.05), 0 1px 2px rgba(16, 24, 40, 0.03)`
- `--shadow-md`: `0 4px 8px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.03)`
- `--shadow-lg`: `0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)`
