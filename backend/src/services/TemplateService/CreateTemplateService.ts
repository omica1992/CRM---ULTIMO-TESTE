import Whatsapp from "../../models/Whatsapp";
import QuickMessage from "../../models/QuickMessage";
import QuickMessageComponent from "../../models/QuickMessageComponent";
import AppError from "../../errors/AppError";
import axios from "axios";
import { getIO } from "../../libs/socket";

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: any;
  buttons?: any[];
}

interface Request {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: TemplateComponent[];
  parameter_format?: 'named' | 'positional';
  companyId: number;
  whatsappId: number;
}

const CreateTemplateService = async (data: Request) => {
  const { companyId, whatsappId, ...templateData } = data;

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
    // ✅ VALIDAÇÃO E CONVERSÃO DO NOME DO TEMPLATE
    // Meta exige: apenas letras minúsculas e sublinhados
    let templateName = templateData.name
      .toLowerCase()                    // Converter para minúsculas
      .normalize('NFD')                 // Normalizar caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9_]/g, '_')     // Substituir caracteres inválidos por _
      .replace(/_+/g, '_')              // Remover underscores duplicados
      .replace(/^_|_$/g, '');           // Remover underscores do início/fim

    console.log(`[CREATE TEMPLATE] Nome original: "${templateData.name}" → Nome convertido: "${templateName}"`);

    // Limpar dados antes de enviar
    const cleanedData: any = {
      name: templateName,
      category: templateData.category,
      language: templateData.language,
      components: templateData.components.map((comp: TemplateComponent) => {
        const cleanedComp: any = {
          type: comp.type
        };
        
        // Adicionar format apenas para HEADER se necessário
        if (comp.format && comp.type === 'HEADER') {
          cleanedComp.format = comp.format;
        }
        
        // Adicionar text apenas se existir
        if (comp.text) {
          cleanedComp.text = comp.text;
        }
        
        // Adicionar example apenas se existir e não estiver vazio
        if (comp.example && comp.example.body_text && comp.example.body_text.length > 0) {
          cleanedComp.example = comp.example;
        }
        
        // Adicionar buttons apenas se existir
        if (comp.buttons && comp.buttons.length > 0) {
          cleanedComp.buttons = comp.buttons;
        }
        
        return cleanedComp;
      })
    };
    
    // Log dos dados enviados
    console.log('[CREATE TEMPLATE] Dados sendo enviados:', JSON.stringify(cleanedData, null, 2));
    console.log('[CREATE TEMPLATE] URL:', `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}`);
    
    // Criar template via API Oficial
    const response = await axios.post(
      `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}`,
      cleanedData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TOKEN_API_OFICIAL}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const createdTemplate = response.data;

    // Salvar como QuickMessage para integração com o sistema
    if (createdTemplate.id) {
      const bodyComponent = templateData.components.find(comp => comp.type === 'BODY');
      
      const quickMessage = await QuickMessage.create({
        shortcode: templateName, // ✅ Usar nome convertido
        message: bodyComponent?.text || '',
        companyId,
        userId: 1, // Sistema
        geral: false,
        visao: false,
        isOficial: true,
        language: templateData.language,
        status: createdTemplate.status || 'PENDING',
        category: templateData.category,
        metaID: createdTemplate.id,
        whatsappId,
      });

      // Salvar componentes do template
      if (templateData.components && templateData.components.length > 0) {
        for (const component of templateData.components) {
          await QuickMessageComponent.create({
            quickMessageId: quickMessage.id,
            type: component.type,
            text: component.text || '',
            format: component.format || 'TEXT',
            example: JSON.stringify(component.example || {}),
            buttons: JSON.stringify(component.buttons || []),
          });
        }
      }

      // Emitir evento via socket
      const io = getIO();
      io.of(String(companyId))
        .emit(`company-${companyId}-quickmessage`, {
          action: "create",
          record: quickMessage
        });
    }

    return createdTemplate;
  } catch (error: any) {
    console.error("Erro ao criar template:", JSON.stringify(error.response?.data, null, 2) || error.message);
    console.error("Status:", error.response?.status);
    console.error("Headers:", error.response?.headers);
    throw new AppError(`Erro ao criar template: ${error.response?.data?.message || error.message}`, 500);
  }
};

export default CreateTemplateService;
