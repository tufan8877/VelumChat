import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@shared/schema";
import { decryptFileV2, decryptBytesWithEnvV2 } from "@/lib/crypto";

function toMs(v: any): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatTime(ts: any) {
  const d = new Date(toMs(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTtl(msRemaining: number): string {
  if (!Number.isFinite(msRemaining)) return "";
  const s = Math.max(0, Math.ceil(msRemaining / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.ceil(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.ceil(h / 24);
  return `${d}d`;
}

/**
 * ✅ Safe URL helper
 * Allow:
 * - absolute http/https URLs
 * - relative URLs starting with "/" (same-origin, e.g. /uploads/..., /api/...)
 * - blob: URLs
 * Block:
 * - javascript:, data:, file:, etc.
 */
function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  if (s.startsWith("/")) return s;
  if (s.startsWith("blob:")) return s;

  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

type Msg = {
  id: number;
  senderId: number;
  receiverId: number;
  chatId: number;
  content: string;
  messageType: string;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt?: any;
  expiresAt?: any;
  destructTimer?: number | null;
  isRead?: boolean | any;
};

function CheckIcon({ double, filled }: { double: boolean; filled: boolean }) {
  // simple inline icon; avoids dependencies
  const cls = filled ? "bg-white/20" : "bg-transparent border border-white/35";
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${cls}`}
      aria-label={double ? "read" : "sent"}
      title={double ? "Gelesen" : "Versendet"}
    >
      <span className="text-[10px] leading-none select-none">
        {double ? "✓✓" : "✓"}
      </span>
    </span>
  );
}

export default function Message({
  message,
  isOwn,
  otherUser,
  currentUser,
}: {
  message: Msg;
  isOwn: boolean;
  otherUser: User;
  currentUser: any;
}) {
  const createdAtMs = useMemo(() => toMs(message.createdAt) || Date.now(), [message.createdAt]);
  const expiresAtMs = useMemo(() => toMs(message.expiresAt), [message.expiresAt]);
  const [now, setNow] = useState(Date.now());

  // Live countdown re-render (cheap, only per message bubble)
  useEffect(() => {
    if (!expiresAtMs) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [expiresAtMs]);

  const isExpired = expiresAtMs ? now >= expiresAtMs : false;
  if (isExpired) return null;

  const time = useMemo(() => formatTime(createdAtMs), [createdAtMs]);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(message.fileName || null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // ✅ Decrypt encrypted file/image envelopes on the fly (if content is env JSON)
  useEffect(() => {
    let alive = true;
    let revokeUrl: string | null = null;

    const run = async () => {
      setFileUrl(null);
      setFileName(message.fileName || null);

      const priv = currentUser?.privateKey as string | undefined;
      if (!priv) return;

      if (message.messageType !== "image" && message.messageType !== "file") return;
      if (typeof message.content !== "string" || message.content.trim()[0] !== "{") return;

      try {
        const meta = await decryptFileV2({ envJson: message.content, privateKeyPem: priv });
        const remoteUrl = safeUrl(meta?.url);
        if (!remoteUrl) return;

        setIsDecrypting(true);

        const resp = await fetch(remoteUrl, { credentials: "include" });
        if (!resp.ok) return;

        const buf = await resp.arrayBuffer();
        const plain = await decryptBytesWithEnvV2({
          envJson: message.content,
          encryptedBytes: buf,
          privateKeyPem: priv,
        });
        if (!plain) return;

        const mime =
          meta?.mime || (meta?.kind === "image" ? "image/*" : "application/octet-stream");
        const name =
          meta?.name || message.fileName || (meta?.kind === "image" ? "image" : "file");

        const blob = new Blob([plain], { type: mime });
        const url = URL.createObjectURL(blob);
        revokeUrl = url;

        if (!alive) return;
        setFileName(name);
        setFileUrl(url);
      } catch {
        // ignore
      } finally {
        if (alive) setIsDecrypting(false);
      }
    };

    run();

    return () => {
      alive = false;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.content, message.messageType, currentUser?.privateKey]);

  const bubbleClass = isOwn
    ? "bg-blue-600 text-white ml-auto rounded-2xl rounded-tr-md"
    : "bg-muted/30 border border-border/40 text-foreground mr-auto rounded-2xl rounded-tl-md";

  const wrapperClass = isOwn ? "flex justify-end" : "flex justify-start";
  const headerLetter = (otherUser?.username || "U").charAt(0).toUpperCase();

  const ttlLabel = useMemo(() => {
    if (!expiresAtMs) return "";
    return formatTtl(expiresAtMs - now);
  }, [expiresAtMs, now]);

  const isRead = Boolean(message.isRead);

  const renderBody = () => {
    if (message.messageType === "text") {
      return <span className="break-words whitespace-pre-wrap">{message.content}</span>;
    }

    if (message.messageType === "image") {
      const direct = safeUrl(message.content);
      const src = fileUrl || direct;
      if (!src) {
        return <span className="text-sm opacity-80">{isDecrypting ? "Decrypting…" : "Image"}</span>;
      }
      return (
        <img
          src={src}
          alt="image"
          className="max-w-[240px] md:max-w-[320px] rounded-xl border border-border/40"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }

    if (message.messageType === "file") {
      const direct = safeUrl(message.content);
      const href = fileUrl || direct;
      const name = fileName || "file";
      if (!href) {
        return <span className="text-sm opacity-80">{isDecrypting ? "Decrypting…" : name}</span>;
      }
      return (
        <a
          href={href}
          download={name}
          className={isOwn ? "underline underline-offset-2" : "text-blue-300 underline underline-offset-2"}
          target="_blank"
          rel="noopener noreferrer"
        >
          {name}
        </a>
      );
    }

    return <span className="break-words whitespace-pre-wrap">{message.content}</span>;
  };

  return (
    <div className={wrapperClass}>
      {!isOwn && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mr-2">
          <span className="text-muted-foreground text-sm font-semibold">{headerLetter}</span>
        </div>
      )}

      <div className={`max-w-[78%] md:max-w-[70%] px-4 py-2 ${bubbleClass}`}>
        {renderBody()}

        <div className={`mt-1 flex items-center gap-2 text-[11px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}>
          {ttlLabel ? <span title="Selbstzerstörung">{`⏳ ${ttlLabel}`}</span> : null}
          <span className="ml-auto flex items-center gap-2">
            <span>{time}</span>
            {isOwn ? <CheckIcon double={isRead} filled={isRead} /> : null}
          </span>
        </div>
      </div>
    </div>
  );
}
