import moment from "moment-timezone";
import { Op } from "sequelize";
import Schedule from "./models/Schedule";
import Contact from "./models/Contact";
import Whatsapp from "./models/Whatsapp";
import User from "./models/User";
import logger from "./utils/logger";
import SendScheduledMessage from "./helpers/SendScheduledMessage";
import { getIO } from "./libs/socket";

// Flag para evitar execução simultânea
let isProcessing = false;

/**
 * Job 1: Processa agendamentos pendentes e verifica se chegou a hora de enviar
 */
export const ScheduledMessagesJob = async (): Promise<void> => {
  if (isProcessing) {
    return; // Evita execução simultânea
  }

  isProcessing = true;

  try {
    const now = moment().tz("America/Sao_Paulo");
    
    // Buscar agendamentos pendentes cuja data de envio já passou
    const schedules = await Schedule.findAll({
      where: {
        status: "PENDENTE",
        sendAt: {
          [Op.lte]: now.toDate()
        }
      },
      include: [
        {
          model: Contact,
          as: "contact",
          required: true
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          required: true,
          where: {
            status: "CONNECTED"
          }
        },
        {
          model: User,
          as: "users",
          attributes: ["id", "name", "email"]
        }
      ],
      limit: 50 // Processar no máximo 50 por vez
    });

    if (schedules.length > 0) {
      logger.info(`📅 [SCHEDULE JOB] Encontrados ${schedules.length} agendamento(s) para processar`);
    }

    for (const schedule of schedules) {
      try {
        await processSchedule(schedule);
      } catch (error) {
        logger.error(`❌ [SCHEDULE JOB] Erro ao processar agendamento ${schedule.id}:`);
        logger.error(error);
        
        // Marcar como erro
        await schedule.update({
          status: "ERRO",
          sentAt: new Date()
        });

        // Emitir evento de erro
        const io = getIO();
        io.of(String(schedule.companyId)).emit(`company${schedule.companyId}-schedule`, {
          action: "update",
          schedule
        });
      }
    }

  } catch (error) {
    logger.error("❌ [SCHEDULE JOB] Erro geral no job de agendamentos:");
    logger.error(error);
  } finally {
    isProcessing = false;
  }
};

/**
 * Processa um agendamento individual
 */
const processSchedule = async (schedule: Schedule): Promise<void> => {
  const { contact, whatsapp, users } = schedule;

  if (!contact) {
    throw new Error(`Contato não encontrado para o agendamento ${schedule.id}`);
  }

  if (!whatsapp) {
    throw new Error(`WhatsApp não encontrado para o agendamento ${schedule.id}`);
  }

  // Se tem múltiplos usuários, enviar para cada um
  if (users && users.length > 0) {
    logger.info(`👥 [SCHEDULE] Agendamento com ${users.length} usuário(s) selecionado(s)`);
    
    for (const user of users) {
      try {
        await SendScheduledMessage({
          schedule,
          contact,
          whatsapp,
          user
        });
      } catch (error) {
        logger.error(`❌ [SCHEDULE] Erro ao enviar para usuário ${user.name}:`);
        logger.error(error);
      }
    }
  } else {
    // Sem usuários específicos, enviar normalmente
    await SendScheduledMessage({
      schedule,
      contact,
      whatsapp
    });
  }

  // Verificar se deve criar recorrência
  if (schedule.enviarQuantasVezes && schedule.enviarQuantasVezes > 1) {
    const contadorEnvio = schedule.contadorEnvio || 0;
    const proximoEnvio = contadorEnvio + 1;

    if (proximoEnvio < schedule.enviarQuantasVezes) {
      // Calcular próxima data de envio
      const nextSendAt = calculateNextSendDate(schedule);

      // Criar novo agendamento (recorrência)
      await Schedule.create({
        body: schedule.body,
        sendAt: nextSendAt,
        contactId: schedule.contactId,
        companyId: schedule.companyId,
        userId: schedule.userId,
        status: "PENDENTE",
        ticketUserId: schedule.ticketUserId,
        queueId: schedule.queueId,
        openTicket: schedule.openTicket,
        statusTicket: schedule.statusTicket,
        whatsappId: schedule.whatsappId,
        intervalo: schedule.intervalo,
        valorIntervalo: schedule.valorIntervalo,
        enviarQuantasVezes: schedule.enviarQuantasVezes,
        tipoDias: schedule.tipoDias,
        contadorEnvio: proximoEnvio,
        assinar: schedule.assinar,
        mediaPath: schedule.mediaPath,
        mediaName: schedule.mediaName,
        // ✅ Incluir campos de template na recorrência
        templateMetaId: schedule.templateMetaId,
        templateLanguage: schedule.templateLanguage,
        templateComponents: schedule.templateComponents,
        isTemplate: schedule.isTemplate
      });

      logger.info(`🔄 [SCHEDULE] Recorrência criada - Envio ${proximoEnvio + 1}/${schedule.enviarQuantasVezes}`);
    }
  }

  // Atualizar status para ENVIADO
  await schedule.update({
    status: "ENVIADO",
    sentAt: new Date()
  });

  // Emitir evento de atualização
  const io = getIO();
  io.of(String(schedule.companyId)).emit(`company${schedule.companyId}-schedule`, {
    action: "update",
    schedule
  });

  logger.info(`✅ [SCHEDULE] Agendamento ${schedule.id} processado com sucesso`);
};

/**
 * Calcula a próxima data de envio baseado na recorrência
 */
const calculateNextSendDate = (schedule: Schedule): Date => {
  const currentSendAt = moment(schedule.sendAt).tz("America/Sao_Paulo");
  const valorIntervalo = schedule.valorIntervalo || 1;
  let nextDate = currentSendAt.clone();

  // intervalo: 1=dias, 2=semanas, 3=meses, 4=minutos
  switch (schedule.intervalo) {
    case 1: // Dias
      nextDate.add(valorIntervalo, "days");
      break;
    case 2: // Semanas
      nextDate.add(valorIntervalo, "weeks");
      break;
    case 3: // Meses
      nextDate.add(valorIntervalo, "months");
      break;
    case 4: // Minutos
      nextDate.add(valorIntervalo, "minutes");
      break;
    default:
      nextDate.add(1, "day");
  }

  // Verificar tipoDias (4=normal, 5=antecipar dia útil, 6=postergar dia útil)
  if (schedule.tipoDias === 5) {
    // Se cair em fim de semana, antecipar para sexta
    while (nextDate.day() === 0 || nextDate.day() === 6) {
      nextDate.subtract(1, "day");
    }
  } else if (schedule.tipoDias === 6) {
    // Se cair em fim de semana, postergar para segunda
    while (nextDate.day() === 0 || nextDate.day() === 6) {
      nextDate.add(1, "day");
    }
  }

  return nextDate.toDate();
};

/**
 * Job 2: Processa lembretes pendentes
 */
export const ScheduleMessagesGenerateJob = async (): Promise<void> => {
  try {
    const now = moment().tz("America/Sao_Paulo");
    
    // Buscar agendamentos com lembretes pendentes
    const schedules = await Schedule.findAll({
      where: {
        reminderDate: {
          [Op.lte]: now.toDate(),
          [Op.ne]: null
        },
        reminderStatus: "PENDENTE"
      },
      include: [
        {
          model: Contact,
          as: "contact",
          required: true
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          required: true,
          where: {
            status: "CONNECTED"
          }
        },
        {
          model: User,
          as: "users",
          attributes: ["id", "name", "email"]
        }
      ],
      limit: 50
    });

    if (schedules.length > 0) {
      logger.info(`🔔 [REMINDER JOB] Encontrados ${schedules.length} lembrete(s) para enviar`);
    }

    for (const schedule of schedules) {
      try {
        const { contact, whatsapp, users } = schedule;

        if (!contact || !whatsapp) {
          logger.warn(`⚠️ [REMINDER] Agendamento ${schedule.id} sem contato ou whatsapp`);
          continue;
        }

        // Preparar mensagem do lembrete
        const reminderMessage = schedule.reminderMessage || schedule.body;

        // Criar um objeto temporário para enviar o lembrete
        const reminderSchedule = {
          ...schedule.toJSON(),
          body: reminderMessage
        } as Schedule;

        // Enviar lembrete
        if (users && users.length > 0) {
          for (const user of users) {
            await SendScheduledMessage({
              schedule: reminderSchedule,
              contact,
              whatsapp,
              user
            });
          }
        } else {
          await SendScheduledMessage({
            schedule: reminderSchedule,
            contact,
            whatsapp
          });
        }

        // Atualizar status do lembrete
        await schedule.update({
          reminderStatus: "ENVIADO",
          reminderSentAt: new Date()
        });

        // Emitir evento de atualização
        const io = getIO();
        io.of(String(schedule.companyId)).emit(`company${schedule.companyId}-schedule`, {
          action: "update",
          schedule
        });

        logger.info(`✅ [REMINDER] Lembrete enviado - Schedule ID: ${schedule.id}`);

      } catch (error) {
        logger.error(`❌ [REMINDER] Erro ao enviar lembrete ${schedule.id}:`);
        logger.error(error);

        await schedule.update({
          reminderStatus: "ERRO"
        });
      }
    }

  } catch (error) {
    logger.error("❌ [REMINDER JOB] Erro geral no job de lembretes:");
    logger.error(error);
  }
};

/**
 * Job 3: Limpa agendamentos antigos (opcional - executar semanalmente)
 */
export const ScheduleMessagesCleanupJob = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = moment().tz("America/Sao_Paulo").subtract(30, "days").toDate();

    // Deletar agendamentos enviados há mais de 30 dias
    const deleted = await Schedule.destroy({
      where: {
        status: "ENVIADO",
        sentAt: {
          [Op.lte]: thirtyDaysAgo
        }
      }
    });

    if (deleted > 0) {
      logger.info(`🗑️ [CLEANUP JOB] ${deleted} agendamento(s) antigo(s) removido(s)`);
    }

  } catch (error) {
    logger.error("❌ [CLEANUP JOB] Erro no job de limpeza:");
    logger.error(error);
  }
};

/**
 * Aliases para compatibilidade (se necessário)
 */
export const ScheduleMessagesEnvioJob = ScheduledMessagesJob;
export const ScheduleMessagesEnvioForaHorarioJob = ScheduleMessagesGenerateJob;
