import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import WhatsAppSidebar from "@/components/chat/whatsapp-sidebar";
import ChatView from "@/components/chat/chat-view";
import SettingsModal from "@/components/chat/settings-modal";
import { Toaster } from "@/components/ui/toaster";
import { useWebSocketReliable } from "@/hooks/use-websocket-reliable";
import { usePersistentChats } from "@/hooks/use-persistent-chats";
import type { User } from "@shared/schema";

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token");
  }
}

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState<(User & { privateKey: string; token?: string }) | null>(null);

  useLayoutEffect(() => {
    if (!currentUser) return;
    const viewport = window.visualViewport;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    const updateViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        container.style.height = `${viewport?.height ?? window.innerHeight}px`;
        container.style.top = `${viewport?.offsetTop ?? 0}px`;
      });
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      document.body.style.overflow = previousOverflow;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const initializeUser = async () => {
      const userData = localStorage.getItem("user");
      if (!userData) {
        const { profileProtection } = await import("@/lib/profile-protection");
        const recovered = profileProtection.retrieveProfile();
        if (recovered) {
          setCurrentUser(recovered);
          return;
        }
        setLocation("/");
        return;
      }

      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
      } catch {
        setLocation("/");
      }
    };

    initializeUser();
  }, [setLocation]);

  const socket = useWebSocketReliable(currentUser?.id);

  const {
    persistentContacts: chats,
    messages,
    sendMessage,
    sendTyping,
    isOtherTyping,
    typingByChat,
    selectChat,
    isLoading,
    selectedChat,
    loadPersistentContacts,
    unreadCounts,
    deleteChat,
  } = usePersistentChats(currentUser?.id, socket, currentUser as any);

  const handleSendMessage = useCallback(
    (content: string, type: string, destructTimer: number, file?: File) => {
      if (!currentUser?.id) {
        setLocation("/");
        return;
      }
      if (!selectedChat?.otherUser?.id) return;

      const destructTimerSec = Math.max(Number(destructTimer) || 0, 5);
      sendMessage(content, type, destructTimerSec, file);
    },
    [currentUser?.id, selectedChat?.otherUser?.id, sendMessage, setLocation]
  );

  const handleBlockUser = useCallback(
    async (userIdToBlock: number) => {
      const token = getToken();
      if (!token) return;

      try {
        await fetch(`/api/users/${userIdToBlock}/block`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
      } catch {}

      try {
        await loadPersistentContacts();
      } catch {}
    },
    [loadPersistentContacts]
  );


  const handleUnblockUser = useCallback(
    async (userIdToUnblock: number) => {
      const token = getToken();
      if (!token) return;

      try {
        await fetch(`/api/users/${userIdToUnblock}/block`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch {}

      try {
        await loadPersistentContacts();
      } catch {}
    },
    [loadPersistentContacts]
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center overflow-x-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading your secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-x-0 top-0 h-dvh min-h-0 w-full max-w-full overflow-hidden flex flex-col md:flex-row bg-background chat-container">
      <div
        className={`${selectedChat ? "hidden md:flex" : "flex"} md:flex h-full min-h-0 w-full md:w-[380px] min-w-0 max-w-full overflow-x-hidden`}
      >
        <WhatsAppSidebar
          currentUser={currentUser}
          chats={chats as any}
          selectedChat={selectedChat}
          onSelectChat={(chat: any) => selectChat(chat)}
          onOpenSettings={() => setShowSettings(true)}
          isConnected={socket?.isConnected || false}
          isLoading={isLoading}
          unreadCounts={unreadCounts}
          typingByChat={typingByChat}
          onRefreshChats={() => loadPersistentContacts()}
          onDeleteChat={async (chatId) => {
            await deleteChat(chatId);
          }}
          onBlockUser={async (uid) => {
            await handleBlockUser(uid);
          }}
          onUnblockUser={async (uid) => {
            await handleUnblockUser(uid);
          }}
        />
      </div>

      <div
        className={`${selectedChat ? "flex" : "hidden md:flex"} flex-1 h-full min-h-0 min-w-0 w-full max-w-full overflow-hidden chat-safe`}
      >
        <ChatView
          currentUser={currentUser}
          selectedChat={selectedChat}
          messages={messages}
          onSendMessage={handleSendMessage}
          onTyping={(typing: boolean) => {
            try {
              sendTyping(typing);
            } catch {}
          }}
          isOtherTyping={isOtherTyping}
          isConnected={socket?.isConnected || false}
          onBackToList={() => selectChat(null as any)}
          onDeleteChat={async (chatId) => {
            await deleteChat(chatId);
          }}
          onBlockUser={async (uid) => {
            await handleBlockUser(uid);
          }}
          onUnblockUser={async (uid) => {
            await handleUnblockUser(uid);
          }}
        />
      </div>

      {showSettings && (
        <SettingsModal
          currentUser={currentUser as any}
          onClose={() => setShowSettings(false)}
          onUpdateUser={(user) => {
            localStorage.setItem("user", JSON.stringify(user));
            setCurrentUser(user);
            setTimeout(() => {
              loadPersistentContacts();
            }, 50);
          }}
        />
      )}

      <Toaster />
    </div>
  );
}
