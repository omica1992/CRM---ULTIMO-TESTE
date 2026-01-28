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
    console.log(`[CREATE TEMPLATE] Categoria: ${templateData.category}`);
    console.log(`[CREATE TEMPLATE] Idioma: ${templateData.language}`);
    console.log(`[CREATE TEMPLATE] Total de componentes: ${templateData.components.length}`);

    // Validar URLs de mídia antes de processar
    for (let i = 0; i < templateData.components.length; i++) {
      const comp = templateData.components[i];
      if (comp.type === 'HEADER' && comp.example?.header_handle && comp.example.header_handle.length > 0) {
        const mediaUrl = comp.example.header_handle[0];

        if (!mediaUrl.startsWith('https://')) {
          console.warn(`[CREATE TEMPLATE] ⚠️ URL da mídia não é HTTPS: ${mediaUrl}`);
          console.warn(`[CREATE TEMPLATE] A Meta pode rejeitar URLs HTTP. Configure BACKEND_URL com HTTPS em produção.`);
        }

        // Testar se a URL é acessível
        try {
          console.log(`[CREATE TEMPLATE] Testando acessibilidade da URL: ${mediaUrl}`);
          const testResponse = await axios.head(mediaUrl, { timeout: 5000 });
          console.log(`[CREATE TEMPLATE] ✅ URL acessível - Status: ${testResponse.status}, Content-Type: ${testResponse.headers['content-type']}`);
        } catch (error: any) {
          console.error(`[CREATE TEMPLATE] ❌ URL não acessível: ${error.message}`);
          throw new AppError(`A URL da mídia não está acessível: ${mediaUrl}. Verifique se o arquivo existe e está público.`, 400);
        }
      }
    }

    // Limpar dados antes de enviar
    const cleanedData: any = {
      name: templateName,
      category: templateData.category,
      language: templateData.language,
      components: templateData.components.map((comp: TemplateComponent, index: number) => {
        console.log(`[CREATE TEMPLATE] Processando componente ${index}:`, {
          type: comp.type,
          format: comp.format,
          hasText: !!comp.text,
          hasExample: !!comp.example,
          exampleKeys: comp.example ? Object.keys(comp.example) : []
        });

        const cleanedComp: any = {
          type: comp.type
        };

        // Adicionar format apenas para HEADER se necessário
        if (comp.format && comp.type === 'HEADER') {
          cleanedComp.format = comp.format;
          console.log(`[CREATE TEMPLATE] HEADER com formato: ${comp.format}`);
        }

        // Adicionar text apenas se existir
        if (comp.text) {
          cleanedComp.text = comp.text;
        }

        // ✅ CORREÇÃO: Adicionar example se existir e não estiver vazio
        if (comp.example && Object.keys(comp.example).length > 0) {
          // Para BODY: verificar se tem body_text COM CONTEÚDO
          if (comp.type === 'BODY' && comp.example.body_text) {
            // ✅ Só adicionar se body_text for array com elementos
            if (Array.isArray(comp.example.body_text) && comp.example.body_text.length > 0) {
              cleanedComp.example = comp.example;
              console.log(`[CREATE TEMPLATE] BODY com example.body_text:`, comp.example.body_text);
            } else {
              console.log(`[CREATE TEMPLATE] BODY sem variáveis - removendo example vazio`);
            }
          }
          // Para HEADER: verificar se tem header_handle (mídia)
          else if (comp.type === 'HEADER' && comp.example.header_handle) {
            // ✅ Garantir que header_handle é array
            if (Array.isArray(comp.example.header_handle) && comp.example.header_handle.length > 0) {
              const handleValue = comp.example.header_handle[0];

              // Verificar se é handle da Meta (formato: "4:xxxxx") ou URL
              const isMetaHandle = /^\d+:[a-zA-Z0-9+/=]+$/.test(handleValue);

              if (isMetaHandle) {
                console.log(`[CREATE TEMPLATE] ✅ HEADER com Meta Handle (CORRETO):`, handleValue);
              } else {
                console.log(`[CREATE TEMPLATE] ⚠️ HEADER com URL (pode não funcionar):`, handleValue);
                console.log(`[CREATE TEMPLATE] ⚠️ Recomendação: Use upload para Meta API para obter handle correto`);
              }

              cleanedComp.example = comp.example;
            } else if (typeof comp.example.header_handle === 'string') {
              // ✅ Se vier como string, converter para array
              const handleValue = comp.example.header_handle;
              const isMetaHandle = /^\d+:[a-zA-Z0-9+/=]+$/.test(handleValue);

              cleanedComp.example = {
                header_handle: [handleValue]
              };

              if (isMetaHandle) {
                console.log(`[CREATE TEMPLATE] ✅ HEADER com Meta Handle (convertido para array):`, handleValue);
              } else {
                console.log(`[CREATE TEMPLATE] ⚠️ HEADER com URL (convertido para array):`, handleValue);
              }
            } else {
              console.warn(`[CREATE TEMPLATE] ⚠️ HEADER com header_handle inválido:`, comp.example.header_handle);
            }
          }
          // ✅ Para outros casos, preservar example
          else if (!cleanedComp.example) {
            cleanedComp.example = comp.example;
            console.log(`[CREATE TEMPLATE] Example preservado para ${comp.type}:`, comp.example);
          }
        }

        // Adicionar buttons apenas se existir
        if (comp.buttons && comp.buttons.length > 0) {
          cleanedComp.buttons = comp.buttons;
        }

        console.log(`[CREATE TEMPLATE] Componente ${index} limpo:`, cleanedComp);
        return cleanedComp;
      })
    };

    // ========================================
    // 📋 LOGS DETALHADOS DO PAYLOAD PARA META
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('[CREATE TEMPLATE] 📤 PAYLOAD COMPLETO ENVIADO PARA META API');
    console.log('='.repeat(80));
    console.log('[CREATE TEMPLATE] 🌐 URL:', `${process.env.URL_API_OFICIAL}/v1/templates-whatsapp/${whatsapp.token}`);
    console.log('[CREATE TEMPLATE] 📋 Payload JSON:');
    console.log(JSON.stringify(cleanedData, null, 2));
    console.log('='.repeat(80) + '\n');

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

    // ========================================
    // 📥 LOGS DA RESPOSTA DA META
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('[CREATE TEMPLATE] 📥 RESPOSTA DA META API');
    console.log('='.repeat(80));
    console.log('[CREATE TEMPLATE] Status:', response.status);
    console.log('[CREATE TEMPLATE] Resposta JSON:');
    console.log(JSON.stringify(createdTemplate, null, 2));
    console.log('='.repeat(80) + '\n');

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
    // ========================================
    // ❌ LOGS DE ERRO DETALHADOS
    // ========================================
    console.error('\n' + '='.repeat(80));
    console.error('[CREATE TEMPLATE] ❌ ERRO AO CRIAR TEMPLATE');
    console.error('='.repeat(80));
    console.error('[CREATE TEMPLATE] Mensagem:', error.message);

    if (error.response) {
      console.error('[CREATE TEMPLATE] Status HTTP:', error.response.status);
      console.error('[CREATE TEMPLATE] Resposta da Meta:');
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error('[CREATE TEMPLATE] Headers da resposta:');
      console.error(JSON.stringify(error.response.headers, null, 2));
    }

    console.error('='.repeat(80) + '\n');

    // ✅ NOVO: Salvar template como rejeitado com motivo do erro
    try {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      const errorCode = error.response?.data?.error?.code || error.response?.status || 'UNKNOWN';
      const errorSubcode = error.response?.data?.error?.error_subcode;

      const rejectionReason = errorSubcode
        ? `[${errorCode}/${errorSubcode}] ${errorMessage}`
        : `[${errorCode}] ${errorMessage}`;

      console.log('[CREATE TEMPLATE] 💾 Salvando template rejeitado no banco...');

      // Buscar componente BODY para salvar mensagem
      const bodyComp = templateData.components.find(c => c.type === 'BODY');

      // Salvar template como rejeitado
      const quickMessage = await QuickMessage.create({
        shortcode: templateData.name,
        message: bodyComp?.text || '',
        companyId,
        userId: 1,
        geral: false,
        visao: false,
        isOficial: true,
        language: templateData.language,
        status: 'REJECTED',
        category: templateData.category,
        whatsappId,
        rejectionReason: rejectionReason
      });


      console.log(`[CREATE TEMPLATE] ✅ Template rejeitado salvo com ID: ${quickMessage.id}`);

      // Emitir evento via socket para atualizar UI
      const io = getIO();
      io.of(String(companyId))
        .emit(`company-${companyId}-quickmessage`, {
          action: "create",
          record: quickMessage
        });

      console.log('[CREATE TEMPLATE] ✅ Evento socket emitido para atualizar UI');
    } catch (saveError) {
      console.error('[CREATE TEMPLATE] ❌ Erro ao salvar template rejeitado:', saveError);
    }

    throw new AppError(
      `Erro ao criar template: ${error.response?.data?.error?.message || error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }

};

export default CreateTemplateService;
