// session-persistence.ts (SECURE VERSION)
// No private key persistence in cookies.
// Only memory + session/local storage.

export function persistPrivateKey(privateKey: string) {
  localStorage.setItem("velum_private_key", privateKey);
  sessionStorage.setItem("velum_private_key", privateKey);
}

export function getPrivateKey(): string | null {
  return (
    sessionStorage.getItem("velum_private_key") ||
    localStorage.getItem("velum_private_key")
  );
}

export function clearPrivateKey() {
  localStorage.removeItem("velum_private_key");
  sessionStorage.removeItem("velum_private_key");
}
