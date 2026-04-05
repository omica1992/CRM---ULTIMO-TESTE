export const MENU_MEDIA_WARNING_TEXT =
  "Recebi sua mensagem. Para continuar no menu, digite o número de uma opção.";

export type MenuInputClassification =
  | "valid_menu_input"
  | "invalid_text_input"
  | "media_no_text"
  | "empty";

interface ShouldRunMenuBotInput {
  hasAttendant?: boolean;
  hasStage?: boolean;
  hasQueueOptions?: boolean;
}

interface ClassifyMenuInputInput {
  text?: string | null;
  isMediaWithoutText?: boolean;
  hasInteractiveSelection?: boolean;
}

interface MenuStageKeyInput {
  channel: "baileys" | "facebook" | "oficial";
  queueId?: number | null;
  stageChatbotId?: number | null;
}

const mediaWarningByTicket = new Map<number, string>();

const MEDIA_PLACEHOLDER_TOKENS = new Set([
  "audio",
  "sticker",
  "documento",
  "document",
  "imagem",
  "image",
  "video"
]);

const normalizeInput = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const shouldRunMenuBot = ({
  hasAttendant = false,
  hasStage = false,
  hasQueueOptions = false
}: ShouldRunMenuBotInput): boolean =>
  !hasAttendant && (hasStage || hasQueueOptions);

export const classifyMenuInput = ({
  text,
  isMediaWithoutText = false,
  hasInteractiveSelection = false
}: ClassifyMenuInputInput): MenuInputClassification => {
  if (hasInteractiveSelection) {
    return "valid_menu_input";
  }

  const normalizedText = normalizeInput(text || "");

  if (normalizedText === "#" || normalizedText === "sair") {
    return "valid_menu_input";
  }

  if (/^\d+$/.test(normalizedText)) {
    return "valid_menu_input";
  }

  if (
    isMediaWithoutText &&
    (!normalizedText || MEDIA_PLACEHOLDER_TOKENS.has(normalizedText))
  ) {
    return "media_no_text";
  }

  if (!normalizedText) {
    return "empty";
  }

  return "invalid_text_input";
};

export const getMenuStageKey = ({
  channel,
  queueId,
  stageChatbotId
}: MenuStageKeyInput): string =>
  `${channel}:${stageChatbotId ? `stage:${stageChatbotId}` : `queue:${queueId ?? "none"}`}`;

export const shouldSendMenuMediaWarning = (
  ticketId: number,
  stageKey: string
): boolean => {
  const warnedContext = mediaWarningByTicket.get(ticketId);
  if (warnedContext === stageKey) {
    return false;
  }

  mediaWarningByTicket.set(ticketId, stageKey);
  return true;
};

export const clearMenuMediaWarning = (ticketId: number): void => {
  mediaWarningByTicket.delete(ticketId);
};

