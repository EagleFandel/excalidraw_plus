import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { t } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

import { authApi } from "./auth-api";
import "./auth-dialog.scss";

import type { AuthUser } from "./auth-api";

export type AuthDialogMode = "signin" | "signup";

export const AuthDialog = ({
  isOpen,
  mode,
  onClose,
  onModeChange,
  onSuccess,
}: {
  isOpen: boolean;
  mode: AuthDialogMode;
  onClose: () => void;
  onModeChange: (mode: AuthDialogMode) => void;
  onSuccess: (user: AuthUser) => void;
}) => {
  const { openDialog } = useUIAppState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen || openDialog) {
    return null;
  }

  const isSignUp = mode === "signup";

  return (
    <Dialog
      title={isSignUp ? t("excPlus.auth.signUp") : t("excPlus.auth.signIn")}
      size="small"
      onCloseRequest={onClose}
    >
      <div className="AuthDialog">
        <div className="AuthDialog__modeSwitch" role="tablist">
          <button
            type="button"
            className={`AuthDialog__modeButton ${!isSignUp ? "is-active" : ""}`}
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => {
              onModeChange("signin");
              setErrorMessage("");
            }}
          >
            {t("excPlus.auth.signIn")}
          </button>
          <button
            type="button"
            className={`AuthDialog__modeButton ${isSignUp ? "is-active" : ""}`}
            role="tab"
            aria-selected={isSignUp}
            onClick={() => {
              onModeChange("signup");
              setErrorMessage("");
            }}
          >
            {t("excPlus.auth.signUp")}
          </button>
        </div>

        {isSignUp && (
          <TextField
            label={t("labels.name")}
            value={displayName}
            onChange={setDisplayName}
            placeholder={t("labels.yourName")}
            fullWidth
          />
        )}

        <TextField
          label={t("excPlus.auth.email")}
          value={email}
          onChange={setEmail}
          placeholder={t("excPlus.auth.emailPlaceholder")}
          fullWidth
        />
        <TextField
          label={t("excPlus.auth.password")}
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          isRedacted
          fullWidth
        />

        {isSignUp && (
          <TextField
            label={t("excPlus.auth.confirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
            isRedacted
            fullWidth
          />
        )}

        {errorMessage && (
          <div className="AuthDialog__error">{errorMessage}</div>
        )}

        <FilledButton
          size="large"
          fullWidth
          label={
            isSubmitting
              ? isSignUp
                ? t("excPlus.auth.signingUp")
                : t("excPlus.auth.signingIn")
              : isSignUp
              ? t("excPlus.auth.signUp")
              : t("excPlus.auth.signIn")
          }
          onClick={async () => {
            if (!email.trim() || !password.trim()) {
              setErrorMessage(t("excPlus.auth.requiredEmailAndPassword"));
              return;
            }

            if (isSignUp && password.length < 8) {
              setErrorMessage(t("excPlus.auth.passwordMinLength"));
              return;
            }

            if (isSignUp && password !== confirmPassword) {
              setErrorMessage(t("excPlus.auth.passwordMismatch"));
              return;
            }

            setIsSubmitting(true);
            setErrorMessage("");

            try {
              const user = isSignUp
                ? await authApi.register({
                    email: email.trim(),
                    password,
                    displayName: displayName.trim() || undefined,
                  })
                : await authApi.login({
                    email: email.trim(),
                    password,
                  });
              onSuccess(user);
              onClose();
              setPassword("");
              setConfirmPassword("");
            } catch {
              setErrorMessage(
                isSignUp
                  ? t("excPlus.auth.signUpFailed")
                  : t("excPlus.auth.signInFailed"),
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={isSubmitting}
        />
      </div>
    </Dialog>
  );
};
