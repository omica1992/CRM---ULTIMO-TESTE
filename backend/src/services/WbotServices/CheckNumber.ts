import { WASocket } from "baileys";
import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { Session } from "../../libs/wbot";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
  lid: string;
}

const toJid = (num: string) =>
  num.includes("@") ? num : `${num}@s.whatsapp.net`;

const checker = async (number: string, wbot: Session): Promise<IOnWhatsapp> => {
  const result = await wbot.onWhatsApp(toJid(number));

  if (!result) {
    logger.error({ number }, "Failed to check number on whatsapp");
    throw new AppError("ERR_INVALID_NUMBER", 400);
  }

  if (!result?.[0]?.exists) {
    throw new AppError("ERR_CHECK_NUMBER", 404);
  }

  const lid = (result as any).lid ?? null;

  return {
    jid: result[0]?.jid,
    exists: true,
    lid
  };
};

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false,
  userId?: number,
  whatsapp?: Whatsapp | null
): Promise<IOnWhatsapp> => {
  // Para API Oficial, não tenta obter wbot da sessão em memória
  // pois a API Oficial não mantém sessão Baileys
  if (!whatsapp) {
    try {
      const whatsappList = await GetDefaultWhatsApp(companyId, userId);
      whatsapp = whatsappList;
    } catch (error) {
      // Se não encontrar conexão padrão, tenta qualquer conexão CONNECTED para API Oficial
      const anyConnection = await Whatsapp.findOne({
        where: { status: "CONNECTED", companyId }
      });
      if (anyConnection) {
        whatsapp = anyConnection;
      } else {
        throw error;
      }
    }
  }

  // Para API Oficial, retorna número formatado sem validação de sessão
  if (whatsapp.channel === "whatsapp_oficial") {
    return { jid: toJid(number), exists: true, lid: null };
  }

  // Para Baileys, tenta obter a sessão wbot
  try {
    const wbot = getWbot(whatsapp.id);

    if (isGroup) {
      const meta = await wbot.groupMetadata(number);
      return { jid: meta.id, exists: true, lid: null };
    }

    return checker(number, wbot);
  } catch (error) {
    // Se getWbot falhar e for API Oficial, retorna com validação mínima
    if (whatsapp.channel === "whatsapp_oficial") {
      logger.warn(`[CheckNumber] getWbot falhou para API Oficial, mas continuando: ${error.message}`);
      return { jid: toJid(number), exists: true, lid: null };
    }
    throw error;
  }
};

export default CheckContactNumber;
