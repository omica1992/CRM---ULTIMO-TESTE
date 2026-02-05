import Whatsapp from "../../models/Whatsapp";
import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";
import axios from "axios";
import { Op } from "sequelize";
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
    // Critério: status = 'REJECTED' + rejectionReason preenchido + isOficial = true
    const rejectedTemplates = await QuickMessage.findAll({
      where: {
        companyId,
        whatsappId,
        isOficial: true,  // ✅ Templates da API Oficial
        status: 'REJECTED',  // ✅ Status rejeitado
        rejectionReason: { [Op.ne]: null }  // ✅ Tem motivo de rejeição
      },
      attributes: ['id', 'shortcode', 'message', 'rejectionReason', 'createdAt']
    });

    console.log(`[TEMPLATES] ✅ Encontrados ${rejectedTemplates.length} templates rejeitados no banco local`);

    // ✅ Criar mapa de rejectionReason por nome de template
    const rejectionReasonMap = new Map();
    rejectedTemplates.forEach(qt => {
      rejectionReasonMap.set(qt.shortcode.toLowerCase(), qt.rejectionReason);
    });

    // ✅ Mesclar rejectionReason nos templates da Meta que estão rejeitados
    const templatesWithReasons = templates.map(template => {
      if (template.status === 'REJECTED' && rejectionReasonMap.has(template.name.toLowerCase())) {
        return {
          ...template,
          rejectionReason: rejectionReasonMap.get(template.name.toLowerCase())
        };
      }
      return template;
    });

    // ✅ Adicionar templates rejeitados que NÃO estão na Meta (foram deletados da Meta mas salvos localmente)
    const metaTemplateNames = new Set(templates.map(t => t.name.toLowerCase()));
    const orphanedRejected = rejectedTemplates
      .filter(qt => !metaTemplateNames.has(qt.shortcode.toLowerCase()))
      .map(qt => ({
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

    // ✅ Combinar: templates da Meta (com rejectionReason mesclado) + templates órfãos
    const allTemplates = [...templatesWithReasons, ...orphanedRejected];

    console.log(`[TEMPLATES] ✅ Total de templates: ${allTemplates.length} (${templates.length} da Meta + ${orphanedRejected.length} órfãos locais, ${templatesWithReasons.filter(t => t.rejectionReason).length} mesclados)`);

    if (templates.length > 0) {
      // Mostrar estrutura do primeiro template
      const firstTemplate = templates[0];
      console.log(`[TEMPLATES] ✅ Amostra de template da Meta:`);
      console.log(`[TEMPLATES] - id: ${firstTemplate.id}`);
      console.log(`[TEMPLATES] - name: ${firstTemplate.name}`);
      console.log(`[TEMPLATES] - status: ${firstTemplate.status}`);
      console.log(`[TEMPLATES] - category: ${firstTemplate.category}`);
      console.log(`[TEMPLATES] - language: ${firstTemplate.language}`);

      const debugTemplate = templates.find(t => t.name === 'somos_teste_botao4');
      if (debugTemplate) {
        console.log(`[TEMPLATES DEBUG] Template somos_teste_botao4 found:`);
        console.log(JSON.stringify(debugTemplate, null, 2));
        const fs = require('fs');
        fs.writeFileSync('debug_template.json', JSON.stringify(debugTemplate, null, 2));
      } else {
        console.log(`[TEMPLATES DEBUG] Template somos_teste_botao4 NOT FOUND in list`);
      }
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
