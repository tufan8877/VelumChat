import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@shared/schema";
import { decryptFileV2, decryptBytesWithEnvV2 } from "@/lib/crypto";

function toMs(v: any): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}
function formatTime(ts: any) {
  const d = new Date(toMs(ts));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Only allow http/https URLs for remote loads (prevents javascript:, data:, etc.)
 * - blob: URLs are produced locally by createObjectURL and are allowed separately.
 */
function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
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
  const time = useMemo(
    () => formatTime(message.createdAt || Date.now()),
    [message.createdAt]
  );

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(message.fileName || null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // ✅ Decrypt encrypted file/image envelopes on the fly
  useEffect(() => {
    let alive = true;
    let revokeUrl: string | null = null;

    const run = async () => {
      setFileUrl(null);
      setFileMime(null);
      setFileName(message.fileName || null);

      const priv = currentUser?.privateKey as string | undefined;
      if (!priv) return;

      if (message.messageType !== "image" && message.messageType !== "file") return;
      if (typeof message.content !== "string" || message.content.trim()[0] !== "{") return;

      try {
        const meta = await decryptFileV2({ envJson: message.content, privateKeyPem: priv });
        const remoteUrl = safeHttpUrl(meta?.url);
        if (!remoteUrl) return;

        setIsDecrypting(true);

        // NOTE: credentials include only makes sense for your own domain;
        // keep it for existing behavior, but we now hard-restrict to http/https URLs.
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
        setFileMime(mime);
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
      const remote = safeHttpUrl(message.content);
      const src = fileUrl || remote;
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
      const remote = safeHttpUrl(message.content);
      const href = fileUrl || remote;
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

  return (
    <div className={wrapperClass}>
      {!isOwn && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mr-2">
          <span className="text-muted-foreground text-sm font-semibold">{headerLetter}</span>
        </div>
      )}

      <div className={`max-w-[78%] md:max-w-[70%] px-4 py-2 ${bubbleClass}`}>
        {renderBody()}
        <div className={`mt-1 text-[11px] ${isOwn ? "text-white/80" : "text-muted-foreground"} text-right`}>
          {time}
        </div>
      </div>
    </div>
  );
}
