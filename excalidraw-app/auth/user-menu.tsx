import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

import type { AuthUser } from "./auth-api";

export const UserMenu = ({
  isOpen,
  user,
  onClose,
  onLogout,
}: {
  isOpen: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onLogout: () => Promise<void>;
}) => {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen || !user) {
    return null;
  }

  return (
    <Dialog
      title={t("excPlus.auth.account")}
      size="small"
      onCloseRequest={onClose}
    >
      <div className="UserMenuDialog">
        <div className="UserMenuDialog__info">
          <div className="UserMenuDialog__name">
            {user.displayName || user.email}
          </div>
          <div className="UserMenuDialog__email">{user.email}</div>
        </div>

        {!!errorMessage && (
          <div className="UserMenuDialog__error">{errorMessage}</div>
        )}

        <FilledButton
          size="large"
          fullWidth
          label={
            isSubmitting
              ? t("excPlus.auth.signingOut")
              : t("excPlus.auth.signOut")
          }
          onClick={async () => {
            setIsSubmitting(true);
            setErrorMessage("");
            try {
              await onLogout();
            } catch {
              setErrorMessage(t("excPlus.auth.signOutFailed"));
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
