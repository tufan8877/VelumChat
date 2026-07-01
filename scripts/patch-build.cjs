const fs = require('fs');

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    source = source.replace(from, to);
  }
  fs.writeFileSync(path, source);
}

patchFile('client/src/components/chat/chat-view.tsx', [
  ['useState("300")', 'useState("604800")'],
  ['Number.isFinite(s) ? s : 300', 'Number.isFinite(s) ? s : 604800'],
  ['>1 week<', '>7 days<'],
]);

patchFile('client/src/hooks/use-persistent-chats.ts', [
  ['if (m.receiverId !== userId) return;', 'if (Number(m.receiverId) !== Number(userId)) return;'],
  ['const chatExists = contactsRef.current?.some((c) => c.id === m.chatId);', 'm.chatId = Number(m.chatId);\n        m.senderId = Number(m.senderId);\n        m.receiverId = Number(m.receiverId);\n\n        const chatExists = contactsRef.current?.some((c) => Number(c.id) === Number(m.chatId));'],
  ['  // initial load\n  useEffect(() => {', '  // ✅ Background sync fallback: if WebSocket misses an event, update without manual reload.\n  useEffect(() => {\n    if (!userId) return;\n\n    const sync = () => {\n      refreshContactsSilently().catch(() => {});\n      const chatId = selectedChat?.id;\n      if (chatId) loadActiveMessages(chatId).catch(() => {});\n    };\n\n    const interval = window.setInterval(sync, selectedChat?.id ? 2000 : 5000);\n\n    const onFocus = () => sync();\n    const onVisibility = () => {\n      if (document.visibilityState === "visible") sync();\n    };\n\n    window.addEventListener("focus", onFocus);\n    document.addEventListener("visibilitychange", onVisibility);\n\n    return () => {\n      window.clearInterval(interval);\n      window.removeEventListener("focus", onFocus);\n      document.removeEventListener("visibilitychange", onVisibility);\n    };\n  }, [userId, selectedChat?.id, refreshContactsSilently, loadActiveMessages]);\n\n  // initial load\n  useEffect(() => {'],
]);

patchFile('server/routes.ts', [
  ['if (t > 100000) t = Math.floor(t / 1000);', 'if (t > 7 * 24 * 60 * 60 * 1000) t = Math.floor(t / 1000);'],
  ['if (origin && !(sameHost || allowedOrigins.has(origin))) {', 'if (origin && !(sameHost || allowedOrigins.has(origin) || origin.endsWith(".onrender.com"))) {'],
]);
