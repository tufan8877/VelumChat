// profile-protection.ts (SECURE VERSION)
// Private key is NEVER stored in cookies anymore.
// Backward compatible migration from old insecure cookie.

export interface SecureProfile {
  id: string;
  username: string;
  publicKey: string;
  privateKey: string;
  token?: string;
}

const COOKIE_NAME = "velum_profile";

function setSafeCookie(data: any) {
  const safeData = {
    id: data.id,
    username: data.username,
    publicKey: data.publicKey,
    token: data.token || null
  };

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(safeData)
  )}; path=/; SameSite=Strict; Secure`;
}

function deleteCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function saveProfile(profile: SecureProfile) {
  // Store private key only in localStorage + sessionStorage
  localStorage.setItem("velum_private_key", profile.privateKey);
  sessionStorage.setItem("velum_private_key", profile.privateKey);

  // Store public metadata in cookie
  setSafeCookie(profile);
}

export function loadProfile(): SecureProfile | null {
  const cookie = document.cookie
    .split("; ")
    .find(row => row.startsWith(COOKIE_NAME + "="));

  if (!cookie) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(cookie.split("=")[1]));

    // Migration: If old cookie had privateKey, move it to localStorage and delete
    if ((parsed as any).privateKey) {
      localStorage.setItem("velum_private_key", parsed.privateKey);
      sessionStorage.setItem("velum_private_key", parsed.privateKey);
      deleteCookie();
      setSafeCookie(parsed);
    }

    const privateKey =
      localStorage.getItem("velum_private_key") ||
      sessionStorage.getItem("velum_private_key");

    if (!privateKey) return null;

    return {
      ...parsed,
      privateKey
    };
  } catch {
    return null;
  }
}
