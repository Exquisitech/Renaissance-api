const {
Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
} = require('docx');
const fs = require('fs');

// ── Palette ────────────────────────────────────────────────────────────────
const NAVY = '1F4E79';
const BLUE = '2E75B6';
const TEAL = '0F7B6C';
const RUST = 'C55A11';
const PURPLE = '7030A0';
const GRAY = 'F2F2F2';
const WHITE = 'FFFFFF';
const DARK = '1A1A2E';
const MID = '595959';

// ── Borders ────────────────────────────────────────────────────────────────
const bLight = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const bMed = { style: BorderStyle.SINGLE, size: 2, color: '9DC3E6' };
const borders = { top: bLight, bottom: bLight, left: bLight, right: bLight };
const headerBorders = { top: bMed, bottom: bMed, left: bMed, right: bMed };

// ── Helpers ────────────────────────────────────────────────────────────────
const sp = (b, a) => ({ spacing: { before: b, after: a } });

function h1(text) {
return new Paragraph({
heading: HeadingLevel.HEADING_1,
...sp(400, 160),
border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
children: [new TextRun({ text, bold: true, size: 36, color: NAVY, font: 'Arial' })],
});
}
function h2(text) {
return new Paragraph({
heading: HeadingLevel.HEADING_2,
...sp(280, 120),
children: [new TextRun({ text, bold: true, size: 28, color: BLUE, font: 'Arial' })],
});
}
function h3(text, color = TEAL) {
return new Paragraph({
...sp(200, 80),
children: [new TextRun({ text, bold: true, size: 22, color, font: 'Arial' })],
});
}
function para(text, opts = {}) {
return new Paragraph({
...sp(60, 60),
children: [new TextRun({ text, size: 20, font: 'Arial', color: DARK, ...opts })],
});
}
function note(text) {
return new Paragraph({
...sp(60, 60),
indent: { left: 360 },
children: [
new TextRun({ text: '💡 ', size: 20, font: 'Arial' }),
new TextRun({ text, size: 19, font: 'Arial', color: MID, italics: true }),
],
});
}
function rule(label, value, good) {
return new Paragraph({
numbering: { reference: 'bullets', level: 0 },
...sp(40, 40),
children: [
new TextRun({ text: label, bold: true, size: 20, font: 'Arial', color: DARK }),
new TextRun({ text: ' — ', size: 20, font: 'Arial', color: MID }),
new TextRun({ text: value, size: 20, font: 'Arial', color: MID }),
...(good !== undefined ? [
new TextRun({ text: ' ', size: 20, font: 'Arial' }),
new TextRun({ text: good ? '✓' : '✗', bold: true, size: 20, font: 'Arial', color: good ? '375623' : 'C00000' }),
] : []),
],
});
}
function code(text, lang = '') {
return new Paragraph({
...sp(40, 40),
indent: { left: 480 },
shading: { fill: '1E1E2E', type: ShadingType.CLEAR },
children: [new TextRun({ text, size: 17, font: 'Courier New', color: 'A6E3A1' })],
});
}
function codeInline(text) {
return new TextRun({ text: `${text}`, size: 18, font: 'Courier New', color: RUST, shading: { fill: 'FFF0E8', type: ShadingType.CLEAR } });
}
function divider() {
return new Paragraph({
border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 1 } },
...sp(160, 160),
children: [],
});
}
function spacer(n = 1) {
return Array.from({ length: n }, () => new Paragraph({ children: [] }));
}

// ── Two-column comparison table ─────────────────────────────────────────────
function compareTable(rows) {
const COL = [4500, 4500];
return new Table({
width: { size: 9360, type: WidthType.DXA },
columnWidths: COL,
rows: [
new TableRow({
tableHeader: true,
children: [
makeCell('✅ Do', COL[0], TEAL, WHITE, true),
makeCell('❌ Don\'t', COL[1], 'C00000', WHITE, true),
],
}),
...rows.map(([good, bad]) => new TableRow({
children: [
makeCodeCell(good, COL[0], 'EFF9F6'),
makeCodeCell(bad, COL[1], 'FFF2F2'),
],
})),
],
});
}

function makeCell(text, width, fill, textColor, bold = false) {
return new TableCell({
borders: headerBorders,
width: { size: width, type: WidthType.DXA },
shading: { fill, type: ShadingType.CLEAR },
margins: { top: 80, bottom: 80, left: 120, right: 120 },
children: [new Paragraph({
children: [new TextRun({ text, bold, size: 19, font: 'Arial', color: textColor })],
})],
});
}

function makeCodeCell(text, width, fill) {
return new TableCell({
borders,
width: { size: width, type: WidthType.DXA },
shading: { fill, type: ShadingType.CLEAR },
margins: { top: 80, bottom: 80, left: 120, right: 120 },
children: [new Paragraph({
children: [new TextRun({ text, size: 17, font: 'Courier New', color: DARK })],
})],
});
}

// ── Named table ─────────────────────────────────────────────────────────────
function namedTable(headers, colWidths, rows) {
const total = colWidths.reduce((a, b) => a + b, 0);
return new Table({
width: { size: total, type: WidthType.DXA },
columnWidths: colWidths,
rows: [
new TableRow({
tableHeader: true,
children: headers.map((h, i) => new TableCell({
borders: headerBorders,
width: { size: colWidths[i], type: WidthType.DXA },
shading: { fill: NAVY, type: ShadingType.CLEAR },
margins: { top: 60, bottom: 60, left: 100, right: 100 },
children: [new Paragraph({
children: [new TextRun({ text: h, bold: true, size: 18, font: 'Arial', color: WHITE })],
})],
})),
}),
...rows.map((row, ri) => new TableRow({
children: row.map((cell, ci) => new TableCell({
borders,
width: { size: colWidths[ci], type: WidthType.DXA },
shading: { fill: ri % 2 === 0 ? WHITE : 'F5F9FF', type: ShadingType.CLEAR },
margins: { top: 60, bottom: 60, left: 100, right: 100 },
children: [new Paragraph({
children: [new TextRun({ text: cell, size: 18, font: 'Courier New', color: DARK })],
})],
})),
})),
],
});
}

// ── Document ─────────────────────────────────────────────────────────────────
const doc = new Document({
numbering: {
config: [
{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 240 } } } }] },
{ reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 240 } } } }] },
],
},
styles: {
default: { document: { run: { font: 'Arial', size: 20 } } },
paragraphStyles: [
{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
run: { size: 36, bold: true, font: 'Arial', color: NAVY },
paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
{ id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
run: { size: 28, bold: true, font: 'Arial', color: BLUE },
paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
],
},
sections: [{
properties: {
page: {
size: { width: 12240, height: 15840 },
margin: { top: 1260, right: 1260, bottom: 1260, left: 1260 },
},
},
children: [
// ══ COVER ══════════════════════════════════════════════════════════════
new Paragraph({ ...sp(1440, 200), alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'StellarSpend', bold: true, size: 64, color: NAVY, font: 'Arial' })] }),
new Paragraph({ ...sp(0, 200), alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Code Style & Linting Standards', bold: true, size: 44, color: BLUE, font: 'Arial' })] }),
new Paragraph({ ...sp(0, 600), alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'v1.0 • February 2026', size: 22, color: MID, font: 'Arial' })] }),
new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 2 } }, ...sp(0, 600), children: [] }),

      // ══ 1. PURPOSE ════════════════════════════════════════════════════════
      h1('1. Purpose & Scope'),
      para('This document is the single source of truth for code style across all StellarSpend repositories. Consistent style reduces cognitive overhead in code review, prevents entire classes of bugs, and makes the codebase approachable for new contributors.'),
      para('These rules apply to:'),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'TypeScript / JavaScript — frontend, SDK, scripts', size: 20, font: 'Arial' })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'Rust — all Soroban smart contracts under ', size: 20, font: 'Arial' }), codeInline('contracts/'), new TextRun({ text: ' and ', size: 20, font: 'Arial' }), codeInline('tests/')] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'Configuration & documentation files', size: 20, font: 'Arial' })] }),
      note('Tooling enforces the majority of these rules automatically. Manual review focuses on semantics, not formatting.'),
      divider(),

      // ══ 2. ESLINT ═════════════════════════════════════════════════════════
      h1('2. ESLint Rules (TypeScript / JavaScript)'),
      para('Config file: .eslintrc.js at the repository root. Run via:'),
      code('npx eslint . --ext .ts,.tsx,.js,.jsx', 'bash'),
      code('npx eslint . --ext .ts,.tsx,.js,.jsx --fix   # auto-fix safe issues', 'bash'),

      h2('2.1  Parser & Project Setup'),
      para('All TypeScript files are parsed with @typescript-eslint/parser and type-checked against tsconfig.json. This enables type-aware rules that catch runtime errors at lint time.'),

      h2('2.2  TypeScript Rules'),
      ...spacer(),
      namedTable(
        ['Rule', 'Level', 'Rationale'],
        [3800, 1400, 3960],
        [
          ['@typescript-eslint/no-explicit-any', 'error', 'Forces explicit typing; any defeats the type system'],
          ['@typescript-eslint/no-unused-vars', 'error', 'Prefix with _ to intentionally ignore'],
          ['@typescript-eslint/no-non-null-assertion', 'error', 'Use optional chaining or explicit guards instead'],
          ['@typescript-eslint/no-floating-promises', 'error', 'Every Promise must be awaited or .catch()\'d'],
          ['@typescript-eslint/await-thenable', 'error', 'Prevents await on non-Promise values'],
          ['@typescript-eslint/consistent-type-imports', 'error', 'import type { Foo } for type-only imports'],
          ['@typescript-eslint/prefer-nullish-coalescing', 'warn', 'Prefer ?? over || for null/undefined checks'],
        ]
      ),
      ...spacer(),

      h2('2.3  Import Order'),
      para('Imports are sorted into groups separated by blank lines:'),
      code("// 1. Node built-ins\nimport fs from 'fs';\n\n// 2. External packages\nimport { useState } from 'react';\n\n// 3. Internal aliases\nimport { formatAmount } from '@/utils/format';\n\n// 4. Relative imports\nimport { PaymentCard } from './PaymentCard';\n\n// 5. Type imports (always last)\nimport type { Payment } from '@/types';"),

      h2('2.4  Do / Don\'t Quick Reference'),
      ...spacer(),
      compareTable([
        ["const result = value ?? 'default';", "const result = value || 'default';"],
        ["import type { Foo } from './types';", "import { Foo } from './types'; // type-only"],
        ["const _unused = getStuff();", "const unused = getStuff(); // lint error"],
        ["if (condition) {\n  doSomething();\n}", "if (condition) doSomething(); // no braces"],
        ["void asyncFn();  // intentional", "asyncFn();  // floating promise"],
      ]),
      ...spacer(),

      h2('2.5  Overrides'),
      para('Test files (.test.ts, .spec.ts) receive relaxed rules: no-explicit-any is warn (not error), and no-non-null-assertion is off. Page files under src/pages/ and src/app/ allow default exports.'),
      divider(),

      // ══ 3. PRETTIER ═══════════════════════════════════════════════════════
      h1('3. Prettier Formatting'),
      para('Config file: .prettierrc at the repository root. Prettier owns all whitespace decisions — ESLint is configured with the prettier extension to disable conflicting rules.'),
      code('npx prettier --write .', 'bash'),
      code('npx prettier --check .   # CI check', 'bash'),

      h2('3.1  Core Settings'),
      ...spacer(),
      namedTable(
        ['Setting', 'Value', 'Effect'],
        [3200, 1600, 4360],
        [
          ['printWidth', '100', 'Lines wrap at 100 characters'],
          ['tabWidth', '2', 'Two-space indentation'],
          ['singleQuote', 'true', "Single quotes for JS strings: 'hello'"],
          ['trailingComma', '"all"', 'Trailing commas in multi-line constructs'],
          ['semi', 'true', 'Semicolons required'],
          ['bracketSpacing', 'true', 'Spaces inside object braces: { key: val }'],
          ['arrowParens', '"always"', 'Always parenthesise arrow args: (x) => x'],
          ['endOfLine', '"lf"', 'Unix line endings — enforced in .gitattributes too'],
        ]
      ),
      ...spacer(),

      h2('3.2  File-type Overrides'),
      rule('Markdown / MDX', 'printWidth: 80, proseWrap: always — prose reflowed at 80 chars'),
      rule('JSON / JSONC', 'printWidth: 80 — config files stay compact'),
      rule('YAML', 'singleQuote: false — YAML convention uses double quotes'),
      divider(),

      // ══ 4. RUST ═══════════════════════════════════════════════════════════
      h1('4. Rust Formatting (Soroban Contracts)'),
      para('Config file: rustfmt.toml at the repository root. Applied via:'),
      code('cargo fmt --all', 'bash'),
      code('cargo fmt --all -- --check   # CI check', 'bash'),
      para('Clippy is also required to pass with no warnings:'),
      code('cargo clippy --all-targets --all-features -- -D warnings', 'bash'),

      h2('4.1  rustfmt Settings'),
      ...spacer(),
      namedTable(
        ['Setting', 'Value', 'Rationale'],
        [3400, 2200, 3760],
        [
          ['max_width', '100', 'Match TS printWidth for consistency'],
          ['tab_spaces', '4', 'Rust ecosystem standard'],
          ['imports_granularity', '"Crate"', 'All crate imports grouped together'],
          ['group_imports', '"StdExternalCrate"', 'std → external → crate ordering'],
          ['trailing_comma', '"Vertical"', 'Trailing commas on multi-line constructs'],
          ['use_field_init_shorthand', 'true', 'Foo { x } not Foo { x: x }'],
          ['use_try_shorthand', 'true', '? not try!()'],
          ['chain_width', '60', 'Method chains >60 chars are broken per line'],
        ]
      ),
      ...spacer(),

      h2('4.2  Clippy Lints'),
      para('The following Clippy lint groups must pass in CI with zero warnings:'),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'clippy::correctness', bold: true, size: 20, font: 'Courier New', color: RUST }), new TextRun({ text: '  — catches outright bugs (always deny)', size: 20, font: 'Arial' })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'clippy::suspicious', bold: true, size: 20, font: 'Courier New', color: RUST }), new TextRun({ text: '  — likely-wrong patterns', size: 20, font: 'Arial' })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'clippy::perf', bold: true, size: 20, font: 'Courier New', color: RUST }), new TextRun({ text: '  — unnecessary allocations and copies', size: 20, font: 'Arial' })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'clippy::style', bold: true, size: 20, font: 'Courier New', color: RUST }), new TextRun({ text: '  — idiomatic Rust patterns', size: 20, font: 'Arial' })] }),

      h2('4.3  Contract-specific Rust Rules'),
      rule('require_auth first', 'Always the first statement in every mutating pub fn'),
      rule('checked arithmetic', 'Use checked_add / checked_mul — never bare + on i128 or u32'),
      rule('no unwrap() in contracts', 'Use unwrap_or_else(|| panic_with_error!(...)) with a typed error'),
      rule('TTL bump on access', 'Call extend_ttl on every persistent() get and set'),
      rule('CEI pattern', 'Checks → Effects (state writes) → Interactions (token transfers)'),
      rule('Doc comments on every pub fn', '/// with # Security section for any entry point that moves funds'),
      ...spacer(),
      compareTable([
        ["amount\n  .checked_add(fee)\n  .unwrap_or_else(|| panic_with_error!(\n    &env, Error::Overflow));",
         "let total = amount + fee;\n// overflows silently on i128::MAX"],
        ["caller.require_auth();\nSelf::require_admin(&env, &caller);",
         "// missing require_auth —\n// anyone can call this function"],
        ["env.storage().persistent()\n  .extend_ttl(&key, TTL, TTL);",
         "// no TTL bump — record silently\n// evicted from ledger state"],
      ]),
      divider(),

      // ══ 5. NAMING ═════════════════════════════════════════════════════════
      h1('5. Naming Conventions'),

      h2('5.1  TypeScript / JavaScript'),
      ...spacer(),
      namedTable(
        ['Entity', 'Convention', 'Example'],
        [2800, 2200, 4360],
        [
          ['Variables & functions', 'camelCase', 'calculateFee, userBalance'],
          ['React components', 'PascalCase', 'PaymentCard, FreezeButton'],
          ['Types & interfaces', 'PascalCase', 'ConditionalPayment, UserPrefs'],
          ['Enums', 'PascalCase members', 'PaymentStatus.Executed'],
          ['Constants (module-level)', 'SCREAMING_SNAKE_CASE', 'MAX_RETRIES, DEFAULT_TTL'],
          ['Private class members', '_camelCase prefix', '_internalState'],
          ['Boolean variables', 'is / has / can prefix', 'isFrozen, hasApproved'],
          ['Event handlers', 'handle prefix', 'handleSubmit, handleCancel'],
          ['Test files', 'same name + .test.ts', 'fees.ts → fees.test.ts'],
        ]
      ),
      ...spacer(),

      h2('5.2  Rust (Contracts)'),
      ...spacer(),
      namedTable(
        ['Entity', 'Convention', 'Example'],
        [2800, 2200, 4360],
        [
          ['Types, structs, enums', 'PascalCase', 'RecurringSchedule, FeeError'],
          ['Functions & methods', 'snake_case', 'calculate_fee, require_admin'],
          ['Variables & fields', 'snake_case', 'streak_days, expires_at'],
          ['Constants', 'SCREAMING_SNAKE_CASE', 'PERSISTENT_TTL_BUMP, MAX_SIGNERS'],
          ['Modules (files)', 'snake_case', 'account_status.rs, fees.rs'],
          ['Error enum variants', 'PascalCase', 'AlreadyInitialized, Overflow'],
          ['Storage key variants', 'PascalCase', 'DataKey::UserStreak(Address)'],
          ['Test functions', 'category_description', 'happy_create_stores_record'],
          ['Test categories', 'prefix_*', 'happy_ neg_ edge_ auth_ security_'],
        ]
      ),
      ...spacer(),
      divider(),

      // ══ 6. FILE STRUCTURE ═════════════════════════════════════════════════
      h1('6. File Structure Rules'),

      h2('6.1  Repository Layout'),
      code(

`stellarspend-contracts/
├── contracts/               # One file per Soroban contract
│   ├── fees.rs
│   ├── delegation.rs
│   ├── account_status.rs
│   ├── conditional_payments.rs
│   ├── recurring_savings.rs
│   ├── streak_rewards.rs
│   ├── preferences.rs
│   └── errors.rs            # Shared error taxonomy
├── tests/                   # Mirror of contracts/ — one test file per contract
│   ├── fees_tests.rs
│   ├── account_status_tests.rs
│   └── ...
├── docs/
│   ├── security_audit.md
│   └── style_guide.md
├── .eslintrc.js
├── .prettierrc
├── rustfmt.toml
└── Cargo.toml`
),

      h2('6.2  Contract File Structure'),
      para('Every contract file must follow this internal section order, separated by the standard section-comment banner:'),
      code(

`//! Module-level doc comment — what the contract does, lifecycle, security properties.

#![no_std]

use soroban_sdk::{...};

// ── Constants ──────────────────────────
// ── Storage keys ───────────────────────
// ── Types ──────────────────────────────
// ── Errors ─────────────────────────────
// ── Events ─────────────────────────────
// ── Internal helpers ───────────────────
// ── Contract ───────────────────────────`
),

      h2('6.3  Test File Structure'),
      para('Test files mirror their contract counterpart and use the five-category taxonomy:'),
      code(

`//! Tests for contracts/<name>.rs #![cfg(test)]

// ── Harness / helpers ──────────────────
// ── happy*\* — correct flows ───────────
// ── neg*_ — rejection tests ─────────
// ── edge\__ — boundary cases ──────────
// ── auth*\* — authorization tests ─────
// ── security*_ / dispatch\__ — guards ───`
),

      h2('6.4  TypeScript File Structure'),
      para('Frontend and SDK source files follow this order:'),
      code(

`// 1. Type imports
// 2. External imports (sorted alphabetically)
// 3. Internal imports (sorted alphabetically)
// 4. Constants
// 5. Types / interfaces defined in this file
// 6. Helper functions (unexported)
// 7. Main export(s)
// 8. Named exports (no default exports except in page files)`
),

      h2('6.5  Naming Rules for Files & Directories'),
      rule('Contract source files', 'snake_case.rs', '✓'),
      rule('Test files', 'snake_case_tests.rs — matches contract name', '✓'),
      rule('TypeScript source', 'PascalCase.tsx for components, camelCase.ts for utilities', '✓'),
      rule('Directories', 'kebab-case', '✓'),
      rule('Config files', 'dotfile or lowercase root', '✓'),
      rule('No index files except entry points', 'Prefer explicit named imports over index barrel files inside feature directories', '✓'),
      divider(),

      // ══ 7. CI ENFORCEMENT ════════════════════════════════════════════════
      h1('7. CI Enforcement'),
      para('All checks run on every pull request. A PR cannot be merged unless all of the following pass:'),
      ...spacer(),
      namedTable(
        ['Check', 'Command', 'Blocks merge?'],
        [2600, 4560, 2200],
        [
          ['ESLint', 'npx eslint . --ext .ts,.tsx,.js,.jsx', 'Yes'],
          ['Prettier', 'npx prettier --check .', 'Yes'],
          ['rustfmt', 'cargo fmt --all -- --check', 'Yes'],
          ['Clippy', 'cargo clippy --all -- -D warnings', 'Yes'],
          ['TS compile', 'npx tsc --noEmit', 'Yes'],
          ['Rust tests', 'cargo test --all', 'Yes'],
          ['Security audit', 'cargo audit', 'Yes (critical CVEs)'],
        ]
      ),
      ...spacer(),
      note('Add a .github/workflows/lint.yml to run these checks automatically on push and pull_request events.'),
      divider(),

      // ══ 8. EDITOR SETUP ══════════════════════════════════════════════════
      h1('8. Editor Setup'),
      h2('8.1  VS Code (Recommended)'),
      para('Install the following extensions:'),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'ESLint', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: '  (dbaeumer.vscode-eslint)', size: 20, font: 'Arial', color: MID })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'Prettier – Code formatter', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: '  (esbenp.prettier-vscode)', size: 20, font: 'Arial', color: MID })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'rust-analyzer', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: '  (rust-lang.rust-analyzer)', size: 20, font: 'Arial', color: MID })] }),
      new Paragraph({ numbering: { reference: 'bullets', level: 0 }, ...sp(40,40), children: [new TextRun({ text: 'Even Better TOML', bold: true, size: 20, font: 'Arial' }), new TextRun({ text: '  (tamasfe.even-better-toml)', size: 20, font: 'Arial', color: MID })] }),
      ...spacer(),
      para('Recommended .vscode/settings.json:'),
      code(

`{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "rust-analyzer.check.command": "clippy"
}`
),

      h2('8.2  Pre-commit Hooks'),
      para('Install lint-staged and husky to run checks locally before every commit:'),
      code('npm install --save-dev husky lint-staged\nnpx husky install', 'bash'),
      para('Add to package.json:'),
      code(

`"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yaml,yml}": ["prettier --write"]
}`
),
...spacer(),

      // Footer
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
        ...sp(400, 80),
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'StellarSpend Code Style Guide  •  v1.0  •  February 2026  •  Confidential', size: 16, color: MID, font: 'Arial' })],
      }),
    ],

}],
});

Packer.toBuffer(doc).then(buf => {
fs.writeFileSync('/mnt/user-data/outputs/stellarspend_style_guide.docx', buf);
console.log('Done');
});
