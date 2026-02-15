import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { X, UserRound, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";

interface SettingsModalProps {
  currentUser: User & { privateKey: string; token?: string };
  onClose: () => void;
}

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

export default function SettingsModal({ currentUser, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProfile = async () => {
    const token = getToken();
    if (!token) {
      toast({
        title: t("error"),
        description: t("tokenMissingRelogin"),
        variant: "destructive",
      });
      return;
    }

    // ✅ Fully translated confirm text
    const ok = window.confirm(t("deleteAccountConfirm"));
    if (!ok) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || t("accountDeleteError"));
      }

      try {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } catch {}

      toast({
        title: t("accountDeleted"),
        description: t("accountDeletedDesc"),
      });

      window.location.href = "/";
    } catch (err: any) {
      toast({
        title: t("error"),
        description: err?.message || t("accountDeleteError"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border w-[calc(100vw-24px)] sm:max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            {/* ✅ translated title */}
            <DialogTitle className="text-2xl font-bold text-text-primary">
              {t("settingsTitle")}
            </DialogTitle>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-text-muted hover:text-text-primary"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {/* Profil */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("profile")}</h3>

            <div className="space-y-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserRound className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-muted">{t("loggedInAs")}</div>
                  <div className="text-lg font-semibold text-text-primary truncate">
                    {currentUser.username}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDeleteProfile}
                variant="destructive"
                className="w-full"
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? t("deleting") : t("deleteAccount")}
              </Button>

              <div className="text-xs text-text-muted">{t("deleteAccountHint")}</div>
            </div>
          </div>

          {/* Sprache */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("language")}</h3>
            <div className="flex justify-start">
              <LanguageSelector />
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("about")}</h3>
            <div className="text-sm text-text-muted">{t("aboutText")}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
