import { WASocket, WAMessage } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
// import OldMessage from "../../models/OldMessage";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import Whatsapp from "../../models/Whatsapp";
import { getJidOf } from "../WbotServices/getJidOf";
import logger from "../../utils/logger";

interface Request {
  messageId: string;
  body: string;
}

const EditWhatsAppMessage = async ({
  messageId,
  body,
}: Request): Promise<{ ticket: Ticket, message: Message }> => {

  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact",
          {
            model: Whatsapp,
            attributes: ["id", "name", "groupAsTicket", "color"]
          },
        ]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;
  const isOfficialConnection =
    ticket.whatsapp?.provider === "oficial" ||
    ticket.whatsapp?.channel === "whatsapp-oficial" ||
    ticket.whatsapp?.channel === "whatsapp_oficial" ||
    ticket.channel === "whatsapp_oficial";

  let parsedMessage: any = null;
  if (message.dataJson) {
    try {
      parsedMessage = JSON.parse(message.dataJson);
    } catch (error) {
      logger.warn(
        `[EDIT MESSAGE] Falha ao fazer parse de dataJson da mensagem ${message.id}`
      );
    }
  }

  const keyToEdit = parsedMessage?.key;
  const canEditRemotely =
    !message.isPrivate &&
    ticket.channel === "whatsapp" &&
    !isOfficialConnection &&
    !!keyToEdit;

  // Tenta editar no WhatsApp apenas quando o canal suporta e há key da mensagem.
  if (canEditRemotely) {
    try {
      const wbot = await GetTicketWbot(ticket);
      await wbot.sendMessage(
        getJidOf(message.remoteJid || ticket),
        {
          text: body,
          edit: keyToEdit
        },
        {}
      );
    } catch (err) {
      logger.warn(
        `[EDIT MESSAGE] Falha ao editar remotamente mensagem ${message.id}. Aplicando fallback local.`
      );
    }
  }

  try {
    const previousBody = message.body;
    await message.update({ body, isEdited: true });

    // Atualiza preview do ticket apenas se a mensagem editada era a última exibida.
    if (ticket.lastMessage === previousBody) {
      await ticket.update({ lastMessage: body });
    }

    await ticket.reload();
    return { ticket: message.ticket, message };
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_EDITING_WAPP_MSG");
  }

};

export default EditWhatsAppMessage;
