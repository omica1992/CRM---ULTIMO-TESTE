import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { scheduleCampaignFinalizeCheck } from "../../queues";

interface Request {
  companyId: number;
  messageId: string;
  status: string;
  error?: any;
}

const getErrorMessage = (error: any): string | null => {
  if (!error) return null;

  return (
    error?.error_data?.details ||
    error?.message ||
    error?.title ||
    (typeof error === "string" ? error : null) ||
    null
  );
};

const SyncCampaignShippingMetaStatusService = async ({
  companyId,
  messageId,
  status,
  error
}: Request): Promise<CampaignShipping | null> => {
  const shipping = await CampaignShipping.findOne({
    where: { metaMessageId: messageId },
    include: [
      {
        model: Campaign,
        attributes: ["id", "companyId"]
      }
    ]
  });

  if (!shipping) {
    return null;
  }

  if (!shipping.campaign || shipping.campaign.companyId !== companyId) {
    logger.warn(
      `[CAMPAIGN-META-STATUS] Shipping ${shipping.id} ignorado por companyId divergente. messageId=${messageId}, companyId=${companyId}`
    );
    return null;
  }

  const now = new Date();
  const normalizedStatus = (status || "").toLowerCase();
  const updateData: Partial<CampaignShipping> & {
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    failedAt?: Date | null;
    errorMessage?: string | null;
    jobId?: string | null;
  } = {
    jobId: null
  };

  if (normalizedStatus === "sent") {
    if (!shipping.sentAt) {
      updateData.sentAt = now;
    }
  } else if (normalizedStatus === "delivered") {
    updateData.sentAt = shipping.sentAt || now;
    updateData.deliveredAt = now;
    updateData.failedAt = null;
    updateData.errorMessage = null;
  } else if (
    normalizedStatus === "failed" ||
    normalizedStatus === "undelivered"
  ) {
    updateData.sentAt = shipping.sentAt || now;
    updateData.failedAt = now;
    updateData.errorMessage = getErrorMessage(error) || "Falha na entrega";
  } else {
    return shipping;
  }

  await shipping.update(updateData);

  scheduleCampaignFinalizeCheck(shipping.campaignId);

  try {
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-campaign-shipping`, {
      action: "update",
      record: {
        id: shipping.id,
        campaignId: shipping.campaignId,
        sentAt: shipping.sentAt,
        deliveredAt: shipping.deliveredAt,
        failedAt: shipping.failedAt,
        errorMessage: shipping.errorMessage,
        metaMessageId: shipping.metaMessageId
      }
    });
  } catch (socketError: any) {
    logger.warn(
      `[CAMPAIGN-META-STATUS] Falha ao emitir atualização do shipping ${shipping.id}: ${socketError.message}`
    );
  }

  return shipping;
};

export default SyncCampaignShippingMetaStatusService;
