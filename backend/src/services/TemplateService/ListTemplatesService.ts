import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import axios from "axios";
import { IResultTemplates } from "../../libs/whatsAppOficial/IWhatsAppOficial.interfaces";

interface Request {
  companyId: number;
  whatsappId: number;
}

const ListTemplatesService = async ({ companyId, whatsappId }: Request): Promise<IResultTemplates> => {
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
                   
                   whatsapp.channel === "whatsapp-oficial" || 
                   whatsapp.channel === "whatsapp_oficial";

  if (!isOficial) {
    throw new AppError("Esta funcionalidade é apenas para API Oficial", 400);
  }

  // Validar variáveis de ambiente
  if (!process.env.URL_API_OFICIAL) {
    throw new AppError("URL_API_OFICIAL não está configurada no .env", 500);
  }

  if (!process.env.TOKEN_API_OFICIAL) {
    throw new AppError("TOKEN_API_OFICIAL não está configurado no .env", 500);
  }

  if (!whatsapp.token) {
    throw new AppError("Token do WhatsApp não configurado", 400);
  }

  try {
    // Usar API Oficial para buscar templates
    const apiUrl = `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}`;
    console.log(`[TEMPLATES] Buscando templates em: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.TOKEN_API_OFICIAL}`,
        'Content-Type': 'application/json'
      }
    });

    // ✅ Log detalhado dos templates retornados
    if (response.data && Array.isArray(response.data)) {
      console.log(`[TEMPLATES] ✅ Encontrados ${response.data.length} templates`);
      
      if (response.data.length > 0) {
        // Mostrar estrutura do primeiro template
        const firstTemplate = response.data[0];
        console.log(`[TEMPLATES] ✅ Amostra de template:`);
        console.log(`[TEMPLATES] - id: ${firstTemplate.id}`);
        console.log(`[TEMPLATES] - name: ${firstTemplate.name}`); // ✅ Nome/shortcode do template
        console.log(`[TEMPLATES] - status: ${firstTemplate.status}`);
        console.log(`[TEMPLATES] - category: ${firstTemplate.category}`);
        console.log(`[TEMPLATES] - language: ${firstTemplate.language}`);
      }
    } else {
      console.log(`[TEMPLATES] ❌ Resposta não contém array de templates:`, response.data);
    }

    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar templates:", error.response?.data || error.message);
    throw new AppError(`Erro ao buscar templates: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default ListTemplatesService;
