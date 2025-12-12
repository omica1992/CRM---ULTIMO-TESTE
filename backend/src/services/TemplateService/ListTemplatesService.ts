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
    // A API retorna { data: [...], paging: {...} }
    const result = response.data as IResultTemplates;
    const templates = result?.data || [];
    
    console.log(`[TEMPLATES] ✅ Encontrados ${templates.length} templates`);
    console.log(`[TEMPLATES] Estrutura da resposta:`, {
      hasData: !!result?.data,
      hasPaging: !!result?.paging,
      templatesCount: templates.length
    });
    
    if (templates.length > 0) {
      // Mostrar estrutura do primeiro template
      const firstTemplate = templates[0];
      console.log(`[TEMPLATES] ✅ Amostra de template:`);
      console.log(`[TEMPLATES] - id: ${firstTemplate.id}`);
      console.log(`[TEMPLATES] - name: ${firstTemplate.name}`);
      console.log(`[TEMPLATES] - status: ${firstTemplate.status}`);
      console.log(`[TEMPLATES] - category: ${firstTemplate.category}`);
      console.log(`[TEMPLATES] - language: ${firstTemplate.language}`);
    }

    // ✅ CORREÇÃO: Retornar a estrutura completa { data, paging }
    return result;
  } catch (error: any) {
    console.error("Erro ao buscar templates:", error.response?.data || error.message);
    throw new AppError(`Erro ao buscar templates: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default ListTemplatesService;
