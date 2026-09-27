"use client";

import { useRef, useState, type FormEvent } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useAuth } from "./auth-provider";
import { Button } from "../admin-ui/button";
import { FormField, focusFirstInvalidField, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";

export function OwnPasswordDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { logout } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function close() {
    if (isSaving || isSigningOut || isChanged) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setErrors({});
    setFormError("");
    setIsChanged(false);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const nextErrors: Record<string, string> = {};
    if (currentPassword.length < 8) {
      nextErrors.currentPassword = "Joriy parolni kiriting.";
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      nextErrors.newPassword = "Parol 8-128 belgi oralig'ida bo'lishi kerak.";
    }
    if (newPassword && newPassword === currentPassword) {
      nextErrors.newPassword = "Yangi parol joriy paroldan farq qilishi kerak.";
    }
    if (newPassword !== confirmation) {
      nextErrors.confirmation = "Takroriy parol mos kelmadi.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch("/staff/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setErrors({});
      setIsChanged(true);
    } catch (error) {
      if (error instanceof SessionExpiredError) return;
      setFormError(
        error instanceof Error ? error.message : "Parol o'zgartirilmadi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function finish() {
    setIsSigningOut(true);
    await logout();
  }

  return (
    <Modal
      description="Joriy parolingiz tasdiqlanadi. O'zgartirishdan so'ng boshqa qurilmalardagi sessiyalar ham bekor qilinadi."
      dismissOnBackdrop={false}
      footer={
        isChanged ? (
          <Button isLoading={isSigningOut} onClick={() => void finish()} size="lg">
            <Icon className="h-4 w-4" name="logout" />
            Qayta kirish
          </Button>
        ) : (
          <>
            <Button onClick={close} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="own-password-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Parolni yangilash
            </Button>
          </>
        )
      }
      isOpen={isOpen}
      onClose={close}
      title="Parolimni o'zgartirish"
    >
      {isChanged ? (
        <div
          className="rounded-mz-control border border-mz-success bg-mz-success-bg p-3 text-sm text-mz-success"
          role="status"
        >
          Parol yangilandi. Eski sessiyalar bekor qilindi; xavfsizlik uchun
          qayta kiring.
        </div>
      ) : (
        <form
          className="grid gap-3"
          id="own-password-form"
          onSubmit={submit}
          ref={formRef}
        >
          {formError ? (
            <p
              className="rounded-mz-control border border-mz-danger bg-mz-danger-bg px-3 py-2 text-sm text-mz-danger"
              role="alert"
            >
              {formError}
            </p>
          ) : null}
          <FormField
            label="Joriy parol"
            required
            {...(errors.currentPassword ? { error: errors.currentPassword } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                autoComplete="current-password"
                maxLength={128}
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            hint="8-128 belgi"
            label="Yangi parol"
            required
            {...(errors.newPassword ? { error: errors.newPassword } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                autoComplete="new-password"
                maxLength={128}
                minLength={8}
                required
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Yangi parolni takrorlang"
            required
            {...(errors.confirmation ? { error: errors.confirmation } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                autoComplete="new-password"
                maxLength={128}
                minLength={8}
                required
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            )}
          </FormField>
        </form>
      )}
    </Modal>
  );
}
