import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";
import Message from "./message";
import {
  Paperclip,
  Send,
  Smile,
  Lock,
  Clock,
  MoreVertical,
  Shield,
  ArrowLeft,
  Trash2,
  UserX,
} from "lucide-react";
import type { User, Chat, Message as MessageType } from "@shared/schema";

interface ChatViewProps {
  currentUser: User;
  selectedChat: (Chat & { otherUser: User }) | null;
  messages: MessageType[];
  onSendMessage: (content: string, type: string, destructTimerSeconds: number, file?: File) => void;
  onTyping: (isTyping: boolean) => void;
  isOtherTyping: boolean;
  isConnected: boolean;
  onBackToList: () => void;

  onDeleteChat: (chatId: number) => Promise<void> | void;
  onBlockUser: (userId: number) => Promise<void> | void;
}

// iOS/Safari helper (prevents smooth-scroll flicker when keyboard is open)
const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
};

export default function ChatView({
  currentUser,
  selectedChat,
  messages,
  onSendMessage,
  onTyping,
  isOtherTyping,
  isConnected,
  onBackToList,
  onDeleteChat,
  onBlockUser,
}: ChatViewProps) {
  const [messageInput, setMessageInput] = useState("");
  const [destructTimer, setDestructTimer] = useState("300");

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localTypingRef = useRef(false);
  const typingIdleTimerRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);

  const { t } = useLanguage();

  // ----------------------------
  // ✅ Expiring messages (client-side hide)
  // Server deletes them periodically, but UI should also hide them immediately when expired.
  // ----------------------------
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const visibleMessages = useMemo(() => {
    const now = nowTick;
    return (messages || []).filter((m: any) => {
      if (!m) return false;
      const exp = (m as any).expiresAt;
      if (!exp) return true;
      const expMs = new Date(exp).getTime();
      return Number.isFinite(expMs) ? expMs > now : true;
    });
  }, [messages, nowTick]);

  // ----------------------------
  // ✅ Scroll helpers
  // ----------------------------
  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return distance < 220;
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;

    const useSmooth = smooth && !isIOS();

    try {
      el.scrollTo({ top: el.scrollHeight, behavior: useSmooth ? "smooth" : "auto" });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  // Only autoscroll when a NEW message arrives
  const lastMsgId = visibleMessages.length ? (visibleMessages[visibleMessages.length - 1] as any).id : null;

  useEffect(() => {
    if (!selectedChat) return;
    if (!lastMsgId) return;

    if (isNearBottom()) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id, lastMsgId]);

  useEffect(() => {
    if (isOtherTyping && isNearBottom()) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtherTyping]);

  // ----------------------------
  // ✅ Mobile keyboard / VisualViewport fix
  // Ensures the composer stays visible and the list scroll area accounts for keyboard height.
  // ----------------------------
  const [composerHeight, setComposerHeight] = useState(120);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (h && Math.abs(h - composerHeight) > 1) setComposerHeight(h);
    });
    ro.observe(el);

    const h0 = el.getBoundingClientRect().height;
    if (h0) setComposerHeight(h0);

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const calc = () => {
      const offset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardOffset(offset);
    };

    calc();
    vv.addEventListener("resize", calc);
    vv.addEventListener("scroll", calc);
    window.addEventListener("orientationchange", calc);

    return () => {
      vv.removeEventListener("resize", calc);
      vv.removeEventListener("scroll", calc);
      window.removeEventListener("orientationchange", calc);
    };
  }, []);

  const handleFocus = () => {
    if (isNearBottom()) requestAnimationFrame(() => scrollToBottom(false));
  };

  // ----------------------------
  // Timer helpers
  // ----------------------------
  const getTimerSeconds = () => {
    const s = parseInt(destructTimer, 10);
    return Number.isFinite(s) ? s : 300;
  };

  const sendTypingSafe = (state: boolean) => {
    if (!isConnected || !selectedChat) return;
    try {
      onTyping(state);
    } catch {}
  };

  const stopTyping = () => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (localTypingRef.current) {
      localTypingRef.current = false;
      sendTypingSafe(false);
    }
  };

  const startOrRefreshTyping = () => {
    const now = Date.now();
    if (!localTypingRef.current || now - typingThrottleRef.current > 2000) {
      localTypingRef.current = true;
      typingThrottleRef.current = now;
      sendTypingSafe(true);
    }
  };

  const handleInputChange = (v: string) => {
    setMessageInput(v);

    if (!selectedChat || !isConnected) return;

    const hasText = v.trim().length > 0;
    if (!hasText) {
      stopTyping();
      return;
    }

    startOrRefreshTyping();

    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => stopTyping(), 1200);
  };

  useEffect(() => {
    stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!text || !selectedChat) return;

    if (!isConnected) {
      alert(t("notConnected"));
      return;
    }

    stopTyping();
    onSendMessage(text, "text", getTimerSeconds());
    setMessageInput("");

    requestAnimationFrame(() => scrollToBottom(false));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedChat || !isConnected) {
      alert(t("selectChatFirst"));
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(t("fileTooLarge"));
      return;
    }

    const secs = getTimerSeconds();
    if (file.type.startsWith("image/")) onSendMessage("", "image", secs, file);
    else onSendMessage(file.name, "file", secs, file);

    if (fileInputRef.current) fileInputRef.current.value = "";
    requestAnimationFrame(() => scrollToBottom(false));
  };

  const handleCameraCapture = () => {
    if (!selectedChat || !isConnected) {
      alert(t("selectChatPhoto"));
      return;
    }
    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    // @ts-ignore
    cameraInput.capture = "environment";
    cameraInput.onchange = (ev) => {
      const f = (ev.target as HTMLInputElement).files?.[0];
      if (!f) return;
      handleFileUpload({ target: { files: [f] } } as any);
    };
    cameraInput.click();
  };

  const formatDestructTimer = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground w-full overflow-x-hidden">
        <div className="text-center space-y-4 p-8">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("welcome")}</h3>
            <p className="text-muted-foreground">{t("selectChatToStart")}</p>
          </div>
        </div>
      </div>
    );
  }

  const headerLetter = (selectedChat.otherUser.username || "U").charAt(0).toUpperCase();
  const otherOnline = Boolean((selectedChat as any)?.otherUser?.isOnline);

  const statusDotClass = !isConnected ? "bg-red-500" : otherOnline ? "bg-green-500" : "bg-muted-foreground/60";
  const statusText = !isConnected ? t("connecting") : otherOnline ? t("online") : t("offline");

  const composerPadBottom = `calc(env(safe-area-inset-bottom) + ${keyboardOffset}px)`;
  const listPadBottom = `calc(${composerHeight}px + env(safe-area-inset-bottom) + ${keyboardOffset}px + 12px)`;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 w-full bg-background border-b border-border px-3 py-3 md:px-4 md:py-4">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="md:hidden w-10 h-10 rounded-full flex-shrink-0 touch-target"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-muted-foreground font-semibold">{headerLetter}</span>
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{selectedChat.otherUser.username}</h3>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
                <span className={otherOnline ? "text-green-400" : "text-muted-foreground"}>{statusText}</span>
                <span className="text-muted-foreground">•</span>
                <Lock className="w-3 h-3 text-accent flex-shrink-0" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Select value={destructTimer} onValueChange={setDestructTimer}>
                <SelectTrigger className="border-0 bg-transparent text-foreground text-sm h-auto p-0 min-w-[62px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 sec</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                  <SelectItem value="60">1 min</SelectItem>
                  <SelectItem value="300">5 min</SelectItem>
                  <SelectItem value="1800">30 min</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="21600">6 hours</SelectItem>
                  <SelectItem value="86400">1 day</SelectItem>
                  <SelectItem value="604800">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full touch-target" aria-label="Menu">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={async () => {
                    const ok = window.confirm("Chat wirklich löschen?");
                    if (!ok) return;
                    await onDeleteChat(selectedChat.id);
                    onBackToList();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Chat löschen
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={async () => {
                    const ok = window.confirm(`User "${selectedChat.otherUser.username}" blockieren?`);
                    if (!ok) return;
                    await onBlockUser(selectedChat.otherUser.id);
                    onBackToList();
                  }}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  User blockieren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-3 md:px-4 py-3 space-y-3"
        style={{ paddingBottom: listPadBottom, WebkitOverflowScrolling: "touch" as any }}
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-surface rounded-full px-4 py-2 text-sm text-text-muted">
            <Shield className="w-4 h-4 text-accent" />
            <span>This conversation is end-to-end encrypted</span>
          </div>
        </div>

        {visibleMessages.map((m) => (
          <Message
            key={(m as any).id}
            message={m}
            isOwn={(m as any).senderId === currentUser.id}
            otherUser={selectedChat.otherUser}
          />
        ))}

        {isOtherTyping && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-muted-foreground text-sm font-semibold">{headerLetter}</span>
            </div>
            <div className="bg-muted/30 border border-border/40 rounded-2xl rounded-tl-md p-3">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" style={{ animationDelay: "0.1s" }} />
                <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer (NOT sticky) */}
      <div
        ref={composerRef}
        className="flex-shrink-0 w-full bg-background border-t border-border"
        style={{ paddingBottom: composerPadBottom }}
      >
        <div className="px-2 pt-2 flex items-end gap-2 flex-nowrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full flex-shrink-0 touch-target"
            title="Upload"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCameraCapture}
            className="w-11 h-11 rounded-full flex-shrink-0 touch-target"
            title="Camera"
          >
            📷
          </Button>

          <div className="flex-1 min-w-0 relative">
            <Textarea
              placeholder={isConnected ? t("typeMessage") : t("connecting")}
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              className="chat-textarea resize-none pr-10"
              rows={1}
              inputMode="text"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 bottom-1.5 w-9 h-9 rounded-full hidden md:flex"
              aria-label="Emoji"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected}
            className="w-11 h-11 rounded-full flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:opacity-50 text-white touch-target"
            aria-label="Send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-3 py-2 text-xs text-text-muted flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="truncate">{t("encryptionEnabled")}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="opacity-80">⏱️</span>
            <span className="text-destructive">{formatDestructTimer(getTimerSeconds())}</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </div>
    </div>
  );
}
