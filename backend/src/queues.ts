import * as Sentry from "@sentry/node";
import BullQueue from "bull";
import { MessageData, SendMessage } from "./helpers/SendMessage";
import Whatsapp from "./models/Whatsapp";
import logger from "./utils/logger";
import campaignLogger from "./utils/campaignLogger";
import moment from "moment";
import Schedule from "./models/Schedule";
import { Op, QueryTypes, Sequelize } from "sequelize";
import GetDefaultWhatsApp from "./helpers/GetDefaultWhatsApp";
import Campaign from "./models/Campaign";
import Queues from "./models/Queue";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";
import { isEmpty, isNil, isArray } from "lodash";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";
import GetWhatsappWbot from "./helpers/GetWhatsappWbot";
import sequelize from "./database";
import { getMessageOptions } from "./services/WbotServices/SendWhatsAppMedia";
import { getIO } from "./libs/socket";
import path from "path";
import User from "./models/User";
import Company from "./models/Company";
import Contact from "./models/Contact";
import Queue from "./models/Queue";
import { ClosedAllOpenTickets } from "./services/WbotServices/wbotClosedTickets";
import Ticket from "./models/Ticket";
import ShowContactService from "./services/ContactServices/ShowContactService";
import UserQueue from "./models/UserQueue";
import ShowTicketService from "./services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "./services/WbotServices/SendWhatsAppMessage";
import SendWhatsAppMessageAPI from "./services/WbotServices/SendWhatsAppMessageAPI";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import { addSeconds, differenceInSeconds } from "date-fns";
const CronJob = require("cron").CronJob;
import CompaniesSettings from "./models/CompaniesSettings";
import {
  verifyMediaMessage,
  verifyMessage
} from "./services/WbotServices/wbotMessageListener";
import FindOrCreateTicketService from "./services/TicketServices/FindOrCreateTicketService";
import CreateLogTicketService from "./services/TicketServices/CreateLogTicketService";
import formatBody from "./helpers/Mustache";
import TicketTag from "./models/TicketTag";
import Tag from "./models/Tag";
import ContactTag from "./models/ContactTag";
import { delay } from "baileys";
import Plan from "./models/Plan";
import QueueState from "./models/QueueStates";
import { getWbot } from "./libs/wbot";
import { initializeBirthdayJobs, startBirthdayJob } from "./jobs/BirthdayJob";
import { getJidOf } from "./services/WbotServices/getJidOf";
import RecurrenceService from "./services/CampaignService/RecurrenceService";
import WhatsappLidMap from "./models/WhatsapplidMap";
import { checkAndDedup } from "./services/WbotServices/verifyContact";
import QuickMessage from "./models/QuickMessage";
import QuickMessageComponent from "./models/QuickMessageComponent";
import SendWhatsAppOficialMessage from "./services/WhatsAppOficial/SendWhatsAppOficialMessage";
import { IMetaMessageTemplate, IMetaMessageTemplateComponents, ISendMessageOficial } from "./libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import { sendMessageWhatsAppOficial } from "./libs/whatsAppOficial/whatsAppOficial.service";

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;

interface ProcessCampaignData {
  id: number;
  delay: number;
}

interface CampaignSettings {
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  variables: any[];
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

interface LidRetryData {
  contactId: number;
  whatsappId: number;
  companyId: number;
  number: string;
  retryCount: number;
  maxRetries?: number;
}

export const userMonitor = new BullQueue("UserMonitor", connection);
export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const sendScheduledMessages = new BullQueue(
  "SendSacheduledMessages",
  connection
);
export const campaignQueue = new BullQueue("CampaignQueue", connection);
export const queueMonitor = new BullQueue("QueueMonitor", connection);
export const lidRetryQueue = new BullQueue("LidRetryQueue", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

let isProcessing = false;

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp === null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

// ✅ Nova função para verificar lembretes
async function handleVerifyReminders(job) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        reminderStatus: "PENDENTE",
        reminderSentAt: null,
        reminderDate: {
          [Op.gte]: moment().format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [
        { model: Contact, as: "contact" },
        { model: User, as: "user", attributes: ["name"] }
      ],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          reminderStatus: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendReminder",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Lembrete agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendReminder -> Verify: error", e.message);
    throw e;
  }
}

async function handleVerifySchedules(job) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.gte]: moment().format("YYYY-MM-DD HH:mm:ss"),
          [Op.lte]: moment().add("30", "seconds").format("YYYY-MM-DD HH:mm:ss")
        }
      },
      include: [
        { model: Contact, as: "contact" },
        { model: User, as: "user", attributes: ["name"] }
      ],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          status: "AGENDADA"
        });
        sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          { delay: 40000 }
        );
        logger.info(`Disparo agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;
  let whatsapp: any = null; // ✅ Declarar fora do try para estar disponível no catch

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    logger.info(`📤 [SCHEDULE-QUEUE] Iniciando envio - Schedule ID: ${schedule.id}`);
    logger.info(`📤 [SCHEDULE-QUEUE] - Contact: ${schedule.contact?.name} (${schedule.contact?.number})`);
    logger.info(`📤 [SCHEDULE-QUEUE] - WhatsApp ID: ${schedule.whatsappId}`);
    logger.info(`📤 [SCHEDULE-QUEUE] - Is Template: ${schedule.isTemplate}`);

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
      logger.info(`📤 [SCHEDULE-QUEUE] WhatsApp encontrado: ${whatsapp?.name} (Provider: ${whatsapp?.provider})`);
    }

    if (!whatsapp) {
      logger.info(`📤 [SCHEDULE-QUEUE] WhatsApp não encontrado, buscando default...`);
      whatsapp = await GetDefaultWhatsApp(schedule.companyId);
      logger.info(`📤 [SCHEDULE-QUEUE] WhatsApp default: ${whatsapp?.name}`);
    }

    // const settings = await CompaniesSettings.findOne({
    //   where: {
    //     companyId: schedule.companyId
    //   }
    // })

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve(
        "public",
        `company${schedule.companyId}`,
        schedule.mediaPath
      );
    }

    if (schedule.openTicket === "enabled") {
      let ticket = await Ticket.findOne({
        where: {
          contactId: schedule.contact.id,
          companyId: schedule.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket)
        ticket = await Ticket.create({
          companyId: schedule.companyId,
          contactId: schedule.contactId,
          whatsappId: whatsapp.id,
          queueId: schedule.queueId,
          userId: schedule.ticketUserId,
          status: schedule.statusTicket
        });

      ticket = await ShowTicketService(ticket.id, schedule.companyId);

      let bodyMessage;

      // @ts-ignore: Unreachable code error
      if (schedule.assinar && !isNil(schedule.userId)) {
        bodyMessage = `*${schedule?.user?.name}:*\n${schedule.body.trim()}`;
      } else {
        bodyMessage = schedule.body.trim();
      }
      const sentMessage = await SendMessage(
        whatsapp,
        {
          number: schedule.contact.number,
          body: `\u200e ${formatBody(bodyMessage, ticket)}`,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );

      if (schedule.mediaPath) {
        await verifyMediaMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false,
          whatsapp
        );
      } else {
        await verifyMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false
        );
      }
      // if (ticket) {
      //   await UpdateTicketService({
      //     ticketData: {
      //       sendFarewellMessage: false,
      //       status: schedule.statusTicket,
      //       userId: schedule.ticketUserId || null,
      //       queueId: schedule.queueId || null
      //     },
      //     ticketId: ticket.id,
      //     companyId: ticket.companyId
      //   })
      // }
    } else {
      logger.info(`📤 [SCHEDULE-QUEUE] Modo: Sem abrir ticket`);
      
      // ✅ Verificar se é um template da API Oficial
      const isOficial = whatsapp.provider === "oficial" || 
                       whatsapp.provider === "beta" ||
                       whatsapp.channel === "whatsapp-oficial" || 
                       whatsapp.channel === "whatsapp_oficial";
      
      if (schedule.isTemplate && schedule.templateMetaId && isOficial) {
        logger.info(`📋 [SCHEDULE-QUEUE] DETECTADO TEMPLATE - Enviando via API Oficial`);
        logger.info(`📋 [SCHEDULE-QUEUE] - Template Meta ID: ${schedule.templateMetaId}`);
        logger.info(`📋 [SCHEDULE-QUEUE] - Language: ${schedule.templateLanguage || "pt_BR"}`);
        logger.info(`📋 [SCHEDULE-QUEUE] - To: ${schedule.contact.number}`);
        
        const payload = {
          messaging_product: "whatsapp",
          to: schedule.contact.number.replace(/[^\d]/g, ""),
          type: "template" as const,
          template: {
            name: schedule.templateMetaId,
            language: {
              code: schedule.templateLanguage || "pt_BR"
            },
            components: schedule.templateComponents || []
          }
        };

        logger.info(`📋 [SCHEDULE-QUEUE] Payload preparado:`, JSON.stringify(payload, null, 2));
        logger.info(`📋 [SCHEDULE-QUEUE] Chamando sendMessageWhatsAppOficial...`);

        await sendMessageWhatsAppOficial(
          null,
          whatsapp.token || whatsapp.send_token || whatsapp.tokenMeta,
          payload
        );
        
        logger.info(`✅ [SCHEDULE-QUEUE] Template enviado com sucesso`);
      } else if (isOficial) {
        // ✅ Texto livre na API Oficial (não é template)
        logger.info(`💬 [SCHEDULE-QUEUE] TEXTO LIVRE VIA API OFICIAL`);
        logger.info(`💬 [SCHEDULE-QUEUE] - Provider: ${whatsapp.provider}`);
        logger.info(`💬 [SCHEDULE-QUEUE] - Channel: ${whatsapp.channel}`);
        logger.info(`💬 [SCHEDULE-QUEUE] - Body: ${schedule.body}`);
        logger.info(`💬 [SCHEDULE-QUEUE] - To: ${schedule.contact.number}`);
        
        const payload = {
          messaging_product: "whatsapp",
          to: schedule.contact.number.replace(/[^\d]/g, ""),
          type: "text" as const,
          text: {
            body: schedule.body
          }
        };

        logger.info(`💬 [SCHEDULE-QUEUE] Payload preparado:`, JSON.stringify(payload, null, 2));

        await sendMessageWhatsAppOficial(
          filePath, // mídia se houver
          whatsapp.token || whatsapp.send_token || whatsapp.tokenMeta,
          payload
        );
        
        logger.info(`✅ [SCHEDULE-QUEUE] Texto livre enviado via API Oficial`);
      } else {
        // Envio via Baileys
        logger.info(`💬 [SCHEDULE-QUEUE] TEXTO LIVRE VIA BAILEYS`);
        logger.info(`💬 [SCHEDULE-QUEUE] - Provider: ${whatsapp.provider}`);
        logger.info(`💬 [SCHEDULE-QUEUE] - Body length: ${schedule.body?.length}`);
        
        await SendMessage(
          whatsapp,
          {
            number: schedule.contact.number,
            body: `\u200e ${schedule.body}`,
            mediaPath: filePath,
            companyId: schedule.companyId
          },
          schedule.contact.isGroup
        );
        
        logger.info(`✅ [SCHEDULE-QUEUE] Mensagem enviada via Baileys`);
      }
    }

    if (
      schedule.valorIntervalo > 0 &&
      (isNil(schedule.contadorEnvio) ||
        schedule.contadorEnvio < schedule.enviarQuantasVezes)
    ) {
      let unidadeIntervalo;
      switch (schedule.intervalo) {
        case 1:
          unidadeIntervalo = "days";
          break;
        case 2:
          unidadeIntervalo = "weeks";
          break;
        case 3:
          unidadeIntervalo = "months";
          break;
        case 4:
          unidadeIntervalo = "minuts";
          break;
        default:
          throw new Error("Intervalo inválido");
      }

      function isDiaUtil(date) {
        const dayOfWeek = date.day();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 1 é segunda-feira, 5 é sexta-feira
      }

      function proximoDiaUtil(date) {
        let proximoDia = date.clone();
        do {
          proximoDia.add(1, "day");
        } while (!isDiaUtil(proximoDia));
        return proximoDia;
      }

      // Função para encontrar o dia útil anterior
      function diaUtilAnterior(date) {
        let diaAnterior = date.clone();
        do {
          diaAnterior.subtract(1, "day");
        } while (!isDiaUtil(diaAnterior));
        return diaAnterior;
      }

      const dataExistente = new Date(schedule.sendAt);
      const hora = dataExistente.getHours();
      const fusoHorario = dataExistente.getTimezoneOffset();

      // Realizar a soma da data com base no intervalo e valor do intervalo
      let novaData = new Date(dataExistente); // Clone da data existente para não modificar a original

      console.log(unidadeIntervalo);
      if (unidadeIntervalo !== "minuts") {
        novaData.setDate(
          novaData.getDate() +
          schedule.valorIntervalo *
          (unidadeIntervalo === "days"
            ? 1
            : unidadeIntervalo === "weeks"
              ? 7
              : 30)
        );
      } else {
        novaData.setMinutes(
          novaData.getMinutes() + Number(schedule.valorIntervalo)
        );
        console.log(novaData);
      }

      if (schedule.tipoDias === 5 && !isDiaUtil(novaData)) {
        novaData = diaUtilAnterior(novaData);
      } else if (schedule.tipoDias === 6 && !isDiaUtil(novaData)) {
        novaData = proximoDiaUtil(novaData);
      }

      novaData.setHours(hora);
      novaData.setMinutes(novaData.getMinutes() - fusoHorario);

      await scheduleRecord?.update({
        status: "PENDENTE",
        contadorEnvio: schedule.contadorEnvio + 1,
        sendAt: new Date(novaData.toISOString().slice(0, 19).replace("T", " ")) // Mantendo o formato de hora
      });
    } else {
      await scheduleRecord?.update({
        sentAt: new Date(moment().format("YYYY-MM-DD HH:mm")),
        status: "ENVIADA"
      });
    }
    logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    
    // Logs detalhados com verificações de segurança
    logger.error(`❌ [SCHEDULE-QUEUE] ========================================`);
    logger.error(`❌ [SCHEDULE-QUEUE] ERRO AO ENVIAR MENSAGEM`);
    logger.error(`❌ [SCHEDULE-QUEUE] Schedule ID: ${schedule?.id || 'N/A'}`);
    logger.error(`❌ [SCHEDULE-QUEUE] ========================================`);
    
    // Serializar erro de forma segura
    if (e) {
      logger.error(`❌ [SCHEDULE-QUEUE] Erro Type: ${typeof e}`);
      logger.error(`❌ [SCHEDULE-QUEUE] Erro Name: ${e.name || 'N/A'}`);
      logger.error(`❌ [SCHEDULE-QUEUE] Erro Message: ${e.message || 'Sem mensagem'}`);
      
      if (e.stack) {
        logger.error(`❌ [SCHEDULE-QUEUE] Stack Trace:`);
        logger.error(e.stack);
      }
      
      // Tentar stringify o erro completo
      try {
        logger.error(`❌ [SCHEDULE-QUEUE] Erro Completo (JSON): ${JSON.stringify(e, null, 2)}`);
      } catch (jsonErr) {
        logger.error(`❌ [SCHEDULE-QUEUE] Não foi possível serializar erro como JSON`);
      }
      
      // Mostrar propriedades do erro
      logger.error(`❌ [SCHEDULE-QUEUE] Propriedades do erro:`, Object.keys(e));
    } else {
      logger.error(`❌ [SCHEDULE-QUEUE] Erro é null/undefined!`);
    }
    
    logger.error(`❌ [SCHEDULE-QUEUE] ----------------------------------------`);
    logger.error(`❌ [SCHEDULE-QUEUE] DADOS DO SCHEDULE:`);
    logger.error(`❌ [SCHEDULE-QUEUE] - ID: ${schedule?.id}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Contact ID: ${schedule?.contactId}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Contact Name: ${schedule?.contact?.name}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Contact Number: ${schedule?.contact?.number}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - WhatsApp ID: ${schedule?.whatsappId}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Is Template: ${schedule?.isTemplate}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Template Meta ID: ${schedule?.templateMetaId}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Body Length: ${schedule?.body?.length || 0}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Media Path: ${schedule?.mediaPath || 'N/A'}`);
    logger.error(`❌ [SCHEDULE-QUEUE] ----------------------------------------`);
    logger.error(`❌ [SCHEDULE-QUEUE] DADOS DO WHATSAPP:`);
    logger.error(`❌ [SCHEDULE-QUEUE] - WhatsApp ID: ${whatsapp?.id}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Provider: ${whatsapp?.provider}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Channel: ${whatsapp?.channel}`);
    logger.error(`❌ [SCHEDULE-QUEUE] - Status: ${whatsapp?.status}`);
    logger.error(`❌ [SCHEDULE-QUEUE] ========================================`);
    
    throw e;
  }
}

// ✅ Nova função para enviar lembretes
async function handleSendReminder(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    let whatsapp;

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
    }

    if (!whatsapp) whatsapp = await GetDefaultWhatsApp(schedule.companyId);

    const mensagem = schedule.reminderMessage || schedule.body;

    // Enviar mensagem de lembrete
    await SendWhatsAppMessageAPI({
      body: formatBody(mensagem),
      whatsappId: whatsapp.id,
      contact: schedule.contact
    });

    // Atualizar status do lembrete
    await scheduleRecord?.update({
      reminderSentAt: new Date(moment().format("YYYY-MM-DD HH:mm")),
      reminderStatus: "ENVIADA"
    });

    logger.info(`Lembrete enviado para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      reminderStatus: "ERRO"
    });
    logger.error("SendReminder -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifyCampaigns(job) {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    await new Promise(r => setTimeout(r, 1500));

    const campaigns: { id: number; scheduledAt: string; nextScheduledAt: string }[] =
      await sequelize.query(
        `SELECT id, "scheduledAt", "nextScheduledAt"
         FROM "Campaigns" c
         WHERE (
           ("scheduledAt" BETWEEN NOW() AND NOW() + INTERVAL '3 hour' AND status = 'PROGRAMADA' AND "executionCount" = 0)
           OR
           ("nextScheduledAt" BETWEEN NOW() - INTERVAL '1 minute' AND NOW() + INTERVAL '3 hour' AND status IN ('PROGRAMADA', 'EM_ANDAMENTO') AND "isRecurring" = true)
         )`,
        { type: QueryTypes.SELECT }
      );

    if (campaigns.length > 0) {
      logger.info(`Campanhas encontradas: ${campaigns.length}`);

      const promises = campaigns.map(async campaign => {
        try {
          const result = await sequelize.query(
            `UPDATE "Campaigns" SET status = 'EM_ANDAMENTO'
             WHERE id = ${campaign.id} AND status IN ('PROGRAMADA', 'EM_ANDAMENTO')
             RETURNING id`,
            { type: QueryTypes.SELECT }
          );

          if (!result || result.length === 0) {
            logger.info(`Campanha ${campaign.id} não está mais disponível para processamento`);
            return null;
          }

          const now = moment();
          const executeAt = campaign.nextScheduledAt || campaign.scheduledAt;
          const scheduledAt = moment(executeAt);
          const delay = scheduledAt.diff(now, "milliseconds");

          logger.info(
            `Campanha enviada para a fila: Campanha=${campaign.id}, Delay=${delay}`
          );

          return campaignQueue.add(
            "ProcessCampaign",
            { id: campaign.id, delay },
            {
              priority: 3,
              removeOnComplete: { age: 60 * 60, count: 10 },
              removeOnFail: { age: 60 * 60, count: 10 }
            }
          );
        } catch (err) {
          Sentry.captureException(err);
        }
      });

      const validPromises = (await Promise.all(promises)).filter(p => p !== null);
      logger.info(`${validPromises.length} campanhas processadas efetivamente`);
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error processing campaigns: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

async function getCampaign(id) {
  const campaign = await Campaign.findOne({
    where: { id },
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"],
        required: false, // LEFT JOIN para campanhas que podem usar tags
        include: [
          {
            model: ContactListItem,
            as: "contacts",
            attributes: [
              "id",
              "name",
              "number",
              "email",
              "isWhatsappValid",
              "isGroup"
            ],
            where: { isWhatsappValid: true },
            required: false
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ]
  });

  if (!campaign) {
    return null;
  }

  // Se a campanha usa tagListId em vez de contactListId, buscar contatos por tag
  if (campaign.tagListId && !campaign.contactListId) {
    logger.info(`[TAG-DEBUG] Buscando contatos por tagId: ${campaign.tagListId} para campanha: ${id}, companyId: ${campaign.companyId}`);

    // Primeiro, vamos verificar quais contatos realmente têm essa tag
    const contactTags = await ContactTag.findAll({
      where: { tagId: campaign.tagListId },
      attributes: ["contactId", "tagId"],
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "companyId", "active"]
        }
      ]
    });

    logger.info(`[TAG-DEBUG] ContactTags encontrados para tagId ${campaign.tagListId}:`, contactTags.map(ct => ({
      contactId: ct.contactId,
      tagId: ct.tagId,
      contactName: ct.contact?.name,
      contactNumber: ct.contact?.number,
      contactCompanyId: ct.contact?.companyId,
      contactActive: ct.contact?.active
    })));

    // Buscar contatos usando uma abordagem mais robusta
    const contactIds = await ContactTag.findAll({
      where: { tagId: campaign.tagListId },
      attributes: ["contactId"]
    });

    const contactIdList = contactIds.map(ct => ct.contactId);
    logger.info(`[TAG-DEBUG] ContactIds encontrados para tagId ${campaign.tagListId}:`, contactIdList);

    const contacts = await Contact.findAll({
      attributes: [
        "id",
        "name",
        "number",
        "email",
        "isGroup"
      ],
      where: {
        id: { [Op.in]: contactIdList },
        companyId: campaign.companyId,
        active: true // Apenas contatos ativos
      }
    });

    logger.info(`[TAG-DEBUG] Contatos encontrados via Contact.findAll:`, contacts.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      companyId: c.companyId
    })));

    // Verificação adicional: confirmar que os contatos realmente têm a tag correta
    for (const contact of contacts) {
      const contactTags = await ContactTag.findAll({
        where: { contactId: contact.id },
        attributes: ["tagId"]
      });

      const tagIds = contactTags.map(ct => ct.tagId);
      logger.info(`[TAG-DEBUG] Contato ${contact.id} (${contact.name}) tem as tags:`, tagIds);

      if (!tagIds.includes(Number(campaign.tagListId))) {
        logger.error(`[TAG-DEBUG] ERRO: Contato ${contact.id} (${contact.name}) não deveria estar na tag ${campaign.tagListId}!`);
      }
    }

    logger.info(`[TAG-DEBUG] Total de ${contacts.length} contatos encontrados para tag ${campaign.tagListId}`);

    // Estruturar os dados no mesmo formato que ContactListItem para compatibilidade
    const formattedContacts = contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      number: contact.number,
      email: contact.email,
      isWhatsappValid: true, // Assumir válido se está na lista de contatos
      isGroup: contact.isGroup || false
    }));

    // Criar uma estrutura similar à contactList para compatibilidade
    // Usando any para contornar a tipagem rígida do Sequelize
    (campaign as any).contactList = {
      id: null,
      name: `Tag ${campaign.tagListId}`,
      contacts: formattedContacts
    };
  }

  return campaign;
}

async function getContact(id, campaignId = null) {
  logger.info(`[RDS-CAMPAIGN-DEBUG] Buscando contato com ID: ${id}, Campaign ID: ${campaignId}`);

  // Se temos campaignId, buscar informações da campanha para determinar o tipo
  let companyId = null;
  let isTagCampaign = false;
  if (campaignId) {
    const campaign = await Campaign.findByPk(campaignId, { attributes: ["companyId", "tagListId", "contactListId"] });
    if (campaign) {
      companyId = campaign.companyId;
      isTagCampaign = campaign.tagListId && !campaign.contactListId;
    }
  }

  // Para campanhas por tag, buscar diretamente na tabela Contact
  if (isTagCampaign) {
    const whereClause = companyId ? { id, companyId } : { id };
    const contact = await Contact.findOne({
      where: whereClause,
      attributes: ["id", "name", "number", "email", "isGroup"]
    });

    if (contact) {
      logger.info(`[RDS-CAMPAIGN-DEBUG] Contato encontrado em Contact (campanha por tag): ${contact.name} (Company: ${contact.companyId || 'N/A'})`);
      return contact;
    }

    logger.error(`[RDS-CAMPAIGN-DEBUG] ERRO: Contato com ID ${id} não encontrado na tabela Contact para campanha por tag (Company filter: ${companyId || 'none'})`);
    return null;
  }

  // Para campanhas por lista de contatos, buscar primeiro em ContactListItem
  const contactListItem = await ContactListItem.findByPk(id, {
    attributes: ["id", "name", "number", "email", "isGroup"]
  });

  if (contactListItem) {
    logger.info(`[RDS-CAMPAIGN-DEBUG] Contato encontrado em ContactListItem: ${contactListItem.name}`);
    return contactListItem;
  }

  // Fallback: buscar na tabela Contact
  const whereClause = companyId ? { id, companyId } : { id };
  const contact = await Contact.findOne({
    where: whereClause,
    attributes: ["id", "name", "number", "email", "isGroup"]
  });

  if (contact) {
    logger.info(`[RDS-CAMPAIGN-DEBUG] Contato encontrado em Contact (fallback): ${contact.name} (Company: ${contact.companyId || 'N/A'})`);
    return contact;
  }

  logger.error(`[RDS-CAMPAIGN-DEBUG] ERRO: Contato com ID ${id} não encontrado em nenhuma tabela (Company filter: ${companyId || 'none'})`);
  return null;
}

async function getSettings(campaign): Promise<CampaignSettings> {
  try {
    const settings = await CampaignSetting.findAll({
      where: { companyId: campaign.companyId },
      attributes: ["key", "value"]
    });

    let messageInterval: number = 20;
    let longerIntervalAfter: number = 20;
    let greaterInterval: number = 60;
    let variables: any[] = [];

    settings.forEach(setting => {
      if (setting.key === "messageInterval") {
        messageInterval = JSON.parse(setting.value);
      }
      if (setting.key === "longerIntervalAfter") {
        longerIntervalAfter = JSON.parse(setting.value);
      }
      if (setting.key === "greaterInterval") {
        greaterInterval = JSON.parse(setting.value);
      }
      if (setting.key === "variables") {
        variables = JSON.parse(setting.value);
      }
    });

    return {
      messageInterval,
      longerIntervalAfter,
      greaterInterval,
      variables
    };
  } catch (error) {
    console.log(error);
    throw error; // rejeita a Promise com o erro original
  }
}

export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

async function sleep(seconds) {
  logger.info(
    `Sleep de ${seconds} segundos iniciado: ${moment().format("HH:mm:ss")}`
  );
  return new Promise(resolve => {
    setTimeout(() => {
      logger.info(
        `Sleep de ${seconds} segundos finalizado: ${moment().format(
          "HH:mm:ss"
        )}`
      );
      resolve(true);
    }, parseToMilliseconds(seconds));
  });
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(msg: string, variables: any[], contact: any) {
  let finalMessage = msg;

  if (finalMessage.includes("{nome}")) {
    finalMessage = finalMessage.replace(/{nome}/g, contact.name);
  }

  if (finalMessage.includes("{email}")) {
    finalMessage = finalMessage.replace(/{email}/g, contact.email);
  }

  if (finalMessage.includes("{numero}")) {
    finalMessage = finalMessage.replace(/{numero}/g, contact.number);
  }

  if (variables[0]?.value !== "[]") {
    variables.forEach(variable => {
      if (finalMessage.includes(`{${variable.key}}`)) {
        const regex = new RegExp(`{${variable.key}}`, "g");
        finalMessage = finalMessage.replace(regex, variable.value);
      }
    });
  }

  return finalMessage;
}

const checkerWeek = async () => {
  const sab = moment().day() === 6;
  const dom = moment().day() === 0;

  const sabado = await CampaignSetting.findOne({
    where: { key: "sabado" }
  });

  const domingo = await CampaignSetting.findOne({
    where: { key: "domingo" }
  });

  if (sabado?.value === "false" && sab) {
    messageQueue.pause();
    return true;
  }

  if (domingo?.value === "false" && dom) {
    messageQueue.pause();
    return true;
  }

  messageQueue.resume();
  return false;
};

const checkTime = async () => {
  const startHour = await CampaignSetting.findOne({
    where: {
      key: "startHour"
    }
  });

  const endHour = await CampaignSetting.findOne({
    where: {
      key: "endHour"
    }
  });

  const hour = startHour.value as unknown as number;
  const endHours = endHour.value as unknown as number;

  const timeNow = moment().format("HH:mm") as unknown as number;

  if (timeNow <= endHours && timeNow >= hour) {
    messageQueue.resume();

    return true;
  }

  logger.info(
    `Envio inicia as ${hour} e termina as ${endHours}, hora atual ${timeNow} não está dentro do horário`
  );
  messageQueue.clean(0, "delayed");
  messageQueue.clean(0, "wait");
  messageQueue.clean(0, "active");
  messageQueue.clean(0, "completed");
  messageQueue.clean(0, "failed");
  messageQueue.pause();

  return false;
};

// const checkerLimitToday = async (whatsappId: number) => {
//   try {

//     const setting = await SettingMessage.findOne({
//       where: { whatsappId: whatsappId }
//     });

//     const lastUpdate = moment(setting.dateStart);

//     const now = moment();

//     const passou = now.isAfter(lastUpdate, "day");

//     if (setting.sendToday <= setting.limit) {
//       await setting.update({
//         dateStart: moment().format()
//       });

//       return true;
//     }

//     const zerar = true
//     if(passou) {
//       await setting.update({
//         sendToday: 0,
//         dateStart: moment().format()
//       });

//       setting.reload();
//     }

//     setting.reload();

//     logger.info(`Enviada hoje ${setting.sendToday} limite ${setting.limit}`);
//     // sendMassMessage.clean(0, "delayed");
//     // sendMassMessage.clean(0, "wait");
//     // sendMassMessage.clean(0, "active");
//     // sendMassMessage.clean(0, "completed");
//     // sendMassMessage.clean(0, "failed");
//     // sendMassMessage.pause();
//     return false;
//   } catch (error) {
//     logger.error("conexão não tem configuração de envio.");
//   }
// };

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}

async function verifyAndFinalizeCampaign(campaign) {
  // Garantir que a campanha tenha os contatos carregados
  const campaignWithContacts = await getCampaign(campaign.id);
  const { companyId, contacts } = campaignWithContacts.contactList;

  // Contar mensagens entregues com sucesso
  const deliveredCount = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      deliveredAt: {
        [Op.ne]: null
      },
      confirmation: campaign.confirmation ? true : { [Op.or]: [null, false] }
    }
  });

  // ✅ SOLUÇÃO 1 e 2: Contar total de registros processados (entregues + falhados)
  const totalProcessed = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      [Op.or]: [
        { deliveredAt: { [Op.ne]: null } },
        { failedAt: { [Op.ne]: null } }
      ]
    }
  });

  // Contar falhas para relatório
  const failedCount = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      failedAt: { [Op.ne]: null }
    }
  });

  logger.info(
    `[VERIFY CAMPAIGN] Campanha ${campaign.id}: ${deliveredCount} entregues, ${failedCount} falharam, ${totalProcessed}/${contacts.length} processados`
  );

  const realExecutionCount = Math.floor(totalProcessed / contacts.length);

  // ✅ LÓGICA CORRIGIDA: Verificar se todos os contatos foram processados
  if (totalProcessed >= contacts.length) {
    // Salvar executionCount antigo antes de atualizar
    const oldExecutionCount = campaign.executionCount;
    
    // Atualizar executionCount se necessário
    if (realExecutionCount > oldExecutionCount) {
      logger.info(
        `[VERIFY CAMPAIGN] Atualizando executionCount da campanha ${campaign.id} de ${oldExecutionCount} para ${realExecutionCount}`
      );

      await campaign.update({
        executionCount: realExecutionCount,
        lastExecutedAt: new Date()
      });
    }

    // Verificar se deve finalizar (usar realExecutionCount calculado, não o do banco)
    if (campaign.isRecurring) {
      // Verificar se atingiu limite de execuções
      if (campaign.maxExecutions && realExecutionCount >= campaign.maxExecutions) {
        logger.info(
          `[RDS-VERIFY CAMPAIGN] Campanha ${campaign.id} atingiu limite de ${campaign.maxExecutions} execuções - finalizando`
        );
        await campaign.update({
          status: "FINALIZADA",
          completedAt: moment()
        });
      } else {
        logger.info(
          `[RDS-VERIFY CAMPAIGN] Campanha ${campaign.id} é recorrente - agendando próxima execução (${realExecutionCount}/${campaign.maxExecutions || 'ilimitado'})`
        );
        await RecurrenceService.scheduleNextExecution(campaign.id);
      }
    } else {
      // Campanha NÃO recorrente - sempre finaliza quando completa
      logger.info(
        `[RDS-VERIFY CAMPAIGN] Campanha ${campaign.id} não é recorrente - finalizando (${deliveredCount} entregues, ${failedCount} falharam)`
      );
      await campaign.update({
        status: "FINALIZADA",
        completedAt: moment()
      });
    }
  }

  const io = getIO();
  io.of(String(companyId)).emit(`company-${campaign.companyId}-campaign`, {
    action: "update",
    record: campaign
  });
}

async function handleProcessCampaign(job) {
  try {
    const { id }: ProcessCampaignData = job.data;
    const campaign = await getCampaign(id);
    const settings = await getSettings(campaign);
    if (campaign) {
      const { contacts } = campaign.contactList;
      if (isArray(contacts)) {
        const contactData = contacts.map(contact => ({
          contactId: contact.id,
          campaignId: campaign.id,
          variables: settings.variables,
          isGroup: contact.isGroup
        }));

        // const baseDelay = job.data.delay || 0;
        const longerIntervalAfter = parseToMilliseconds(
          settings.longerIntervalAfter
        );
        const greaterInterval = parseToMilliseconds(settings.greaterInterval);
        const messageInterval = settings.messageInterval;

        let baseDelay = campaign.scheduledAt;

        // const isOpen = await checkTime();
        // const isFds = await checkerWeek();

        const queuePromises = [];
        for (let i = 0; i < contactData.length; i++) {
          baseDelay = addSeconds(
            baseDelay,
            i > longerIntervalAfter ? greaterInterval : messageInterval
          );

          const { contactId, campaignId, variables } = contactData[i];
          const delay = calculateDelay(
            i,
            baseDelay,
            longerIntervalAfter,
            greaterInterval,
            messageInterval
          );
          // if (isOpen || !isFds) {
          const queuePromise = campaignQueue.add(
            "PrepareContact",
            { contactId, campaignId, variables, delay },
            { removeOnComplete: true }
          );
          queuePromises.push(queuePromise);
          logger.info(
            `[RDS-Campaign Update] Registro enviado pra fila de disparo: Campanha=${campaign.id};Contato=${contacts[i].name};delay=${delay}`
          );
          // }
        }
        await Promise.all(queuePromises);
        // await campaign.update({ status: "EM_ANDAMENTO" });
      }
    }
  } catch (err: any) {
    Sentry.captureException(err);
  }
}

function calculateDelay(
  index,
  baseDelay,
  longerIntervalAfter,
  greaterInterval,
  messageInterval
) {
  const diffSeconds = differenceInSeconds(baseDelay, new Date());
  if (index > longerIntervalAfter) {
    return diffSeconds * 1000 + greaterInterval;
  } else {
    return diffSeconds * 1000 + messageInterval;
  }
}

async function handlePrepareContact(job) {
  try {
    const { contactId, campaignId, delay, variables }: PrepareContactData = job.data;
    const campaign = await getCampaign(campaignId);
    const contact = await getContact(contactId, campaignId);

    if (!contact) {
      logger.error(`[RDS-CAMPAIGN-DEBUG] Não foi possível processar campanha ${campaignId} para contato ${contactId}: Contato não encontrado`);
      return;
    }

    if (!contact.number) {
      logger.error(`[RDS-CAMPAIGN-DEBUG] Contato ${contactId} (${contact.name || 'sem nome'}) não possui número de telefone`);
      return;
    }

    const campaignShipping: any = {};
    campaignShipping.number = contact.number;

    if (campaign.tagListId && !campaign.contactListId) {
      logger.info(`[RDS-CAMPAIGN-DEBUG] Campanha por tag - usando contactId null para Contact ID: ${contactId}`);
      campaignShipping.contactId = null;
    } else {
      campaignShipping.contactId = contactId;
    }

    campaignShipping.campaignId = campaignId;
    const messages = getCampaignValidMessages(campaign);

    if (messages.length >= 0) {
      const radomIndex = randomValue(0, messages.length);

      const message = getProcessedMessage(
        messages[radomIndex] || "",
        variables,
        contact
      );

      campaignShipping.message = message === null ? "" : `\u200c ${message}`;
    }
    if (campaign.confirmation) {
      const confirmationMessages =
        getCampaignValidConfirmationMessages(campaign);
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        const message = getProcessedMessage(
          confirmationMessages[radomIndex] || "",
          variables,
          contact
        );
        campaignShipping.confirmationMessage = `\u200c ${message}`;
      }
    }
    let record, created;

    if (campaign.isRecurring && campaign.executionCount > 0) {
      record = await CampaignShipping.create(campaignShipping);
      created = true;
      logger.info(`[RDS-RECURRING] Novo CampaignShipping criado para execução ${campaign.executionCount + 1}`);
    } else {
      let whereClause;
      if (campaign.tagListId && !campaign.contactListId) {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          number: campaignShipping.number
        };
      } else {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          contactId: campaignShipping.contactId
        };
      }

      [record, created] = await CampaignShipping.findOrCreate({
        where: whereClause,
        defaults: campaignShipping
      });
    }

    if (
      !created &&
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      record.set(campaignShipping);
      await record.save();
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId
        },
        {
          delay
        }
      );

      await record.update({ jobId: String(nextJob.id) });
    }

  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

async function handleDispatchCampaign(job) {
  const { data } = job;
  const { campaignShippingId, campaignId }: DispatchCampaignData = data;
  
  try {
    const campaign = await getCampaign(campaignId);

    if (!campaign.whatsapp) {
      logger.error(
        `campaignQueue -> DispatchCampaign -> error: whatsapp not found`
      );
      return;
    }

    // ✅ Buscar informações do WhatsApp ANTES de tentar wbot
    const whatsapp = await Whatsapp.findByPk(campaign.whatsappId);
    
    if (!whatsapp) {
      logger.error(
        `campaignQueue -> DispatchCampaign -> error: whatsapp ${campaign.whatsappId} not found`
      );
      return;
    }

    logger.info(
      `Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId};Canal=${whatsapp.channel}`
    );

    // ✅ Apenas busca wbot se NÃO for WhatsApp Oficial
    let wbot = null;
    if (whatsapp.channel !== "whatsapp_oficial") {
      wbot = await GetWhatsappWbot(campaign.whatsapp);

      if (!wbot) {
        logger.error(
          `campaignQueue -> DispatchCampaign -> error: wbot not found for Baileys connection`
        );
        return;
      }

      if (!wbot?.user?.id) {
        logger.error(
          `campaignQueue -> DispatchCampaign -> error: wbot user not found for Baileys connection`
        );
        return;
      }
    }

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );

    let chatId;
    if (campaignShipping.contact && campaignShipping.contact.isGroup) {
      chatId = `${campaignShipping.number}@g.us`;
    } else {
      const isGroupNumber = campaignShipping.number.includes('@') || campaignShipping.number.length > 15;
      chatId = isGroupNumber
        ? `${campaignShipping.number}@g.us`
        : `${campaignShipping.number}@s.whatsapp.net`;
    }

    if (campaign.openTicket === "enabled") {
      const [contact] = await Contact.findOrCreate({
        where: {
          number: campaignShipping.number,
          companyId: campaign.companyId
        },
        defaults: {
          companyId: campaign.companyId,
          name: campaignShipping.contact ? campaignShipping.contact.name : "Contato da Campanha",
          number: campaignShipping.number,
          email: campaignShipping.contact ? campaignShipping.contact.email : "",
          whatsappId: campaign.whatsappId,
          profilePicUrl: ""
        }
      });

      let ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId: campaign.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket) {
        ticket = await Ticket.create({
          companyId: campaign.companyId,
          contactId: contact.id,
          whatsappId: whatsapp.id,
          queueId: campaign?.queueId,
          userId: campaign?.userId,
          status: campaign?.statusTicket
        });
      }

      ticket = await ShowTicketService(ticket.id, campaign.companyId);

      // ✅ Verifica se é WhatsApp Oficial e tem template configurado
      if (whatsapp.channel === "whatsapp_oficial" && campaign.templateId) {
        logger.info(`Enviando template da Meta para campanha ${campaignId}`);
        
        const template = await QuickMessage.findByPk(campaign.templateId, {
          include: [{ model: QuickMessageComponent, as: "components" }]
        });

        if (!template) {
          throw new Error(`Template ${campaign.templateId} não encontrado`);
        }

        // Monta estrutura do template (igual ao MessageController)
        let templateData: IMetaMessageTemplate = {
          name: template.shortcode,
          language: { code: template.language }
        };

        let buttonsToSave = [];

        // Processa variáveis se houver (seguindo exatamente o MessageController)
        if (campaign.templateVariables) {
          const variables = JSON.parse(campaign.templateVariables);

          if (Object.keys(variables).length > 0) {
            templateData = {
              name: template.shortcode,
              language: { code: template.language }
            };

            if (Array.isArray(template.components) && template.components.length > 0) {
              template.components.forEach((component, index) => {
                const componentType = component.type.toLowerCase() as "header" | "body" | "footer" | "button";
                
                // Verifique se há variáveis para o componente atual
                if (variables[componentType] && Object.keys(variables[componentType]).length > 0) {
                  let newComponent;

                  if (componentType.replace("buttons", "button") === "button") {
                    const buttons = JSON.parse(component.buttons);
                    buttons.forEach((button, btnIndex) => {
                      const subButton = Object.values(variables[componentType]);
                      subButton.forEach((sub: any, indexSub) => {
                        // Verifica se o buttonIndex corresponde ao button.index
                        if (sub.buttonIndex === btnIndex) {
                          const buttonType = button.type;
                          newComponent = {
                            type: componentType.replace("buttons", "button"),
                            sub_type: buttonType,
                            index: btnIndex,
                            parameters: []
                          };
                        }
                      });
                    });
                  } else {
                    newComponent = {
                      type: componentType,
                      parameters: []
                    };
                  }

                  if (newComponent) {
                    Object.keys(variables[componentType]).forEach(key => {
                      if (componentType.replace("buttons", "button") === "button") {
                        if ((newComponent as any)?.sub_type === "COPY_CODE") {
                          newComponent.parameters.push({
                            type: "coupon_code",
                            coupon_code: variables[componentType][key].value
                          });
                        } else {
                          newComponent.parameters.push({
                            type: "text",
                            text: variables[componentType][key].value
                          });
                        }
                      } else {
                        if (template.components[index].format === 'IMAGE') {
                          newComponent.parameters.push({
                            type: "image",
                            image: { link: variables[componentType][key].value }
                          });
                        } else {
                          const variableValue = variables[componentType][key].value;
                          newComponent.parameters.push({
                            type: "text",
                            text: variableValue
                          });
                        }
                      }
                    });
                  }

                  if (!Array.isArray(templateData.components)) {
                    templateData.components = [];
                  }
                  templateData.components.push(newComponent as IMetaMessageTemplateComponents);
                }
              });
            }
          }
        }

        // Processa botões para salvar (igual ao MessageController)
        if (template.components.length > 0) {
          for (const component of template.components) {
            if (component.type === 'BUTTONS') {
              buttonsToSave.push(component.buttons);
            }
          }
        }

        const bodyToSave = campaignShipping.message.concat('||||', JSON.stringify(buttonsToSave));

        // Envia template via API Meta
        await SendWhatsAppOficialMessage({
          body: bodyToSave,
          ticket,
          type: 'template',
          media: null,
          template: templateData,
          quotedMsg: null
        });

        await campaignShipping.update({ deliveredAt: moment() });
      }
      // ✅ Lógica original para WhatsApp não oficial
      else if (whatsapp.status === "CONNECTED") {
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          const confirmationMessage = await wbot.sendMessage(getJidOf(chatId), {
            text: `\u200c ${campaignShipping.confirmationMessage}`
          });

          await verifyMessage(
            confirmationMessage,
            ticket,
            contact,
            null,
            true,
            false
          );

          await campaignShipping.update({ confirmationRequestedAt: moment() });
        } else {
          if (!campaign.mediaPath) {
            const sentMessage = await wbot.sendMessage(getJidOf(chatId), {
              text: `\u200c ${campaignShipping.message}`
            });

            await verifyMessage(
              sentMessage,
              ticket,
              contact,
              null,
              true,
              false
            );
          }

          if (campaign.mediaPath) {
            const publicFolder = path.resolve(__dirname, "..", "public");
            const filePath = path.join(
              publicFolder,
              `company${campaign.companyId}`,
              campaign.mediaPath
            );

            const options = await getMessageOptions(
              campaign.mediaName,
              filePath,
              String(campaign.companyId),
              `\u200c ${campaignShipping.message}`
            );
            if (Object.keys(options).length) {
              if (options.mimetype === "audio/mp4") {
                const audioMessage = await wbot.sendMessage(getJidOf(chatId), {
                  text: `\u200c ${campaignShipping.message}`
                });

                await verifyMessage(
                  audioMessage,
                  ticket,
                  contact,
                  null,
                  true,
                  false
                );
              }
              const sentMessage = await wbot.sendMessage(getJidOf(chatId), {
                ...options
              });

              await verifyMediaMessage(
                sentMessage,
                ticket,
                ticket.contact,
                null,
                false,
                true,
                wbot
              );
            }
          }
          // if (campaign?.statusTicket === 'closed') {
          //   await ticket.update({
          //     status: "closed"
          //   })
          //   const io = getIO();

          //   io.of(String(ticket.companyId))
          //     // .to(ticket.id.toString())
          //     .emit(`company-${ticket.companyId}-ticket`, {
          //       action: "delete",
          //       ticketId: ticket.id
          //     });
          // }
        }
        await campaignShipping.update({ deliveredAt: moment() });
      }
    } else {
      // ✅ Para WhatsApp Baileys quando openTicket está desabilitado
      if (whatsapp.channel !== "whatsapp_oficial" && wbot) {
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          await wbot.sendMessage(getJidOf(chatId), {
            text: campaignShipping.confirmationMessage
          });
          await campaignShipping.update({ confirmationRequestedAt: moment() });
        } else {
          if (!campaign.mediaPath) {
            await wbot.sendMessage(getJidOf(chatId), {
              text: campaignShipping.message
            });
          }

          if (campaign.mediaPath) {
            const publicFolder = path.resolve(__dirname, "..", "public");
            const filePath = path.join(
              publicFolder,
              `company${campaign.companyId}`,
              campaign.mediaPath
            );

            const options = await getMessageOptions(
              campaign.mediaName,
              filePath,
              String(campaign.companyId),
              campaignShipping.message
            );
            if (Object.keys(options).length) {
              if (options.mimetype === "audio/mp4") {
                await wbot.sendMessage(getJidOf(chatId), {
                  text: campaignShipping.message
                });
              }
              await wbot.sendMessage(getJidOf(chatId), { ...options });
            }
          }
        }

        await campaignShipping.update({ deliveredAt: moment() });
      } else if (whatsapp.channel === "whatsapp_oficial" && campaign.templateId) {
        // ✅ WhatsApp Oficial SEM ticket mas COM template (envio direto via API Meta)
        logger.info(`Enviando template da Meta SEM criar ticket: Campanha=${campaignId}`);
        
        const template = await QuickMessage.findByPk(campaign.templateId, {
          include: [{ model: QuickMessageComponent, as: "components" }]
        });

        if (!template) {
          throw new Error(`Template ${campaign.templateId} não encontrado`);
        }

        // Monta estrutura do template (igual ao MessageController)
        let templateData: IMetaMessageTemplate = {
          name: template.shortcode,
          language: { code: template.language }
        };

        let buttonsToSave = [];

        // Processa variáveis se houver
        if (campaign.templateVariables) {
          const variables = JSON.parse(campaign.templateVariables);

          if (Object.keys(variables).length > 0) {
            if (Array.isArray(template.components) && template.components.length > 0) {
              template.components.forEach((component, index) => {
                const componentType = component.type.toLowerCase() as "header" | "body" | "footer" | "button";
                
                if (variables[componentType] && Object.keys(variables[componentType]).length > 0) {
                  let newComponent;

                  if (componentType.replace("buttons", "button") === "button") {
                    const buttons = JSON.parse(component.buttons);
                    buttons.forEach((button, btnIndex) => {
                      const subButton = Object.values(variables[componentType]);
                      subButton.forEach((sub: any) => {
                        if (sub.buttonIndex === btnIndex) {
                          newComponent = {
                            type: componentType.replace("buttons", "button"),
                            sub_type: button.type,
                            index: btnIndex,
                            parameters: []
                          };
                        }
                      });
                    });
                  } else {
                    newComponent = {
                      type: componentType,
                      parameters: []
                    };
                  }

                  if (newComponent) {
                    Object.keys(variables[componentType]).forEach(key => {
                      if (componentType.replace("buttons", "button") === "button") {
                        if ((newComponent as any)?.sub_type === "COPY_CODE") {
                          newComponent.parameters.push({
                            type: "coupon_code",
                            coupon_code: variables[componentType][key].value
                          });
                        } else {
                          newComponent.parameters.push({
                            type: "text",
                            text: variables[componentType][key].value
                          });
                        }
                      } else {
                        if (template.components[index].format === 'IMAGE') {
                          newComponent.parameters.push({
                            type: "image",
                            image: { link: variables[componentType][key].value }
                          });
                        } else {
                          newComponent.parameters.push({
                            type: "text",
                            text: variables[componentType][key].value
                          });
                        }
                      }
                    });
                  }

                  if (!Array.isArray(templateData.components)) {
                    templateData.components = [];
                  }
                  templateData.components.push(newComponent as IMetaMessageTemplateComponents);
                }
              });
            }
          }
        }

        // Processa botões
        if (template.components.length > 0) {
          for (const component of template.components) {
            if (component.type === 'BUTTONS') {
              buttonsToSave.push(component.buttons);
            }
          }
        }

        // Envia template direto via API Meta usando lib
        // Formatar número para padrão WhatsApp (apenas dígitos)
        let cleanNumber = campaignShipping.number.replace(/\D/g, '');
        
        // Se não começar com código do país, adicionar 55 (Brasil)
        if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
          cleanNumber = '55' + cleanNumber;
        }
        
        // API Oficial exige formato +5511999999999
        const formattedNumber = '+' + cleanNumber;
        
        const options: ISendMessageOficial = {
          type: 'template',
          body_template: templateData,
          to: formattedNumber
        };

        logger.info(`Enviando template via API Meta: Numero original=${campaignShipping.number}, Numero formatado=${formattedNumber}`);
        
        // Log detalhado para arquivo
        campaignLogger.info(`Iniciando envio de template`, {
          campaignId,
          contactNumber: campaignShipping.number,
          formattedNumber,
          templateId: campaign.templateId,
          whatsappId: whatsapp.id,
          whatsappName: whatsapp.name
        });

        try {
          const result = await sendMessageWhatsAppOficial(
            null, // sem arquivo
            whatsapp.token || whatsapp.send_token, // Tentar token primeiro
            options
          );

          await campaignShipping.update({ deliveredAt: moment() });
          
          // Log de sucesso
          campaignLogger.templateSent(campaignId, formattedNumber, campaign.templateId, result);
          logger.info(`Template enviado via Meta API sem ticket: Campanha=${campaignId};Numero=${cleanNumber};Status=Enviado`);
        } catch (error) {
          // Log de erro detalhado
          campaignLogger.templateFailed(campaignId, formattedNumber, error);
          logger.error(`Erro ao enviar template: Campanha=${campaignId};Numero=${formattedNumber};Erro=${error.message}`);
          throw error;
        }
      } else if (whatsapp.channel === "whatsapp_oficial") {
        // WhatsApp Oficial sem template - não pode enviar
        logger.warn(
          `WhatsApp Oficial sem template configurado: Campanha=${campaignId};openTicket=disabled requer template`
        );
      }
    }
    await verifyAndFinalizeCampaign(campaign);

    const io = getIO();
    io.of(String(campaign.companyId)).emit(
      `company-${campaign.companyId}-campaign`,
      {
        action: "update",
        record: campaign
      }
    );

    logger.info(
      `Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact ? campaignShipping.contact.name : campaignShipping.number}`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Erro ao enviar campanha: Campanha=${data.campaignId};Erro=${err.message}`);
    console.log(err.stack);
    
    // ✅ SOLUÇÃO 2: Registrar falha no CampaignShipping
    try {
      const failedShipping = await CampaignShipping.findByPk(data.campaignShippingId);
      if (failedShipping && !failedShipping.deliveredAt && !failedShipping.failedAt) {
        await failedShipping.update({
          failedAt: moment(),
          errorMessage: err.message ? err.message.substring(0, 500) : "Erro desconhecido ao enviar mensagem"
        });
        logger.info(`[CAMPAIGN-ERROR] Falha registrada para CampaignShipping ${data.campaignShippingId}`);
      }
    } catch (updateError) {
      logger.error(`[CAMPAIGN-ERROR] Erro ao registrar falha: ${updateError.message}`);
    }
    
    // Ainda assim verifica e finaliza a campanha
    try {
      const failedCampaign = await getCampaign(data.campaignId);
      if (failedCampaign) {
        await verifyAndFinalizeCampaign(failedCampaign);
      }
    } catch (verifyError) {
      logger.error(`[CAMPAIGN-ERROR] Erro ao verificar campanha após falha: ${verifyError.message}`);
    }
  }
}

async function handleLoginStatus(job) {
  const thresholdTime = new Date();
  thresholdTime.setMinutes(thresholdTime.getMinutes() - 5);

  await User.update(
    { online: false },
    {
      where: {
        updatedAt: { [Op.lt]: thresholdTime },
        online: true
      }
    }
  );
}

async function handleResumeTicketsOutOfHour(job) {
  // logger.info("Buscando atendimentos perdidos nas filas");
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"],
          where: {
            timeSendQueue: { [Op.gt]: 0 }
          }
        }
      ]
    });

    companies.map(async c => {
      c.whatsapps.map(async w => {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const tempoPassado = moment()
                .subtract(timeQueue, "minutes")
                .utc()
                .format();
              // const tempoAgora = moment().utc().format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                  // isOutOfHour: false
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: [
                      "id",
                      "name",
                      "number",
                      "email",
                      "profilePicUrl",
                      "acceptAudioMessage",
                      "active",
                      "disableBot",
                      "urlPicture",
                      "lgpdAcceptedAt",
                      "companyId"
                    ],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: [
                      "id",
                      "name",
                      "expiresTicket",
                      "groupAsTicket",
                      "color"
                    ]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await ticket.reload();

                  const io = getIO();
                  io.of(String(companyId))
                    // .to("notification")
                    // .to(ticket.id.toString())
                    .emit(`company-${companyId}-ticket`, {
                      action: "update",
                      ticket,
                      ticketId: ticket.id
                    });

                  // io.to("pending").emit(`company-${companyId}-ticket`, {
                  //   action: "update",
                  //   ticket,
                  // });

                  logger.info(
                    `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                  );
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}

async function handleVerifyQueue(job) {
  // logger.info("Buscando atendimentos perdidos nas filas");
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"]
        }
      ]
    });

    companies.map(async c => {
      c.whatsapps.map(async w => {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const tempoPassado = moment()
                .subtract(timeQueue, "minutes")
                .utc()
                .format();
              // const tempoAgora = moment().utc().format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                  // isOutOfHour: false
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: [
                      "id",
                      "name",
                      "number",
                      "email",
                      "profilePicUrl",
                      "acceptAudioMessage",
                      "active",
                      "disableBot",
                      "urlPicture",
                      "lgpdAcceptedAt",
                      "companyId"
                    ],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: [
                      "id",
                      "name",
                      "expiresTicket",
                      "groupAsTicket",
                      "color"
                    ]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await CreateLogTicketService({
                    userId: null,
                    queueId: idQueue,
                    ticketId: ticket.id,
                    type: "redirect"
                  });

                  await ticket.reload();

                  const io = getIO();
                  io.of(String(companyId))
                    // .to("notification")
                    // .to(ticket.id.toString())
                    .emit(`company-${companyId}-ticket`, {
                      action: "update",
                      ticket,
                      ticketId: ticket.id
                    });

                  // io.to("pending").emit(`company-${companyId}-ticket`, {
                  //   action: "update",
                  //   ticket,
                  // });

                  logger.info(
                    `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                  );
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}

async function handleRandomUser() {
  const jobR = new CronJob("0 */2 * * * *", async () => {
    try {
      const companies = await Company.findAll({
        attributes: ["id", "name"],
        where: {
          status: true
        },
        include: [
          {
            model: Queues,
            attributes: [
              "id",
              "name",
              "ativarRoteador",
              "tempoRoteador",
              "typeRandomMode"
            ],
            where: {
              ativarRoteador: true,
              tempoRoteador: {
                [Op.ne]: 0
              }
            }
          }
        ]
      });

      if (companies) {
        companies.map(async c => {
          c.queues.map(async q => {
            const { count, rows: tickets } = await Ticket.findAndCountAll({
              where: {
                companyId: c.id,
                status: "pending",
                queueId: q.id
              }
            });

            const userRandomMode = q.typeRandomMode;

            // Modified user selection logic
            const getNextUser = async (userIds, companyId, queueId) => {
              if (userRandomMode === "ORDENADO") {
                // Get users ordered by name
                const users = await User.findAll({
                  where: {
                    id: userIds,
                    companyId,
                    profile: "user"
                  },
                  order: [["name", "ASC"]]
                });

                // Get the last assigned user for this queue
                const queueState =
                  (await QueueState.findOne({
                    where: { queueId }
                  })) ||
                  (await QueueState.create({
                    queueId,
                    lastUserIndex: -1
                  }));

                // Find next available online user
                let nextIndex = (queueState.lastUserIndex + 1) % users.length;
                const startIndex = nextIndex;

                do {
                  if (users[nextIndex].online) {
                    // Update the last used index
                    await queueState.update({ lastUserIndex: nextIndex });
                    return users[nextIndex].id;
                  }
                  nextIndex = (nextIndex + 1) % users.length;
                } while (nextIndex !== startIndex);

                return 0; // Return 0 if no online users found
              } else {
                // Original random selection logic
                const randomIndex = Math.floor(Math.random() * userIds.length);
                return userIds[randomIndex];
              }
            };

            // Rest of the existing findUserById function remains the same
            const findUserById = async (userId, companyId) => {
              try {
                const user = await User.findOne({
                  where: {
                    id: userId,
                    companyId
                  }
                });

                if (user && user?.profile === "user") {
                  if (user.online === true) {
                    return user.id;
                  } else {
                    return 0;
                  }
                } else {
                  return 0;
                }
              } catch (errorV) {
                Sentry.captureException(errorV);
                logger.error(
                  "SearchForUsersRandom -> VerifyUsersRandom: error",
                  errorV.message
                );
                throw errorV;
              }
            };

            if (count > 0) {
              for (const ticket of tickets) {
                const { queueId, userId } = ticket;
                const tempoRoteador = q.tempoRoteador;
                const userQueues = await UserQueue.findAll({
                  where: {
                    queueId: queueId
                  }
                });

                const userIds = userQueues.map(userQueue => userQueue.userId);
                const tempoPassadoB = moment()
                  .subtract(tempoRoteador, "minutes")
                  .utc()
                  .toDate();
                const updatedAtV = new Date(ticket.updatedAt);

                let settings = await CompaniesSettings.findOne({
                  where: {
                    companyId: ticket.companyId
                  }
                });
                const sendGreetingMessageOneQueues =
                  settings.sendGreetingMessageOneQueues === "enabled" || false;

                if (!userId) {
                  const nextUserId = await getNextUser(
                    userIds,
                    ticket.companyId,
                    queueId
                  );

                  if (
                    nextUserId !== undefined &&
                    (await findUserById(nextUserId, ticket.companyId)) > 0
                  ) {
                    if (sendGreetingMessageOneQueues) {
                      const ticketToSend = await ShowTicketService(
                        ticket.id,
                        ticket.companyId
                      );
                      await SendWhatsAppMessage({
                        body: `\u200e *Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!`,
                        ticket: ticketToSend
                      });
                    }

                    await UpdateTicketService({
                      ticketData: { status: "pending", userId: nextUserId },
                      ticketId: ticket.id,
                      companyId: ticket.companyId
                    });

                    logger.info(
                      `Ticket ID ${ticket.id} atualizado para UserId ${nextUserId} - ${ticket.updatedAt}`
                    );
                  }
                } else if (
                  userIds.includes(userId) &&
                  tempoPassadoB > updatedAtV
                ) {
                  const availableUserIds = userIds.filter(id => id !== userId);

                  if (availableUserIds.length > 0) {
                    const nextUserId = await getNextUser(
                      availableUserIds,
                      ticket.companyId,
                      queueId
                    );

                    if (
                      nextUserId !== undefined &&
                      (await findUserById(nextUserId, ticket.companyId)) > 0
                    ) {
                      if (sendGreetingMessageOneQueues) {
                        const ticketToSend = await ShowTicketService(
                          ticket.id,
                          ticket.companyId
                        );
                        await SendWhatsAppMessage({
                          body: "*Assistente Virtual*:\nAguarde enquanto localizamos um atendente... Você será atendido em breve!",
                          ticket: ticketToSend
                        });
                      }

                      await UpdateTicketService({
                        ticketData: { status: "pending", userId: nextUserId },
                        ticketId: ticket.id,
                        companyId: ticket.companyId
                      });

                      logger.info(
                        `Ticket ID ${ticket.id} atualizado para UserId ${nextUserId} - ${ticket.updatedAt}`
                      );
                    }
                  }
                }
              }
            }
          });
        });
      }
    } catch (e) {
      Sentry.captureException(e);
      logger.error(
        "SearchForUsersRandom -> VerifyUsersRandom: error",
        e.message
      );
      throw e;
    }
  });

  jobR.start();
}

async function handleProcessLanes() {
  const job = new CronJob("*/1 * * * *", async () => {
    const companies = await Company.findAll({
      include: [
        {
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "useKanban"],
          where: {
            useKanban: true
          }
        }
      ]
    });
    companies.map(async c => {
      try {
        const companyId = c.id;

        const ticketTags = await TicketTag.findAll({
          include: [
            {
              model: Ticket,
              as: "ticket",
              where: {
                status: "open",
                fromMe: true,
                companyId
              },
              attributes: ["id", "contactId", "updatedAt", "whatsappId"]
            },
            {
              model: Tag,
              as: "tag",
              attributes: [
                "id",
                "timeLane",
                "nextLaneId",
                "greetingMessageLane"
              ],
              where: {
                companyId
              }
            }
          ]
        });

        if (ticketTags.length > 0) {
          ticketTags.map(async t => {
            if (
              !isNil(t?.tag.nextLaneId) &&
              t?.tag.nextLaneId > 0 &&
              t?.tag.timeLane > 0
            ) {
              const nextTag = await Tag.findByPk(t?.tag.nextLaneId);

              const dataLimite = new Date();
              dataLimite.setMinutes(
                dataLimite.getMinutes() - Number(t.tag.timeLane)
              );
              const dataUltimaInteracaoChamado = new Date(t.ticket.updatedAt);

              if (dataUltimaInteracaoChamado < dataLimite) {
                await TicketTag.destroy({
                  where: { ticketId: t.ticketId, tagId: t.tagId }
                });
                await TicketTag.create({
                  ticketId: t.ticketId,
                  tagId: nextTag.id
                });

                const whatsapp = await Whatsapp.findByPk(t.ticket.whatsappId);

                if (
                  !isNil(nextTag.greetingMessageLane) &&
                  nextTag.greetingMessageLane !== ""
                ) {
                  const bodyMessage = nextTag.greetingMessageLane;

                  const ticketUpdate = await ShowTicketService(
                    t.ticketId,
                    companyId
                  );

                  const sentMessage = await SendWhatsAppMessage({
                    body: bodyMessage,
                    ticket: ticketUpdate
                  });
                  await verifyMessage(
                    sentMessage,
                    ticketUpdate,
                    ticketUpdate.contact
                  );
                }
              }
            }
          });
        }
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("Process Lanes -> Verify: error", e.message);
        throw e;
      }
    });
  });
  job.start();
}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob("*/1 * * * *", async () => {
    const companies = await Company.findAll({
      where: {
        status: true
      }
    });
    companies.map(async c => {
      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
        throw e;
      }
    });
  });
  job.start();
}

async function handleInvoiceCreate() {
  logger.info("GERANDO RECEITA...");
  const job = new CronJob("* * * * *", async () => {
    try {
      const companies = await Company.findAll({
        where: {
          generateInvoice: true
        }
      });

      for (const c of companies) {
        try {
          const { status, dueDate, id: companyId, planId } = c;
          const date = moment(dueDate).format();
          const timestamp = moment().format();
          const hoje = moment().format("DD/MM/yyyy");
          const vencimento = moment(dueDate).format("DD/MM/yyyy");
          const diff = moment(vencimento, "DD/MM/yyyy").diff(
            moment(hoje, "DD/MM/yyyy")
          );
          const dias = moment.duration(diff).asDays();

          if (status === true) {
            // Verifico se a empresa está a mais de 3 dias sem pagamento
            if (dias <= -3) {
              logger.info(
                `EMPRESA: ${companyId} está VENCIDA A MAIS DE 3 DIAS... INATIVANDO... ${dias}`
              );

              await c.update({ status: false });
              logger.info(`EMPRESA: ${companyId} foi INATIVADA.`);
              logger.info(
                `EMPRESA: ${companyId} Desativando conexões com o WhatsApp...`
              );

              try {
                const whatsapps = await Whatsapp.findAll({
                  where: { companyId },
                  attributes: ["id", "status", "session"]
                });

                for (const whatsapp of whatsapps) {
                  if (whatsapp.session) {
                    await whatsapp.update({
                      status: "DISCONNECTED",
                      session: ""
                    });

                    try {
                      const wbot = getWbot(whatsapp.id);
                      await wbot.logout();
                      logger.info(
                        `EMPRESA: ${companyId} teve o WhatsApp ${whatsapp.id} desconectado...`
                      );
                    } catch (wbotError) {
                      logger.warn(
                        `Erro ao desconectar WhatsApp ${whatsapp.id} da empresa ${companyId}: ${wbotError.message}`
                      );
                    }
                  }
                }
              } catch (whatsappError) {
                logger.error(
                  `Erro ao desconectar WhatsApps da empresa ${companyId}: ${whatsappError.message}`
                );
                Sentry.captureException(whatsappError);
              }
            } else {
              // Buscar o plano da empresa
              const plan = await Plan.findByPk(planId);

              if (!plan) {
                logger.error(
                  `EMPRESA: ${companyId} - Plano não encontrado (planId: ${planId})`
                );
                continue;
              }

              // Verificar faturas em aberto
              const sql = `SELECT * FROM "Invoices" WHERE "companyId" = ${companyId} AND "status" = 'open';`;
              const openInvoices = (await sequelize.query(sql, {
                type: QueryTypes.SELECT
              })) as { id: number; dueDate: Date }[];

              const existingInvoice = openInvoices.find(invoice => {
                const parsedDueDate = moment(invoice.dueDate, "DD/MM/YYYY", true);
                return (
                  parsedDueDate.isValid() &&
                  parsedDueDate.format("DD/MM/YYYY") === vencimento
                );
              });

              if (existingInvoice) {
                // Fatura já existe, não fazer nada
                // logger.info(`Fatura existente para empresa ${companyId}`);
              } else if (openInvoices.length > 0) {
                // Atualizar data de vencimento da fatura existente
                const updateSql = `UPDATE "Invoices" SET "dueDate" = '${date}' WHERE "id" = ${openInvoices[0].id};`;
                await sequelize.query(updateSql, { type: QueryTypes.UPDATE });
                logger.info(
                  `Fatura ${openInvoices[0].id} atualizada para empresa ${companyId}`
                );
              } else {
                // Criar nova fatura - VALIDAÇÃO ADEQUADA DO VALOR
                let valuePlan: string | number = 0;

                // Validação robusta para o valor do plano
                if (plan.amount && typeof plan.amount === 'string') {
                  if (typeof plan.amount === 'string') {
                    valuePlan = plan.amount.replace(",", ".");
                  } else {
                    logger.error(
                      `EMPRESA: ${companyId} - Valor do plano inválido: ${plan.amount}`
                    );
                  }
                  // Definir um valor padrão ou pular esta empresa
                  valuePlan = "0.00";
                }

                // Validação adicional para garantir que é um número válido
                const numericValue = parseFloat(valuePlan.toString());
                if (isNaN(numericValue)) {
                  logger.error(
                    `EMPRESA: ${companyId} - Não foi possível converter valor do plano para número: ${valuePlan}`
                  );
                  valuePlan = "0.00";
                } else {
                  valuePlan = numericValue.toFixed(2);
                }

                // Validação dos outros campos do plano
                const planName = plan.name || 'Plano não definido';
                const planUsers = plan.users || 0;
                const planConnections = plan.connections || 0;
                const planQueues = plan.queues || 0;

                const insertSql = `
                  INSERT INTO "Invoices" (
                    "companyId",
                    "dueDate",
                    detail,
                    status,
                    value,
                    users,
                    connections,
                    queues,
                    "updatedAt",
                    "createdAt"
                  )
                  VALUES (
                    ${companyId},
                    '${date}',
                    '${planName}',
                    'open',
                    ${valuePlan},
                    ${planUsers},
                    ${planConnections},
                    ${planQueues},
                    '${timestamp}',
                    '${timestamp}'
                  );
                `;

                await sequelize.query(insertSql, {
                  type: QueryTypes.INSERT
                });

                logger.info(
                  `Nova fatura criada para empresa ${companyId} - Valor: ${valuePlan}`
                );
              }
            }
          } else {
            // Empresa inativa ou não gera fatura
            // logger.info(`EMPRESA: ${companyId} está INATIVA ou não gera fatura`);
          }
        } catch (companyError) {
          logger.error(
            `Erro ao processar empresa ${c.id}: ${companyError.message}`
          );
          Sentry.captureException(companyError);
          // Continua com a próxima empresa
          continue;
        }
      }
    } catch (generalError) {
      logger.error(`Erro geral na criação de faturas: ${generalError.message}`);
      Sentry.captureException(generalError);
    }
  });

  job.start();
}

handleInvoiceCreate();
handleProcessLanes();
handleCloseTicketsAutomatic();
handleRandomUser();

async function handleLidRetry(job) {
  try {
    const { data } = job;
    const { contactId, whatsappId, companyId, number, retryCount, maxRetries = 5 } = data as LidRetryData;

    logger.info(`[RDS-LID-RETRY] Tentativa ${retryCount} de obter LID para contato ${contactId} (${number})`);

    // Buscar o contato e o whatsapp
    const contact = await Contact.findByPk(contactId);
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!contact) {
      logger.error(`[RDS-LID-RETRY] Contato ${contactId} não encontrado. Cancelando retentativa.`);
      return;
    }

    if (!whatsapp || whatsapp.status !== "CONNECTED") {
      logger.error(`[RDS-LID-RETRY] WhatsApp ${whatsappId} não está conectado. Reagendando retentativa.`);

      // Se ainda não atingiu o limite de retentativas, reagendar
      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: 5 * 60 * 1000, // 5 minutos de espera entre tentativas
            attempts: 1,
            removeOnComplete: true
          }
        );
      } else {
        logger.warn(`[RDS-LID-RETRY] Número máximo de tentativas (${maxRetries}) atingido para contato ${contactId}. Desistindo.`);
      }
      return;
    }

    try {
      // Obter a instância do WhatsApp
      const wbot = getWbot(whatsappId);

      if (!wbot) {
        throw new Error(`Instância WhatsApp ${whatsappId} não encontrada no wbot`);
      }

      // Formatar o número adequadamente se não terminar com @s.whatsapp.net
      const formattedNumber = number.endsWith("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

      // Fazer a consulta ao WhatsApp
      const ow = await wbot.onWhatsApp(formattedNumber);

      if (ow?.[0]?.exists) {
        const lid = ow[0].lid as string;

        if (lid) {
          logger.info(`[RDS-LID-RETRY] LID ${lid} obtido com sucesso para contato ${contactId}`);

          // Verificar e deduplicar contatos
          await checkAndDedup(contact, lid);

          // Criar o mapeamento de LID
          await WhatsappLidMap.findOrCreate({
            where: {
              companyId,
              contactId,
              lid
            },
            defaults: {
              companyId,
              contactId,
              lid
            }
          });

          // Atualizar o campo lid do contato se ainda não estiver preenchido
          if (!contact.lid) {
            await contact.update({ lid });
          }

          logger.info(`[RDS-LID-RETRY] Mapeamento de LID criado/atualizado para contato ${contactId}`);
          return;
        }
      }

      // Se chegou aqui, não conseguiu obter o LID
      logger.warn(`[RDS-LID-RETRY] Não foi possível obter LID para contato ${contactId} (${number})`);

      // Se ainda não atingiu o limite de retentativas, reagendar
      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: Math.pow(2, retryCount) * 60 * 1000, // Backoff exponencial (1min, 2min, 4min, 8min, etc)
            attempts: 1,
            removeOnComplete: true
          }
        );

        logger.info(`[RDS-LID-RETRY] Reagendada tentativa ${retryCount + 1} para contato ${contactId}`);
      } else {
        logger.warn(`[RDS-LID-RETRY] Número máximo de tentativas (${maxRetries}) atingido para contato ${contactId}. Desistindo.`);
      }
    } catch (error) {
      logger.error(`[RDS-LID-RETRY] Erro ao processar retentativa para contato ${contactId}: ${error.message}`);

      // Reagendar em caso de erro se não atingiu o limite de retentativas
      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: Math.pow(2, retryCount) * 60 * 1000, // Backoff exponencial
            attempts: 1,
            removeOnComplete: true
          }
        );
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[RDS-LID-RETRY] Erro geral no processador de retentativas: ${err.message}`);
  }
}

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  messageQueue.process("SendMessage", handleSendMessage);

  scheduleMonitor.process("Verify", handleVerifySchedules);
  scheduleMonitor.process("VerifyReminders", handleVerifyReminders);

  sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);
  sendScheduledMessages.process("SendReminder", handleSendReminder);

  campaignQueue.process("VerifyCampaignsDaatabase", handleVerifyCampaigns);

  campaignQueue.process("ProcessCampaign", handleProcessCampaign);

  campaignQueue.process("PrepareContact", handlePrepareContact);

  campaignQueue.process("DispatchCampaign", handleDispatchCampaign);

  userMonitor.process("VerifyLoginStatus", handleLoginStatus);

  queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);

  lidRetryQueue.process("RetryLidLookup", handleLidRetry);

  initializeBirthdayJobs();

  scheduleMonitor.add(
    "Verify",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify" },
      removeOnComplete: true
    }
  );

  // ✅ Adicionar verificação de lembretes
  scheduleMonitor.add(
    "VerifyReminders",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-reminders" },
      removeOnComplete: true
    }
  );

  campaignQueue.add(
    "VerifyCampaignsDaatabase",
    {},
    {
      repeat: { cron: "*/20 * * * * *", key: "verify-campaing" },
      removeOnComplete: true
    }
  );

  userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "* * * * *", key: "verify-login" },
      removeOnComplete: true
    }
  );

  queueMonitor.add(
    "VerifyQueueStatus",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-queue" },
      removeOnComplete: true
    }
  );
}
