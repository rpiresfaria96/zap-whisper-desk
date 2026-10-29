import { useEffect, useState } from "react";

const OPERATOR_KEY = "ideal-zap:operator-name-v1";

/** This is a local display name, NOT a login or authenticated account. */
export function normalizeOperatorName(input: string): string {
  return input.trim().replace(/\s+/g, " ").replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 40);
}

export function signOutgoingMessage(message: string, name: string): string {
  const clean = normalizeOperatorName(name);
  if (!clean) return message;
  const trimmed = message.trim();
  return trimmed ? `${trimmed}\n\n— ${clean}` : `— ${clean}`;
}

export function useOperator() {
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { setName(normalizeOperatorName(localStorage.getItem(OPERATOR_KEY) || "")); }
    catch { /* private browsing: name applies only while the tab is open */ }
    setLoaded(true);
  }, []);
  function save(input: string) {
    const value = normalizeOperatorName(input);
    if (value.length < 2) return false;
    setName(value);
    try { localStorage.setItem(OPERATOR_KEY, value); } catch {}
    return true;
  }
  return { name, loaded, save };
}
