import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * Ban locale-dependent formatting.
       *
       * `toLocaleString(undefined, …)` follows the viewer's machine, so the same
       * revenue figure rendered `$583.53` for one operator and `$73,31` for
       * another, and there was no way to tell a formatting difference from a
       * data difference. Money goes through `formatUsd`, token and share
       * amounts through `formatNumber`, dates through `formatDateTime` — all
       * pinned to en-US in `lib/utils.ts`.
       *
       * Only the `undefined` locale is banned. An explicit locale is a
       * deliberate choice and still allowed.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='toLocaleString'][arguments.0.type='Identifier'][arguments.0.name='undefined']",
          message:
            "Locale-dependent formatting: use formatUsd / formatNumber / formatDateTime from @/lib/utils instead of toLocaleString(undefined, …).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
