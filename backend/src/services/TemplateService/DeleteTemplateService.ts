import Whatsapp from "../../models/Whatsapp";
import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";
import axios from "axios";
import { getIO } from "../../libs/socket";

interface Request {
  templateName: string;
  companyId: number;
  whatsappId: number;
}

const DeleteTemplateService = async ({ templateName, companyId, whatsappId }: Request) => {
  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão WhatsApp não encontrada", 404);
  }

  // Verificar se é API Oficial
  const isOficial = whatsapp.provider === "oficial" || 
                   whatsapp.provider === "beta" ||
                   whatsapp.channel === "whatsapp-oficial" || 
                   whatsapp.channel === "whatsapp_oficial";

  if (!isOficial) {
    throw new AppError("Esta funcionalidade é apenas para API Oficial", 400);
  }

  try {
    // Deletar template via API Oficial
    const response = await axios.delete(
      `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}/${templateName}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TOKEN_API_OFICIAL}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Remover do banco de dados também
    const deletedCount = await QuickMessage.destroy({
      where: {
        shortcode: templateName,
        companyId,
        isOficial: true,
        whatsappId
      }
    });

    if (deletedCount > 0) {
      // Emitir evento via socket
      const io = getIO();
      io.of(String(companyId))
        .emit(`company-${companyId}-quickmessage`, {
          action: "delete",
          templateName
        });
    }

    return response.data;
  } catch (error: any) {
    console.error("Erro ao deletar template:", error.response?.data || error.message);
    throw new AppError(`Erro ao deletar template: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default DeleteTemplateService;
