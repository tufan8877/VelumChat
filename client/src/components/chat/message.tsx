import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@shared/schema";
import { decryptFileV2, decryptBytesWithEnvV2 } from "@/lib/crypto";
import { Check, CheckCheck, Clock } from "lucide-react";

function toMs(v: any): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}
function toBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return false;
}

function formatTime(ts: any) {
  const ms = toMs(ts);
  const d = new Date(ms || Date.now());
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTtl(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return formatTtl(s);
}

/**
 * ✅ Safe URL helper (FIXED)
 * We allow:
 * - absolute http/https URLs
 * - relative URLs starting with "/" (same-origin, e.g. /uploads/... or /api/...)
 * - blob: URLs (created locally)
 *
 * We still BLOCK: javascript:, data:, file:, etc.
 */
function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // allow relative same-origin paths
  if (s.startsWith("/")) return s;

  // allow blob URLs (local object URLs)
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
  const createdMs = useMemo(() => toMs(message.createdAt || Date.now()), [message.createdAt]);
  const expiresMs = useMemo(() => toMs(message.expiresAt), [message.expiresAt]);

  // ✅ Hard safety: if expired, render nothing (covers sender+receiver even if state didn't update)
  if (expiresMs && Date.now() >= expiresMs) return null;

  const time = useMemo(() => formatTime(createdMs), [createdMs]);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(message.fileName || null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [remaining, setRemaining] = useState<string | null>(null);

  // ✅ Show expiry label (so users know when it disappears)
  useEffect(() => {
    if (!expiresMs) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const left = expiresMs - Date.now();
      if (left <= 0) {
        setRemaining("0s");
        return;
      }
      setRemaining(formatRemaining(left));
    };

    tick();
    // Update every second (simple + clear)
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresMs]);

  // ✅ Decrypt encrypted file/image envelopes on the fly
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

  const renderBody = () => {
    // Text (React escapes content by default → XSS-safe)
    if (message.messageType === "text") {
      return <span className="break-words whitespace-pre-wrap">{message.content}</span>;
    }

    // Image
    if (message.messageType === "image") {
      const direct = safeUrl(message.content);
      const src = fileUrl || direct;

      if (!src) {
        return (
          <span className="text-sm opacity-80">{isDecrypting ? "Decrypting…" : "Image"}</span>
        );
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

    // File
    if (message.messageType === "file") {
      const direct = safeUrl(message.content);
      const href = fileUrl || direct;
      const name = fileName || "file";

      if (!href) {
        return (
          <span className="text-sm opacity-80">{isDecrypting ? "Decrypting…" : name}</span>
        );
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

    // Fallback: still XSS-safe (escaped)
    return <span className="break-words whitespace-pre-wrap">{message.content}</span>;
  };

  const isRead = Boolean(message?.isRead);
  const ReceiptIcon = isRead ? CheckCheck : Check;

  return (
    <div className={wrapperClass}>
      {!isOwn && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mr-2">
          <span className="text-muted-foreground text-sm font-semibold">{headerLetter}</span>
        </div>
      )}

      <div className={`max-w-[78%] md:max-w-[70%] px-4 py-2 ${bubbleClass}`}>
        {renderBody()}

        <div className={`mt-1 flex items-center gap-2 text-[11px] ${isOwn ? "text-white/80" : "text-muted-foreground"} justify-end`}>
          {remaining && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{remaining}</span>
            </span>
          )}

          <span>{time}</span>

          {isOwn && (
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${
                isRead ? "bg-white/25" : "bg-white/15"
              }`}
              title={isRead ? "Gelesen" : "Gesendet"}
            >
              <ReceiptIcon className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
