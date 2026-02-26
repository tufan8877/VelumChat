/**
 * SESSION PERSISTENCE SYSTEM (HARDENED)
 * Ensures user profiles survive reloads WITHOUT leaking private keys into cookies.
 *
 * IMPORTANT:
 * - This module no longer writes full profiles (with privateKey) into cookies.
 * - It keeps the previous API/behavior for localStorage 'user' but expects that
 *   ProfileProtection may store metadata-only profiles when encrypted vault is enabled.
 */

interface UserProfile {
  id: number;
  username: string;
  publicKey: string;
  privateKey?: string;
}

type StoredProfile = Omit<UserProfile, "privateKey"> & { privateKey?: string };

class SessionPersistence {
  private static instance: SessionPersistence;
  private profiles: Map<string, StoredProfile> = new Map();
  private isInitialized = false;

  static getInstance(): SessionPersistence {
    if (!SessionPersistence.instance) {
      SessionPersistence.instance = new SessionPersistence();
    }
    return SessionPersistence.instance;
  }

  initialize() {
    if (this.isInitialized) return;

    console.log("🔧 Initializing session persistence system...");

    this.installGlobalProtection();
    this.loadExistingProfiles();
    this.startPeriodicVerification();

    this.isInitialized = true;
    console.log("✅ Session persistence system initialized");
  }

  private installGlobalProtection() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);

    // Enhanced setItem that creates backups (NO COOKIES)
    localStorage.setItem = (key: string, value: string) => {
      if (key === "user") {
        try {
          const profile = JSON.parse(value) as StoredProfile;
          console.log(`🛡️ PROTECTION: Storing profile backups: ${profile.username}`);

          // Store in memory (may be metadata-only)
          this.profiles.set(profile.username, profile);

          // Store in sessionStorage
          sessionStorage.setItem("user_backup", value);

          // SECURITY: no cookies, no plaintext privateKey storage outside local/session
          // If you need encrypted-at-rest storage, use profileProtection.enableEncryptedVault()

          // Store metadata-only in IndexedDB (optional, safe)
          this.storeMetaInIndexedDB({
            id: profile.id,
            username: profile.username,
            publicKey: profile.publicKey,
          });
        } catch (error) {
          console.log("⚠️ Failed to parse user profile for backup");
        }
      }
      return originalSetItem(key, value);
    };

    // Enhanced getItem that recovers from backups
    localStorage.getItem = (key: string) => {
      const result = originalGetItem(key);

      if (key === "user" && !result) {
        console.log("🔍 RECOVERY: Profile missing, attempting recovery...");
        const recovered = this.recoverProfile();
        if (recovered) {
          console.log(`✅ RECOVERY: Profile recovered: ${recovered.username}`);
          originalSetItem("user", JSON.stringify(recovered));
          return JSON.stringify(recovered);
        }
      }

      return result;
    };

    localStorage.removeItem = (key: string) => {
      if (key === "user") {
        console.log("🚫 BLOCKED: Attempt to remove user profile");
        return;
      }
      return originalRemoveItem(key);
    };

    localStorage.clear = () => {
      console.log("🛡️ PROTECTION: localStorage.clear() called, preserving user profile");
      const userData = originalGetItem("user");
      originalClear();
      if (userData) {
        originalSetItem("user", userData);
        console.log("✅ User profile preserved during clear");
      }
    };

    console.log("🛡️ Global localStorage protection installed (no cookies)");
  }

  private loadExistingProfiles() {
    const localData = localStorage.getItem("user");
    if (localData) {
      try {
        const profile = JSON.parse(localData) as StoredProfile;
        this.profiles.set(profile.username, profile);
        console.log(`📋 Loaded existing profile: ${profile.username}`);
      } catch {
        console.log("⚠️ Corrupted localStorage profile");
      }
    }

    const sessionData = sessionStorage.getItem("user_backup");
    if (sessionData && !localData) {
      try {
        const profile = JSON.parse(sessionData) as StoredProfile;
        this.profiles.set(profile.username, profile);
        localStorage.setItem("user", sessionData);
        console.log(`📋 Recovered profile from sessionStorage: ${profile.username}`);
      } catch {
        console.log("⚠️ Corrupted sessionStorage profile");
      }
    }
  }

  private recoverProfile(): StoredProfile | null {
    // Try memory first
    if (this.profiles.size > 0) {
      const profile = Array.from(this.profiles.values())[0];
      console.log(`🔄 Recovered from memory: ${profile.username}`);
      return profile;
    }

    // Try sessionStorage
    const sessionData = sessionStorage.getItem("user_backup");
    if (sessionData) {
      try {
        const profile = JSON.parse(sessionData) as StoredProfile;
        console.log(`🔄 Recovered from sessionStorage: ${profile.username}`);
        return profile;
      } catch {
        console.log("⚠️ sessionStorage recovery failed");
      }
    }

    // SECURITY: cookies removed
    console.log("❌ No profile recovery source available");
    return null;
  }

  private storeMetaInIndexedDB(meta: { id: number; username: string; publicKey: string }) {
    if (!window.indexedDB) return;
    try {
      const request = indexedDB.open("VelumChatProfiles", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "username" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["profiles"], "readwrite");
        const store = transaction.objectStore("profiles");
        store.put(meta);
        // silent
      };
    } catch {
      // ignore
    }
  }

  private startPeriodicVerification() {
    setInterval(() => {
      const currentProfile = localStorage.getItem("user");
      if (!currentProfile && this.profiles.size > 0) {
        console.log("🚨 Profile disappeared, attempting recovery...");
        const recovered = this.recoverProfile();
        if (recovered) {
          localStorage.setItem("user", JSON.stringify(recovered));
          console.log(`✅ Profile automatically recovered: ${recovered.username}`);
        }
      }
    }, 1000);
  }
}

// Auto-initialize when module loads
if (typeof window !== "undefined") {
  const sessionPersistence = SessionPersistence.getInstance();
  sessionPersistence.initialize();
}

export { SessionPersistence };
