import { Op } from "sequelize";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import AppError from "../../errors/AppError";
import { campaignQueue } from "../../queues";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";

interface Request {
  campaignId: number;
  companyId: number;
  shippingIds: number[];
}

interface Response {
  totalSelected: number;
  requeuedCount: number;
  skippedCount: number;
}

const ResendFailedCampaignShippingService = async ({
  campaignId,
  companyId,
  shippingIds
}: Request): Promise<Response> => {
  if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
    throw new AppError("Selecione ao menos um envio com falha para reenviar.", 400);
  }

  const campaign = await Campaign.findOne({
    where: {
      id: campaignId,
      companyId
    }
  });

  if (!campaign) {
    throw new AppError("Campanha não encontrada.", 404);
  }

  if (campaign.status === "CANCELADA") {
    throw new AppError("Campanha cancelada não pode ser reenviada.", 400);
  }

  const uniqueIds = [...new Set(shippingIds.map(id => Number(id)).filter(Boolean))];

  const shippings = await CampaignShipping.findAll({
    where: {
      id: { [Op.in]: uniqueIds },
      campaignId
    }
  });

  if (shippings.length === 0) {
    throw new AppError("Nenhum registro de envio encontrado para reenvio.", 404);
  }

  let requeuedCount = 0;
  let skippedCount = 0;

  for (const shipping of shippings) {
    const isFailed = !!shipping.failedAt && !shipping.deliveredAt;

    if (!isFailed) {
      skippedCount++;
      continue;
    }

    await shipping.update({
      failedAt: null,
      errorMessage: null,
      deliveredAt: null,
      sentAt: null,
      metaMessageId: null,
      confirmationRequestedAt: null,
      confirmedAt: null
    });

    const nextJob = await campaignQueue.add(
      "DispatchCampaign",
      {
        campaignId: campaign.id,
        campaignShippingId: shipping.id,
        contactListItemId: shipping.contactId || 0
      },
      {
        delay: 0,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 30000
        },
        removeOnComplete: { age: 60 * 60, count: 2000 },
        removeOnFail: { age: 24 * 60 * 60, count: 5000 }
      }
    );

    await shipping.update({
      jobId: String(nextJob.id)
    });

    requeuedCount++;
  }

  if (requeuedCount > 0) {
    await campaign.update({
      status: "EM_ANDAMENTO",
      completedAt: null
    });
  }

  try {
    const io = getIO();

    if (requeuedCount > 0) {
      io.of(String(companyId)).emit(`company-${companyId}-campaign`, {
        action: "update",
        record: campaign
      });
    }

    shippings.forEach(shipping => {
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
    });
  } catch (socketError: any) {
    logger.warn(
      `[CAMPAIGN-RESEND] Falha ao emitir atualização via socket para campanha ${campaignId}: ${socketError.message}`
    );
  }

  return {
    totalSelected: uniqueIds.length,
    requeuedCount,
    skippedCount
  };
};

export default ResendFailedCampaignShippingService;
