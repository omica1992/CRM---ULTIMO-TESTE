import Whatsapp from "../../models/Whatsapp";
import QuickMessage from "../../models/QuickMessage";
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

    console.log(`[TEMPLATES] ✅ Encontrados ${templates.length} templates da Meta API`);

    // ✅ NOVO: Buscar templates rejeitados salvos localmente
    const rejectedTemplates = await QuickMessage.findAll({
      where: {
        companyId,
        whatsappId,
        isTemplate: true,
        status: 'REJECTED'  // ✅ Campo correto: 'status' (não 'templateStatus')
      },
      attributes: ['id', 'shortcode', 'message', 'rejectionReason', 'createdAt']
    });

    console.log(`[TEMPLATES] ✅ Encontrados ${rejectedTemplates.length} templates rejeitados no banco local`);

    // ✅ Converter templates rejeitados para formato da Meta API
    const rejectedTemplatesFormatted = rejectedTemplates.map(qt => ({
      id: `local_${qt.id}`,
      name: qt.shortcode,
      status: 'REJECTED' as const,
      category: 'UTILITY' as const,
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: qt.message || '',
          example: null,
          format: '',
          buttons: null
        }
      ],
      rejectionReason: qt.rejectionReason || undefined
    }));

    // ✅ Mesclar templates da Meta com templates rejeitados locais
    const allTemplates = [...templates, ...rejectedTemplatesFormatted];

    console.log(`[TEMPLATES] ✅ Total de templates (Meta + Locais): ${allTemplates.length}`);

    if (templates.length > 0) {
      // Mostrar estrutura do primeiro template
      const firstTemplate = templates[0];
      console.log(`[TEMPLATES] ✅ Amostra de template da Meta:`);
      console.log(`[TEMPLATES] - id: ${firstTemplate.id}`);
      console.log(`[TEMPLATES] - name: ${firstTemplate.name}`);
      console.log(`[TEMPLATES] - status: ${firstTemplate.status}`);
      console.log(`[TEMPLATES] - category: ${firstTemplate.category}`);
      console.log(`[TEMPLATES] - language: ${firstTemplate.language}`);
    }

    // ✅ CORREÇÃO: Retornar a estrutura completa { data, paging } com templates mesclados
    return {
      ...result,
      data: allTemplates
    };
  } catch (error: any) {
    console.error("Erro ao buscar templates:", error.response?.data || error.message);
    throw new AppError(`Erro ao buscar templates: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default ListTemplatesService;
