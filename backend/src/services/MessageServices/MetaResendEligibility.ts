interface EligibilityInput {
  mediaType?: string | null;
  body?: string | null;
  deliveryError?: string | null;
  deliveryErrorCode?: string | null;
}

interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
}

const SUPPORTED_MEDIA_TYPES = new Set([
  "conversation",
  "extendedTextMessage",
  "text"
]);

const NON_RETRYABLE_CODES = new Set([
  "470",
  "131026",
  "131047",
  "131051",
  "131053",
  "131030",
  "131031",
  "131049",
  "131021"
]);

const NON_RETRYABLE_KEYWORDS = [
  "24 hour",
  "24h",
  "window",
  "janela",
  "template",
  "policy",
  "política",
  "payment",
  "pagamento",
  "engagement",
  "re-engagement",
  "experiment",
  "opted out",
  "opt-out",
  "blocked",
  "bloquead",
  "not allowed",
  "forbidden"
];

export const getMetaResendEligibility = ({
  mediaType,
  body,
  deliveryError,
  deliveryErrorCode
}: EligibilityInput): EligibilityResult => {
  const normalizedMediaType = (mediaType || "").trim();
  const normalizedBody = (body || "").trim();
  const normalizedError = (deliveryError || "").toLowerCase();
  const normalizedErrorCode = (deliveryErrorCode || "").trim();

  if (!SUPPORTED_MEDIA_TYPES.has(normalizedMediaType)) {
    return {
      eligible: false,
      reason: "Reenvio automático disponível apenas para mensagens de texto."
    };
  }

  if (!normalizedBody) {
    return {
      eligible: false,
      reason: "Mensagem sem conteúdo para reenvio."
    };
  }

  if (NON_RETRYABLE_CODES.has(normalizedErrorCode)) {
    return {
      eligible: false,
      reason: `Erro Meta ${normalizedErrorCode} exige ação manual.`
    };
  }

  if (
    normalizedError &&
    NON_RETRYABLE_KEYWORDS.some(keyword => normalizedError.includes(keyword))
  ) {
    return {
      eligible: false,
      reason: "Erro Meta não reenviável automaticamente."
    };
  }

  return {
    eligible: true,
    reason: null
  };
};

