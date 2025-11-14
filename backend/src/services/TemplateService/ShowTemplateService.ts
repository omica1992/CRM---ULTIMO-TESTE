import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import axios from "axios";

interface Request {
  templateId: string;
  companyId: number;
  whatsappId: number;
}

const ShowTemplateService = async ({ templateId, companyId, whatsappId }: Request) => {
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
    // Buscar template específico via API Oficial
    const response = await axios.get(
      `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}/${templateId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TOKEN_API_OFICIAL}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar template:", error.response?.data || error.message);
    throw new AppError(`Erro ao buscar template: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default ShowTemplateService;
