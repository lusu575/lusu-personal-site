import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const sharedGlobals = Object.freeze({
  AbortSignal: "readonly",
  AbortController: "readonly",
  ArrayBuffer: "readonly",
  Blob: "readonly",
  DOMException: "readonly",
  EventTarget: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  ReadableStream: "readonly",
  TransformStream: "readonly",
  WebSocket: "readonly",
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
  Audio: "readonly",
  CSS: "readonly",
  DOMParser: "readonly",
  CustomEvent: "readonly",
  Element: "readonly",
  Event: "readonly",
  File: "readonly",
  FileReader: "readonly",
  HTMLElement: "readonly",
  HTMLButtonElement: "readonly",
  HTMLIFrameElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLMediaElement: "readonly",
  HTMLTextAreaElement: "readonly",
  HTMLSelectElement: "readonly",
  Image: "readonly",
  IntersectionObserver: "readonly",
  KeyboardEvent: "readonly",
  MutationObserver: "readonly",
  Node: "readonly",
  NodeFilter: "readonly",
  PointerEvent: "readonly",
  ResizeObserver: "readonly",
  Worker: "readonly",
  WebSocket: "readonly",
  XMLSerializer: "readonly",
  XMLHttpRequest: "readonly",
  cancelAnimationFrame: "readonly",
  confirm: "readonly",
  document: "readonly",
  history: "readonly",
  getComputedStyle: "readonly",
  localStorage: "readonly",
  location: "readonly",
  navigator: "readonly",
  matchMedia: "readonly",
  sessionStorage: "readonly",
  requestAnimationFrame: "readonly",
  window: "readonly"
});

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "output/**",
      "**/.wrangler/**",
      "**/.venv/**",
      ".production-build-*/**",
      // Vendored game engines and compiled bundles. LuSu bridges remain covered.
      "games/a-dark-room/source/dev-server.js",
      "games/a-dark-room/source/lib/**",
      "games/a-dark-room/source/lang/**",
      "games/a-dark-room/source/script/!(lusu-*)",
      "games/a-dark-room/source/script/events/**",
      "games/kittens-game/source/{config,game,core,i18n}.js",
      "games/kittens-game/source/{lib,js,test,tools}/**",
      "games/life-restart/source/{assets,libs}/**"
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
    files: ["**/*.{js,mjs,cjs,jsx}"],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: sharedGlobals
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
    files: ["js/**", "admin/**", "games/**", "tools/**", "tests/**", "自动新闻/docs/assets/js/**"],
    languageOptions: { globals: browserGlobals }
  },
  {
    files: ["scripts/**", "tests/**", "agents/**", "cli/**", "mcp/**", "lib/**", "**/tests/**", "**/test/**", "**/scripts/**", "games/hextris/agent/**", "自动新闻/integrations/**", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        process: "readonly",
        global: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly"
      }
    }
  },
  {
    files: ["games/a-dark-room/source/script/lusu-*.js"],
    languageOptions: {
      globals: Object.fromEntries(["$", "$SM", "_", "Engine", "Events", "Outside", "Path", "Scoring", "Space", "State", "World"].map((name) => [name, "readonly"]))
    }
  },
  {
    files: ["games/life-restart/source/lusu-*.js"],
    languageOptions: { globals: { $ui: "readonly", core: "readonly", Laya: "readonly" } }
  },
  {
    files: ["functions/**", "workers/**/*.js"],
    languageOptions: {
      globals: {
        WebSocket: "readonly",
        WebSocketPair: "readonly",
        HTMLRewriter: "readonly",
        ReadableStream: "readonly",
        TransformStream: "readonly"
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
