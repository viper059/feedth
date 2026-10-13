import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// แอปเขียนไว้ใช้ window.storage (ในแชท Claude) นอก Claude ใช้ localStorage แทน
if (!window.storage) {
  const k = (key) => "feedth:" + key;
  window.storage = {
    async get(key) { const v = localStorage.getItem(k(key)); if (v === null) throw new Error("not found"); return { key, value: v }; },
    async set(key, value) { localStorage.setItem(k(key), value); return { key, value }; },
    async delete(key) { localStorage.removeItem(k(key)); return { key, deleted: true }; },
  };
}
createRoot(document.getElementById("root")).render(<App />);
