import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useToast } from "@/hooks/use-toast";
import { X, UserRound, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";
import { useLanguage } from "@/lib/i18n";

interface SettingsModalProps {
  currentUser: User & { privateKey: string; token?: string };
  onClose: () => void;
  onUpdateUser: (user: User & { privateKey: string; token?: string }) => void;
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

export default function SettingsModal({ currentUser, onClose, onUpdateUser }: SettingsModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [username, setUsername] = useState(currentUser.username);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async () => {
    const newName = String(username || "").trim();
    if (!newName) {
      toast({
        title: t("error"),
        description: t("usernameEmpty"),
        variant: "destructive",
      });
      return;
    }

    const token = getToken();
    if (!token) {
      toast({
        title: t("error"),
        description: t("tokenMissing"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: newName }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || t("profileSaveError"));
      }

      const updatedUser = { ...currentUser, username: newName };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      onUpdateUser(updatedUser);

      toast({ title: t("success"), description: t("usernameUpdated") });
      onClose();
    } catch (err: any) {
      toast({
        title: t("error"),
        description: err?.message || t("profileSaveError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    const token = getToken();
    if (!token) {
      toast({
        title: t("error"),
        description: t("tokenMissing"),
        variant: "destructive",
      });
      return;
    }

    // ✅ i18n Confirm (alle Sprachen)
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
            <DialogTitle className="text-2xl font-bold text-text-primary">
              {t("settingsTitle")}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-text-muted hover:text-text-primary">
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
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {t("usernameLabel")}
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("enterNewUsername")}
                    className="!bg-surface !text-text-primary !border-border"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleSaveProfile} className="w-full" disabled={isSaving}>
                  {isSaving ? t("saving") : t("saveProfile")}
                </Button>

                <Button onClick={handleDeleteProfile} variant="destructive" className="w-full" disabled={isDeleting}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? t("deleting") : t("deleteAccount")}
                </Button>
              </div>
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
            <div className="text-sm text-text-muted">
              {t("aboutText")}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
