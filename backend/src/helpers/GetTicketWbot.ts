import { WASocket } from "baileys";
import { getWbot, Session } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";

const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(ticket.companyId);
    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  // ✅ CORREÇÃO: Verificar se é API Oficial antes de tentar usar wbot
  let whatsapp = ticket.whatsapp;
  if (!whatsapp) {
    whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  }

  if (whatsapp) {
    const isOficial = whatsapp.provider === "oficial" || 
                     whatsapp.provider === "beta" ||
                     whatsapp.channel === "whatsapp-oficial" || 
                     whatsapp.channel === "whatsapp_oficial";
    
    if (isOficial) {
      throw new AppError("GetTicketWbot não deve ser usado para API Oficial. Use SendWhatsAppOficialMessage em vez disso.");
    }
  }

  const wbot = getWbot(ticket.whatsappId);
  return wbot;
};

export default GetTicketWbot;
