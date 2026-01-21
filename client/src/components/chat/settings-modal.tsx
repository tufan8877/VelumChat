import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { X, UserRound, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";

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

  // (Optional UI settings – currently client-only)
  const [defaultTimer, setDefaultTimer] = useState("86400");
  const [readReceipts, setReadReceipts] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async () => {
    const newName = String(username || "").trim();
    if (!newName) {
      toast({ title: "Error", description: "Username darf nicht leer sein.", variant: "destructive" });
      return;
    }

    const token = getToken();
    if (!token) {
      toast({ title: "Error", description: "Token fehlt – bitte neu einloggen.", variant: "destructive" });
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
        throw new Error(data?.message || "Profil konnte nicht gespeichert werden");
      }

      // update local user
      const updatedUser = { ...currentUser, username: newName };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      onUpdateUser(updatedUser);

      toast({ title: "Gespeichert", description: "Username wurde aktualisiert." });
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Profil konnte nicht gespeichert werden",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    const token = getToken();
    if (!token) {
      toast({ title: "Error", description: "Token fehlt – bitte neu einloggen.", variant: "destructive" });
      return;
    }

    const ok = window.confirm(
      "Willst du dein Profil wirklich löschen?\n\nDas löscht:\n- deinen User\n- alle Chats\n- alle Nachrichten\n\nDein Username wird danach wieder frei."
    );
    if (!ok) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Profil konnte nicht gelöscht werden");
      }

      // clear local session
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } catch {}

      toast({ title: "Profil gelöscht", description: "Dein Profil und Inhalte wurden gelöscht." });

      // redirect to start/login
      window.location.href = "/";
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Profil konnte nicht gelöscht werden",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTimerOption = (seconds: string) => {
    const num = parseInt(seconds, 10);
    if (num < 60) return `${num} sec`;
    if (num < 3600) return `${Math.floor(num / 60)} min`;
    if (num < 86400) return `${Math.floor(num / 3600)} h`;
    return `${Math.floor(num / 86400)} day`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border w-[calc(100vw-24px)] sm:max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-2xl font-bold text-text-primary">Einstellungen</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {/* Profile */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Profil</h3>

            <div className="space-y-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserRound className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-text-primary mb-2">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Neuer Username"
                    className="!bg-surface !text-text-primary !border-border"
                  />
                  <p className="text-xs text-text-muted mt-2">
                    Tipp: Username wird serverseitig gespeichert und ist für andere sichtbar.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleSaveProfile} className="w-full" disabled={isSaving}>
                  {isSaving ? "Speichern..." : "Profil speichern"}
                </Button>

                <Button
                  onClick={handleDeleteProfile}
                  variant="destructive"
                  className="w-full"
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? "Löschen..." : "Profil löschen"}
                </Button>
              </div>
            </div>
          </div>

          {/* Language */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Sprache</h3>
            <div className="flex justify-start">
              <LanguageSelector />
            </div>
          </div>

          {/* Message / Timer (optional) */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Nachrichten</h3>

            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-medium text-text-primary">Default Message Timer</h4>
                <p className="text-sm text-text-muted break-words whitespace-normal">
                  Auto-destruct time for new messages
                </p>
              </div>

              <Select value={defaultTimer} onValueChange={setDefaultTimer}>
                <SelectTrigger className="w-40 sm:w-44 bg-surface border-border text-text-primary flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">{formatTimerOption("5")}</SelectItem>
                  <SelectItem value="30">{formatTimerOption("30")}</SelectItem>
                  <SelectItem value="60">{formatTimerOption("60")}</SelectItem>
                  <SelectItem value="300">{formatTimerOption("300")}</SelectItem>
                  <SelectItem value="3600">{formatTimerOption("3600")}</SelectItem>
                  <SelectItem value="86400">{formatTimerOption("86400")}</SelectItem>
                  <SelectItem value="604800">{formatTimerOption("604800")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-text-muted mt-2">
              Hinweis: Dieser Timer ist aktuell clientseitig. (Wenn du willst, machen wir ihn global pro User in DB.)
            </p>
          </div>

          {/* Privacy */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Privacy</h3>

            <div className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">Read Receipts</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">
                    Let others know when you read their messages
                  </p>
                </div>
                <Switch checked={readReceipts} onCheckedChange={setReadReceipts} className="flex-shrink-0" />
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">Typing Indicators</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">
                    Show when you are typing to others
                  </p>
                </div>
                <Switch checked={typingIndicators} onCheckedChange={setTypingIndicators} className="flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">About</h3>
            <Button variant="outline" className="w-full bg-bg-dark border-border hover:bg-muted/50 text-left h-auto p-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary">Export Encryption Keys</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">
                    Backup your encryption keys securely
                  </p>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
