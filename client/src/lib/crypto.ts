// client/src/lib/crypto.ts
// VelumChat E2EE (client-side): Hybrid RSA-OAEP (key wrap) + AES-GCM (payload)
// - Works for long texts (RSA only wraps AES key)
// - Backwards compatible: if content isn't an envelope, it's treated as plaintext

export type EncryptedEnvelopeV2 =
  | {
      v: 2;
      kind: "text";
      alg: "RSA-OAEP+A256GCM";
      iv: string; // base64
      ct: string; // base64
      ekR: string; // base64 (AES key encrypted for receiver)
      ekS: string; // base64 (AES key encrypted for sender)
    }
  | {
      v: 2;
      kind: "file" | "image";
      alg: "RSA-OAEP+A256GCM";
      url: string; // encrypted bytes stored server-side
      iv: string; // base64
      ekR: string; // base64
      ekS: string; // base64
      name?: string;
      mime?: string;
      size?: number;
    };

const enc = new TextEncoder();
const dec = new TextDecoder();

function abToB64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToAb(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function stripPem(pem: string) {
  return pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const b64 = stripPem(pem);
  const keyData = b64ToAb(b64);
  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = stripPem(pem);
  const keyData = b64ToAb(b64);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// ✅ Generate RSA-OAEP keypair (for wrapping AES keys)
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyData = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKeyData = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const publicKey = `-----BEGIN PUBLIC KEY-----\n${abToB64(publicKeyData)}\n-----END PUBLIC KEY-----`;
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${abToB64(privateKeyData)}\n-----END PRIVATE KEY-----`;

  return { publicKey, privateKey };
}

async function genAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportAesRaw(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

async function importAesRaw(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function wrapAesKeyFor(pubKeyPem: string, aesKey: CryptoKey): Promise<string> {
  const pub = await importPublicKey(pubKeyPem);
  const raw = await exportAesRaw(aesKey);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, raw);
  return abToB64(wrapped);
}

async function unwrapAesKeyWith(privKeyPem: string, wrappedB64: string): Promise<CryptoKey> {
  const priv = await importPrivateKey(privKeyPem);
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64ToAb(wrappedB64));
  return importAesRaw(raw);
}

function tryParseEnvelope(content: string): EncryptedEnvelopeV2 | null {
  if (!content) return null;
  if (content[0] !== "{") return null;
  try {
    const obj = JSON.parse(content);
    if (obj && obj.v === 2 && obj.alg === "RSA-OAEP+A256GCM") return obj as EncryptedEnvelopeV2;
    return null;
  } catch {
    return null;
  }
}

// ✅ Encrypt text for receiver + sender (so both can decrypt later)
export async function encryptTextV2(params: {
  plaintext: string;
  receiverPublicKeyPem: string;
  senderPublicKeyPem: string;
}): Promise<string> {
  const aes = await genAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(params.plaintext));
  const ekR = await wrapAesKeyFor(params.receiverPublicKeyPem, aes);
  const ekS = await wrapAesKeyFor(params.senderPublicKeyPem, aes);

  const env: EncryptedEnvelopeV2 = {
    v: 2,
    kind: "text",
    alg: "RSA-OAEP+A256GCM",
    iv: abToB64(iv.buffer),
    ct: abToB64(ct),
    ekR,
    ekS,
  };
  return JSON.stringify(env);
}

export async function decryptTextV2(params: {
  content: string;
  privateKeyPem: string;
}): Promise<string> {
  const env = tryParseEnvelope(params.content);
  if (!env) return params.content; // plaintext/backward
  if (env.kind !== "text") return params.content;

  // Prefer ekR, fallback ekS
  const wrapped = (env as any).ekR || (env as any).ekS;
  const aes = await unwrapAesKeyWith(params.privateKeyPem, wrapped);
  const iv = new Uint8Array(b64ToAb(env.iv));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, b64ToAb(env.ct));
  return dec.decode(pt);
}

// ✅ Encrypt file bytes; returns { envelopeJson, encryptedBytes }
export async function encryptFileV2(params: {
  bytes: ArrayBuffer;
  receiverPublicKeyPem: string;
  senderPublicKeyPem: string;
  kind: "file" | "image";
  name?: string;
  mime?: string;
  size?: number;
}): Promise<{ envelope: Omit<Extract<EncryptedEnvelopeV2, { kind: "file" | "image" }>, "url">; encryptedBytes: ArrayBuffer }> {
  const aes = await genAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, params.bytes);

  const ekR = await wrapAesKeyFor(params.receiverPublicKeyPem, aes);
  const ekS = await wrapAesKeyFor(params.senderPublicKeyPem, aes);

  const env = {
    v: 2 as const,
    kind: params.kind,
    alg: "RSA-OAEP+A256GCM" as const,
    iv: abToB64(iv.buffer),
    ekR,
    ekS,
    name: params.name,
    mime: params.mime,
    size: params.size,
  };

  return { envelope: env, encryptedBytes: ct };
}

export async function decryptFileV2(params: {
  envJson: string;
  privateKeyPem: string;
}): Promise<{ url: string; kind: "file" | "image"; name?: string; mime?: string; size?: number } | null> {
  const env = tryParseEnvelope(params.envJson);
  if (!env) return null;
  if (env.kind !== "file" && env.kind !== "image") return null;
  if (!("url" in env)) return null;
  // actual decrypt is done after fetching bytes, see decryptBytesWithEnvV2
  return { url: env.url, kind: env.kind, name: env.name, mime: env.mime, size: env.size };
}

export async function decryptBytesWithEnvV2(params: {
  envJson: string;
  encryptedBytes: ArrayBuffer;
  privateKeyPem: string;
}): Promise<ArrayBuffer | null> {
  const env = tryParseEnvelope(params.envJson);
  if (!env) return null;
  if (env.kind !== "file" && env.kind !== "image") return null;

  const wrapped = (env as any).ekR || (env as any).ekS;
  const aes = await unwrapAesKeyWith(params.privateKeyPem, wrapped);
  const iv = new Uint8Array(b64ToAb(env.iv));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, params.encryptedBytes);
  return pt;
}

// ---------------------------------------------------------------------
// Backwards-compat helpers (old RSA-only functions)
// ---------------------------------------------------------------------
export async function encryptMessage(message: string, publicKeyPem: string): Promise<string> {
  // Old API now just produces a V2 envelope **without** sender copy.
  // Prefer encryptTextV2 in new code.
  const aes = await genAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(message));
  const ek = await wrapAesKeyFor(publicKeyPem, aes);
  const env = {
    v: 2,
    kind: "text",
    alg: "RSA-OAEP+A256GCM",
    iv: abToB64(iv.buffer),
    ct: abToB64(ct),
    ekR: ek,
    ekS: ek,
  } satisfies EncryptedEnvelopeV2;
  return JSON.stringify(env);
}

export async function decryptMessage(encryptedMessage: string, privateKeyPem: string): Promise<string> {
  return decryptTextV2({ content: encryptedMessage, privateKeyPem });
}
