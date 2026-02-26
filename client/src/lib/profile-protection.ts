/**
 * WICKR-ME-STYLE PROFILE PROTECTION (HARDENED)
 * - Removes privateKey from cookies entirely
 * - Adds optional "Signal-level" encrypted-at-rest vault for private keys (PIN/passphrase)
 * - Backward compatible: legacy plaintext storage still loads, and can be migrated to vault when you set a PIN
 *
 * How to use Signal-level vault:
 *   await profileProtection.enableEncryptedVault(profile, pin)
 *   // on next reload/login:
 *   await profileProtection.unlockPrivateKey(profile.username, pin)
 *   const profile = await profileProtection.retrieveProfile(profile.username) // now includes privateKey
 */

interface UserProfile {
  id: number;
  username: string;
  publicKey: string;
  privateKey: string;
}

type StoredProfile = Omit<UserProfile, "privateKey"> & { privateKey?: string };

type EncryptedPrivateKeyBlobV1 = {
  v: 1;
  alg: "PBKDF2-SHA256+A256GCM";
  iters: number;
  salt_b64: string;
  iv_b64: string;
  ct_b64: string;
};

const USER_KEY = "user";
const USER_BACKUP_KEY = "user_backup";
const UNLOCK_PREFIX = "velum_unlocked_privateKey_";
const VAULT_LS_KEY_PREFIX = "velum_vault_"; // fallback if IndexedDB unavailable

const PBKDF2_ITERS = 310_000; // strong default; adjust if you need faster on low-end devices
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveAesKeyFromPin(pin: string, salt: Uint8Array, iters: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPrivateKey(privateKeyPem: string, pin: string): Promise<EncryptedPrivateKeyBlobV1> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyFromPin(pin, salt, PBKDF2_ITERS);

  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKeyPem)
  );

  return {
    v: 1,
    alg: "PBKDF2-SHA256+A256GCM",
    iters: PBKDF2_ITERS,
    salt_b64: b64(salt),
    iv_b64: b64(iv),
    ct_b64: b64(ct),
  };
}

async function decryptPrivateKey(blob: EncryptedPrivateKeyBlobV1, pin: string): Promise<string> {
  const salt = unb64(blob.salt_b64);
  const iv = unb64(blob.iv_b64);
  const ct = unb64(blob.ct_b64);
  const key = await deriveAesKeyFromPin(pin, salt, blob.iters);

  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );
  return decoder.decode(pt);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function deleteCookieStartsWith(prefix: string) {
  if (!isBrowser()) return;
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    const eq = cookie.indexOf("=");
    const name = eq >= 0 ? cookie.substring(0, eq) : cookie;
    if (name.startsWith(prefix)) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }
}

async function idbGet(dbName: string, storeName: string, key: string): Promise<any | null> {
  if (!isBrowser() || !("indexedDB" in window)) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result ?? null);
      getReq.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function idbSet(dbName: string, storeName: string, key: string, value: any): Promise<boolean> {
  if (!isBrowser() || !("indexedDB" in window)) return false;
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      const putReq = store.put(value, key);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = () => resolve(false);
    };
    req.onerror = () => resolve(false);
  });
}

class ProfileProtection {
  private static instance: ProfileProtection;
  private profiles: Map<string, StoredProfile> = new Map();

  static getInstance(): ProfileProtection {
    if (!ProfileProtection.instance) ProfileProtection.instance = new ProfileProtection();
    return ProfileProtection.instance;
  }

  /**
   * Legacy store (keeps compatibility): still stores full profile in local/session,
   * BUT DOES NOT store privateKey in cookies anymore.
   *
   * If you want "Signal-level" encrypted-at-rest storage, call enableEncryptedVault().
   */
  storeProfile(profile: UserProfile): void {
    if (!isBrowser()) return;
    console.log("🛡️ PROFILE: Storing profile:", profile.username);

    // Store in localStorage (legacy behavior)
    localStorage.setItem(USER_KEY, JSON.stringify(profile));

    // Store in memory backup
    this.profiles.set(profile.username, profile);

    // Store in sessionStorage as backup
    sessionStorage.setItem(USER_BACKUP_KEY, JSON.stringify(profile));

    // SECURITY: NEVER store privateKey in cookies
    // But do cleanup of any old insecure cookies that might still exist:
    deleteCookieStartsWith("user_profile_");

    console.log("✅ Profile stored in localStorage + sessionStorage + memory (no cookies)");
  }

  /**
   * Enable encrypted-at-rest vault for the private key using a user PIN/passphrase.
   * This will:
   *  - encrypt privateKey and store it in IndexedDB (fallback localStorage)
   *  - store ONLY public metadata in localStorage/sessionStorage backups (no privateKey)
   *  - keep decrypted privateKey only in sessionStorage (until tab/browser closed)
   */
  async enableEncryptedVault(profile: UserProfile, pin: string): Promise<void> {
    if (!isBrowser()) return;

    if (!pin || pin.length < 6) {
      throw new Error("PIN too short. Use at least 6 characters.");
    }

    const blob = await encryptPrivateKey(profile.privateKey, pin);

    const ok = await idbSet("VelumChatVault", "privateKeys", profile.username, blob);
    if (!ok) {
      localStorage.setItem(VAULT_LS_KEY_PREFIX + profile.username, JSON.stringify(blob));
    }

    // Store metadata only (no privateKey) to reduce exposure
    const meta: StoredProfile = { id: profile.id, username: profile.username, publicKey: profile.publicKey };
    localStorage.setItem(USER_KEY, JSON.stringify(meta));
    sessionStorage.setItem(USER_BACKUP_KEY, JSON.stringify(meta));
    this.profiles.set(profile.username, meta);

    // Keep decrypted key only for current session
    sessionStorage.setItem(UNLOCK_PREFIX + profile.username, profile.privateKey);

    // Cleanup any old insecure cookies
    deleteCookieStartsWith("user_profile_");
    // Cleanup legacy plaintext profile copies if they might exist elsewhere
    // (Optional; keep localStorage USER_KEY as meta already)
    console.log("🔐 Encrypted vault enabled for:", profile.username);
  }

  /**
   * Unlocks the encrypted private key into sessionStorage (RAM-like persistence per session).
   */
  async unlockPrivateKey(username: string, pin: string): Promise<boolean> {
    if (!isBrowser()) return false;

    const blob =
      (await idbGet("VelumChatVault", "privateKeys", username)) ??
      (() => {
        const raw = localStorage.getItem(VAULT_LS_KEY_PREFIX + username);
        return raw ? (JSON.parse(raw) as EncryptedPrivateKeyBlobV1) : null;
      })();

    if (!blob) return false;

    try {
      const pk = await decryptPrivateKey(blob as EncryptedPrivateKeyBlobV1, pin);
      sessionStorage.setItem(UNLOCK_PREFIX + username, pk);
      return true;
    } catch (e) {
      return false;
    }
  }

  hasEncryptedVault(username: string): boolean {
    if (!isBrowser()) return false;
    if (localStorage.getItem(VAULT_LS_KEY_PREFIX + username)) return true;
    // IndexedDB check is async; we keep sync false here. Caller can attempt unlock.
    return false;
  }

  /**
   * Retrieve profile.
   * - If encrypted vault is enabled, you must unlockPrivateKey() first (or pass pin to retrieveProfile).
   * - Backward compatible: legacy profiles with privateKey in local/session will still load.
   */
  async retrieveProfile(username?: string, pin?: string): Promise<UserProfile | null> {
    if (!isBrowser()) return null;

    console.log("🔍 PROFILE: Searching for profile...");

    // 1) localStorage
    const localData = localStorage.getItem(USER_KEY);
    if (localData) {
      try {
        const parsed = JSON.parse(localData) as StoredProfile;

        // If legacy profile includes privateKey, return it
        if (typeof (parsed as any).privateKey === "string" && (parsed as any).privateKey.length > 0) {
          console.log("✅ Found legacy profile in localStorage:", parsed.username);
          return parsed as UserProfile;
        }

        // Encrypted-vault path: try unlocked private key
        const u = parsed.username || username;
        if (u) {
          const unlocked = sessionStorage.getItem(UNLOCK_PREFIX + u);
          if (unlocked) {
            return { ...(parsed as any), username: u, privateKey: unlocked } as UserProfile;
          }

          // If caller provided pin, try to unlock now
          if (pin) {
            const ok = await this.unlockPrivateKey(u, pin);
            if (ok) {
              const pk = sessionStorage.getItem(UNLOCK_PREFIX + u);
              if (pk) return { ...(parsed as any), username: u, privateKey: pk } as UserProfile;
            }
          }
        }

        console.log("🔐 Profile metadata found, but privateKey is locked. Call unlockPrivateKey().");
        return null;
      } catch {
        console.log("⚠️ localStorage profile corrupted");
      }
    }

    // 2) memory backup (meta only or legacy)
    if (username && this.profiles.has(username)) {
      const p = this.profiles.get(username)!;
      console.log("✅ Found profile in memory backup:", p.username);

      // If we have unlocked key, return full profile
      const unlocked = sessionStorage.getItem(UNLOCK_PREFIX + username);
      if (unlocked) return { ...(p as any), privateKey: unlocked } as UserProfile;

      // legacy memory profile might already include privateKey
      if ((p as any).privateKey) return p as UserProfile;

      return null;
    }

    // 3) sessionStorage backup
    const sessionData = sessionStorage.getItem(USER_BACKUP_KEY);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData) as StoredProfile;
        const u = parsed.username || username;
        if (u) {
          const unlocked = sessionStorage.getItem(UNLOCK_PREFIX + u);
          if (unlocked) {
            localStorage.setItem(USER_KEY, JSON.stringify(parsed)); // restore metadata
            return { ...(parsed as any), username: u, privateKey: unlocked } as UserProfile;
          }
          if ((parsed as any).privateKey) {
            localStorage.setItem(USER_KEY, JSON.stringify(parsed));
            return parsed as UserProfile;
          }
        }
      } catch {
        console.log("⚠️ sessionStorage backup corrupted");
      }
    }

    // 4) SECURITY: cookies are no longer used for profile recovery
    // Cleanup any old insecure cookies in case they exist
    deleteCookieStartsWith("user_profile_");

    console.log("❌ No usable (unlocked) profile found");
    return null;
  }

  // Install protection against localStorage clearing
  installProtection(): void {
    if (!isBrowser()) return;

    console.log("🛡️ Installing localStorage protection (safe mode)...");

    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    localStorage.removeItem = function (key: string) {
      if (key === USER_KEY) {
        console.log("🚫 PROTECTION: Blocked attempt to remove user profile");
        return;
      }
      return originalRemoveItem(key);
    };

    localStorage.clear = function () {
      console.log("🚫 PROTECTION: Blocked localStorage.clear(), preserving profile metadata");
      const userData = localStorage.getItem(USER_KEY);
      originalClear();
      if (userData) {
        localStorage.setItem(USER_KEY, userData);
        console.log("✅ Profile metadata restored after clear attempt");
      }
    };

    console.log("✅ localStorage protection installed");
  }
}

export const profileProtection = ProfileProtection.getInstance();

if (typeof window !== "undefined") {
  profileProtection.installProtection();
}
