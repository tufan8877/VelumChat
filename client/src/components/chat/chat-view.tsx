import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";
import Message from "./message";
import { Paperclip, Send, Smile, Lock, Clock, MoreVertical, Shield, ArrowLeft, Trash2, UserX } from "lucide-react";
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

  // ✅ NEW:
  onDeleteChat: (chatId: number) => Promise<void> | void;
  onBlockUser: (userId: number) => Promise<void> | void;
}

/**
 * Keyboard-avoidance (iOS Safari / Android):
 * - Uses window.visualViewport to compute the keyboard overlap and lifts the input bar up.
 * - Adds matching bottom padding to the messages list so the last message never hides behind the input/keyboard.
 * - Keeps design/colors as-is (only layout behavior changes).
 */
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(140); // fallback

  const localTypingRef = useRef(false);
  const typingIdleTimerRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);

  const { t } = useLanguage();

  // --- Keyboard inset handling (fix: keyboard covers input on iOS/Android browsers)
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const compute = () => {
      // On mobile browsers, the keyboard reduces visualViewport.height (and may change offsetTop).
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };

    compute();
    vv.addEventListener("resize", compute);
    vv.addEventListener("scroll", compute);
    window.addEventListener("orientationchange", compute);

    return () => {
      vv.removeEventListener("resize", compute);
      vv.removeEventListener("scroll", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  // Measure input bar height so we can pad the messages list correctly
  useLayoutEffect(() => {
    if (!inputBarRef.current) return;

    const el = inputBarRef.current;
    const ro = new ResizeObserver(() => {
      const h = Math.max(0, Math.ceil(el.getBoundingClientRect().height));
      if (h) setInputBarHeight(h);
    });

    ro.observe(el);

    // initial
    const initH = Math.max(0, Math.ceil(el.getBoundingClientRect().height));
    if (initH) setInputBarHeight(initH);

    return () => ro.disconnect();
  }, []);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < 160;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  };

  useEffect(() => {
    if (messages.length === 0) return;
    if (isNearBottom()) setTimeout(() => scrollToBottom(true), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (isOtherTyping && isNearBottom()) setTimeout(() => scrollToBottom(true), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtherTyping]);

  // When keyboard opens/closes, keep bottom in view if user is at bottom
  useEffect(() => {
    if (isNearBottom()) setTimeout(() => scrollToBottom(false), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardInset, inputBarHeight]);

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
    setTimeout(() => scrollToBottom(true), 30);
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
    setTimeout(() => scrollToBottom(true), 30);
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

  // lift input bar above keyboard
  const inputTransform = keyboardInset > 0 ? `translateY(-${keyboardInset}px)` : undefined;

  // Bottom padding for messages list: inputBar height + keyboardInset + safe-area
  const messagesPaddingBottom = `calc(${inputBarHeight}px + ${keyboardInset}px + env(safe-area-inset-bottom))`;

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

            {/* Menu: delete chat + block user */}
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
        style={{ paddingBottom: messagesPaddingBottom }}
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-surface rounded-full px-4 py-2 text-sm text-text-muted">
            <Shield className="w-4 h-4 text-accent" />
            <span>This conversation is end-to-end encrypted</span>
          </div>
        </div>

        {messages.map((m) => (
          <Message key={m.id} message={m} isOwn={m.senderId === currentUser.id} otherUser={selectedChat.otherUser} />
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar (fixed behavior with keyboard) */}
      <div
        ref={inputBarRef}
        className="sticky bottom-0 w-full bg-background border-t border-border"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: inputTransform,
          willChange: "transform",
        }}
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
              className="chat-textarea resize-none pr-10"
              rows={1}
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
