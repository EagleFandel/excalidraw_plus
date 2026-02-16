import { t } from "@excalidraw/excalidraw/i18n";

export const ExcalidrawPlusPromoBanner = ({
  onAuthClick,
}: {
  onAuthClick: () => void;
}) => {
  return (
    <button type="button" onClick={onAuthClick} className="plus-banner">
      {t("excPlus.auth.account")}
    </button>
  );
};
