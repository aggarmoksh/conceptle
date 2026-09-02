import "@testing-library/jest-dom";

// jsdom's atob/btoa support varies by version; polyfill defensively so
// lib/puzzle.ts's decodeTargetHint works the same in tests as in a browser.
if (typeof globalThis.atob === "undefined") {
  globalThis.atob = (b64: string) => Buffer.from(b64, "base64").toString("binary");
}
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
}
