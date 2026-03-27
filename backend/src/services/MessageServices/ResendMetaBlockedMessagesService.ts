import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import { getMetaResendEligibility } from "./MetaResendEligibility";

interface Request {
  companyId: number;
  messageIds: number[];
}

interface ItemResult {
  messageId: number;
  ok: boolean;
  reason?: string;
  resentWid?: string;
}

interface Response {
  total: number;
  successCount: number;
  failedCount: number;
  results: ItemResult[];
}

const isOfficialConnection = (ticket: Ticket): boolean => {
  const ticketChannel = ticket?.channel;
  const whatsappProvider = ticket?.whatsapp?.provider;
  const whatsappChannel = ticket?.whatsapp?.channel;

  return (
    whatsappProvider === "oficial" ||
    whatsappChannel === "whatsapp_oficial" ||
    whatsappChannel === "whatsapp-oficial" ||
    ticketChannel === "whatsapp_oficial" ||
    ticketChannel === "whatsapp-oficial"
  );
};

const ResendMetaBlockedMessagesService = async ({
  companyId,
  messageIds
}: Request): Promise<Response> => {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new AppError("Selecione ao menos uma mensagem para reenvio.", 400);
  }

  const normalizedIds = [...new Set(messageIds.map(id => Number(id)).filter(Boolean))];

  const messages = await Message.findAll({
    where: {
      id: normalizedIds,
      companyId
    },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid", "channel", "whatsappId", "contactId"],
        include: [
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["id", "name", "provider", "channel", "token"]
          },
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number"]
          }
        ]
      }
    ]
  });

  const messagesById = new Map(messages.map(message => [message.id, message]));
  const results: ItemResult[] = [];

  for (const messageId of normalizedIds) {
    const message = messagesById.get(messageId);

    if (!message) {
      results.push({
        messageId,
        ok: false,
        reason: "Mensagem não encontrada para esta empresa."
      });
      continue;
    }

    if (!message.fromMe) {
      results.push({
        messageId,
        ok: false,
        reason: "Apenas mensagens enviadas pela empresa podem ser reenviadas."
      });
      continue;
    }

    if (message.ack !== -1 || !message.deliveryError) {
      results.push({
        messageId,
        ok: false,
        reason: "Mensagem sem bloqueio Meta pendente."
      });
      continue;
    }

    let ticket: Ticket;
    try {
      ticket = await ShowTicketService(message.ticketId, companyId);
    } catch (error) {
      results.push({
        messageId,
        ok: false,
        reason: "Ticket da mensagem não encontrado."
      });
      continue;
    }

    if (!isOfficialConnection(ticket)) {
      results.push({
        messageId,
        ok: false,
        reason: "Reenvio automático disponível apenas para conexão API Oficial."
      });
      continue;
    }

    const eligibility = getMetaResendEligibility({
      mediaType: message.mediaType,
      body: message.body,
      deliveryError: message.deliveryError,
      deliveryErrorCode: message.deliveryErrorCode
    });

    if (!eligibility.eligible) {
      results.push({
        messageId,
        ok: false,
        reason: eligibility.reason || "Mensagem não elegível para reenvio."
      });
      continue;
    }

    try {
      const sendResponse: any = await SendWhatsAppOficialMessage({
        body: message.body,
        ticket,
        type: "text",
        media: null
      });

      const resentWid = sendResponse?.idMessageWhatsApp?.[0];

      results.push({
        messageId,
        ok: true,
        resentWid
      });
    } catch (error: any) {
      results.push({
        messageId,
        ok: false,
        reason: error?.message || "Falha ao reenviar mensagem."
      });
    }
  }

  const successCount = results.filter(item => item.ok).length;
  const failedCount = results.length - successCount;

  return {
    total: results.length,
    successCount,
    failedCount,
    results
  };
};

export default ResendMetaBlockedMessagesService;

