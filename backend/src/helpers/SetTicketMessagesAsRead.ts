import { delay, proto, WASocket } from "baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import { setReadMessageWhatsAppOficial } from "../libs/whatsAppOficial/whatsAppOficial.service";
import Whatsapp from "../models/Whatsapp";
import { getWbot } from "../libs/wbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {

  if (ticket.whatsappId) {
    // console.log("SETTING MESSAGES AS READ", ticket.whatsappId)
    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId, companyId: ticket.companyId } });

    if (["open", "group"].includes(ticket.status) && whatsapp && whatsapp.status === 'CONNECTED' && ticket.unreadMessages > 0) {
      try {
        // no baileys temos que marcar cada mensagem como lida
        // não o chat inteiro como é feito no legacy
        const getJsonMessage = await Message.findAll({
          where: {
            ticketId: ticket.id,
            fromMe: false,
            read: false
          },
          order: [["createdAt", "DESC"]]
        });

        if (['whatsapp_oficial'].includes(ticket.channel)) {
          // ✅ API Oficial: Usar função específica
          getJsonMessage.forEach(async message => {
            setReadMessageWhatsAppOficial(whatsapp.token, message.wid);
          });
        } else if (ticket.channel == 'whatsapp') {
          // ✅ Baileys: Verificar se é realmente Baileys antes de usar wbot
          const isOficial = whatsapp.provider === "oficial" || 
                           whatsapp.provider === "beta" ||
                           whatsapp.channel === "whatsapp-oficial" || 
                           whatsapp.channel === "whatsapp_oficial";
          
          if (isOficial) {
            logger.info(`[SET MESSAGES READ] Pulando wbot para API Oficial - Ticket ${ticket.id}`);
            // Para API Oficial, usar a função específica
            getJsonMessage.forEach(async message => {
              setReadMessageWhatsAppOficial(whatsapp.token, message.wid);
            });
          } else {
            // Apenas para Baileys verdadeiro
            const wbot = await getWbot(ticket.whatsappId);

            if (getJsonMessage.length > 0) {

              getJsonMessage.forEach(async message => {
                const msg: proto.IWebMessageInfo = JSON.parse(message.dataJson);
                if (msg.key && msg.key.fromMe === false && !ticket.isBot && (ticket.userId || ticket.isGroup)) {

                  // if (wbot?.ws?.socket?._readyState !== 1) {
                  //   console.log("Aguardando socket Message as Read no MarkAsRead ", wbot?.ws?.socket?._readyState)
                  //   await delay(150);
                  // }

                  await wbot.readMessages([msg.key])
                }
              });
            }
          }
        }

        await Message.update(
          { read: true },
          {
            where: {
              ticketId: ticket.id,
              read: false
            }
          }
        );

        await ticket.update({ unreadMessages: 0 });
        await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

        const io = getIO();

        io.of(ticket.companyId.toString())
          // .to(ticket.status).to("notification")
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "updateUnread",
            ticketId: ticket.id
          });

      } catch (err) {
        logger.warn(
          `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
        );
      }

    }
  }

};

export default SetTicketMessagesAsRead;
