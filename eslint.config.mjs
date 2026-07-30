import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const sharedGlobals = Object.freeze({
  AbortController: "readonly",
  ArrayBuffer: "readonly",
  Blob: "readonly",
  DOMException: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  atob: "readonly",
  btoa: "readonly",
  crypto: "readonly",
  console: "readonly",
  fetch: "readonly",
  performance: "readonly",
  queueMicrotask: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  structuredClone: "readonly"
});

const browserGlobals = Object.freeze({
  ...sharedGlobals,
  CustomEvent: "readonly",
  FileReader: "readonly",
  WebSocket: "readonly",
  XMLSerializer: "readonly",
  cancelAnimationFrame: "readonly",
  document: "readonly",
  history: "readonly",
  localStorage: "readonly",
  location: "readonly",
  navigator: "readonly",
  requestAnimationFrame: "readonly",
  window: "readonly"
});

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "games/**/source/**",
      "output/**",
      "自动新闻/**"
    ]
  },
  {
    files: ["tools/whiteboard/src/**/*.jsx"],
    plugins: { react },
    rules: {
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error"
    }
  },
  {
    files: [
      "functions/api/anonymous-identity.mjs",
      "functions/api/whiteboard-service.mjs",
      "js/features/anonymous-identity.mjs",
      "js/routes/chatroom.mjs",
      "tools/whiteboard/src/**/*.{js,jsx}",
      "tests/anonymous-identity-api.test.mjs",
      "tests/whiteboard-service-api.test.mjs"
    ],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: browserGlobals
    },
    rules: {
      ...eslint.configs.recommended.rules,
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      globals: {
        ...browserGlobals,
        Buffer: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["workers/whiteboard/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  }
];
