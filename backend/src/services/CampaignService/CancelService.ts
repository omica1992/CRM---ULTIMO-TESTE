import { Op } from "sequelize";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { campaignQueue } from "../../queues";
import logger from "../../utils/logger";

export async function CancelService(id: number) {
  const campaign = await Campaign.findByPk(id);
  
  logger.info(`[CAMPAIGN-CANCEL] Cancelando campanha ${id} (status atual: ${campaign.status})`);
  
  await campaign.update({ status: "CANCELADA" });

  // ✅ Buscar todos os jobs pendentes
  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      jobId: { [Op.not]: null },
      deliveredAt: null
    }
  });

  logger.info(`[CAMPAIGN-CANCEL] Encontrados ${recordsToCancel.length} jobs pendentes para remover`);

  const promises = [];
  let removedCount = 0;
  let activeCount = 0; // Jobs que estão sendo executados
  let failedCount = 0;

  // ✅ Remover cada job da fila
  for (let record of recordsToCancel) {
    try {
      const job = await campaignQueue.getJob(+record.jobId);
      
      if (job) {
        const jobState = await job.getState();
        
        // Se job está ativo, não pode remover mas marcar para não reprocessar
        if (jobState === 'active') {
          activeCount++;
          logger.warn(`[CAMPAIGN-CANCEL] Job ${record.jobId} está ativo (executando), será ignorado ao terminar`);
          // Limpar jobId para não tentar remover novamente
          await record.update({ jobId: null });
        } else {
          // Tentar remover job (delayed, waiting, etc)
          await job.remove();
          removedCount++;
          await record.update({ jobId: null });
          logger.debug(`[CAMPAIGN-CANCEL] Job ${record.jobId} removido com sucesso`);
        }
      } else {
        // Job não existe mais
        await record.update({ jobId: null });
        logger.debug(`[CAMPAIGN-CANCEL] Job ${record.jobId} não encontrado na fila`);
      }
    } catch (error) {
      failedCount++;
      logger.error(`[CAMPAIGN-CANCEL] Erro ao processar job ${record.jobId}: ${error.message}`);
      // Tentar limpar jobId mesmo com erro
      try {
        await record.update({ jobId: null });
      } catch (updateError) {
        logger.error(`[CAMPAIGN-CANCEL] Erro ao limpar jobId ${record.jobId}: ${updateError.message}`);
      }
    }
  }
  
  logger.info(
    `[CAMPAIGN-CANCEL] Campanha ${id} cancelada. ` +
    `Removidos: ${removedCount}, Ativos: ${activeCount}, Falhas: ${failedCount}, Total: ${recordsToCancel.length}`
  );
  
  return { 
    removedJobs: removedCount, 
    activeJobs: activeCount,
    failedJobs: failedCount,
    totalPending: recordsToCancel.length 
  };
}
