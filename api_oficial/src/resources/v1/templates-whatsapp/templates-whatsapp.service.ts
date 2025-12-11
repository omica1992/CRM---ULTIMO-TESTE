import { Injectable, Logger } from '@nestjs/common';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { AppError } from 'src/@core/infra/errors/app.error';

@Injectable()
export class TemplatesWhatsappService {
  logger = new Logger(`${TemplatesWhatsappService}`);

  constructor(
    private readonly whatsappOficial: WhatsappOficialService,
    private readonly metaService: MetaService,
  ) {}

  async findAll(token: string) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findUnique({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.getListTemplates(
        conexao.waba_id,
        conexao.send_token,
      );
    } catch (error: any) {
      this.logger.error(`findAll - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async create(token: string, templateData: any) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findUnique({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      // Validar dados do template
      this.validateTemplateData(templateData);

      // ✅ CORREÇÃO: Para templates, a Meta API exige URL pública acessível
      // O upload de mídia retorna ID que só funciona para mensagens diretas
      // Para templates, devemos manter a URL pública no header_handle
      for (let i = 0; i < templateData.components.length; i++) {
        const comp = templateData.components[i];
        
        if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format) && comp.example?.header_handle) {
          const mediaUrl = comp.example.header_handle[0];
          
          this.logger.log(`[CREATE TEMPLATE] Validando mídia: ${mediaUrl}`);
          
          // ✅ Meta API exige HTTPS para templates
          if (!mediaUrl.startsWith('https://')) {
            throw new Error('URL da mídia deve usar HTTPS (não HTTP). A Meta API não aceita URLs HTTP em templates.');
          }
          
          // Verificar se URL é acessível
          try {
            const axios = require('axios');
            const response = await axios.head(mediaUrl, { timeout: 5000 });
            
            if (response.status !== 200) {
              throw new Error(`URL da mídia retornou status ${response.status}`);
            }
            
            this.logger.log(`[CREATE TEMPLATE] ✅ Mídia validada e acessível: ${mediaUrl}`);
          } catch (error: any) {
            this.logger.error(`[CREATE TEMPLATE] Erro ao validar mídia: ${error.message}`);
            throw new Error(`URL da mídia não está acessível: ${error.message}`);
          }
          
          // ✅ Manter URL pública (não fazer upload)
          // A Meta API valida e baixa a mídia diretamente da URL fornecida
        }
      }

      const result = await this.metaService.createTemplate(
        conexao.waba_id,
        conexao.send_token,
        templateData,
      );

      // Template criado com sucesso na Meta

      return result;
    } catch (error: any) {
      this.logger.error(`create - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async findById(token: string, templateId: string) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findUnique({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.getTemplateById(
        templateId,
        conexao.send_token,
      );
    } catch (error: any) {
      this.logger.error(`findById - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async update(token: string, templateId: string, updateData: any) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findUnique({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.updateTemplate(
        templateId,
        conexao.send_token,
        updateData,
      );
    } catch (error: any) {
      this.logger.error(`update - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async delete(token: string, templateName: string) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findUnique({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      const result = await this.metaService.deleteTemplate(
        conexao.waba_id,
        templateName,
        conexao.send_token,
      );

      // Template deletado da Meta

      return result;
    } catch (error: any) {
      this.logger.error(`delete - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  private validateTemplateData(templateData: any) {
    this.logger.log(`[VALIDATE] Validando template: ${JSON.stringify(templateData, null, 2)}`);

    if (!templateData.name) {
      throw new Error('Nome do template é obrigatório');
    }

    // Validar formato do nome (apenas letras minúsculas, números e underscore)
    if (!/^[a-z0-9_]+$/.test(templateData.name)) {
      throw new Error('Nome do template deve conter apenas letras minúsculas, números e underscore');
    }

    if (!templateData.category) {
      throw new Error('Categoria do template é obrigatória');
    }

    if (!['AUTHENTICATION', 'MARKETING', 'UTILITY'].includes(templateData.category)) {
      throw new Error('Categoria deve ser AUTHENTICATION, MARKETING ou UTILITY');
    }

    if (!templateData.language) {
      throw new Error('Idioma do template é obrigatório');
    }

    if (!templateData.components || !Array.isArray(templateData.components)) {
      throw new Error('Componentes do template são obrigatórios');
    }

    if (templateData.components.length === 0) {
      throw new Error('Template deve ter pelo menos um componente');
    }

    // Validar que tem pelo menos um componente BODY
    const hasBody = templateData.components.some((comp: any) => comp.type === 'BODY');
    if (!hasBody) {
      throw new Error('Template deve ter pelo menos um componente BODY');
    }

    // Validar cada componente
    templateData.components.forEach((comp: any, index: number) => {
      if (!comp.type) {
        throw new Error(`Componente ${index} não tem tipo definido`);
      }

      if (!['HEADER', 'BODY', 'FOOTER', 'BUTTONS'].includes(comp.type)) {
        throw new Error(`Componente ${index} tem tipo inválido: ${comp.type}`);
      }

      // HEADER com formato de mídia precisa de example.header_handle
      // HEADER com formato TEXT precisa de text
      if (comp.type === 'HEADER') {
        if (!comp.format) {
          throw new Error(`Componente HEADER precisa ter formato (TEXT, IMAGE, VIDEO, DOCUMENT)`);
        }
        
        // Se for mídia (IMAGE, VIDEO, DOCUMENT), precisa de example.header_handle
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          if (!comp.example?.header_handle || !Array.isArray(comp.example.header_handle) || comp.example.header_handle.length === 0) {
            throw new Error(`Componente HEADER com formato ${comp.format} precisa ter mídia (example.header_handle)`);
          }
        }
        
        // Se for TEXT, precisa de text
        if (comp.format === 'TEXT' && !comp.text) {
          throw new Error(`Componente HEADER com formato TEXT precisa ter texto`);
        }
      }

      // BODY e FOOTER precisam de text
      if ((comp.type === 'BODY' || comp.type === 'FOOTER') && !comp.text) {
        throw new Error(`Componente ${comp.type} precisa ter texto`);
      }

      // BUTTONS precisa de array de botões
      if (comp.type === 'BUTTONS' && (!comp.buttons || !Array.isArray(comp.buttons))) {
        throw new Error(`Componente BUTTONS precisa ter array de botões`);
      }

      // Validar botões
      if (comp.buttons) {
        comp.buttons.forEach((btn: any, btnIndex: number) => {
          if (!btn.type) {
            throw new Error(`Botão ${btnIndex} não tem tipo`);
          }
          if (!btn.text) {
            throw new Error(`Botão ${btnIndex} não tem texto`);
          }
          if (btn.type === 'URL' && !btn.url) {
            throw new Error(`Botão URL ${btnIndex} não tem URL`);
          }
          if (btn.type === 'PHONE_NUMBER' && !btn.phone_number) {
            throw new Error(`Botão PHONE_NUMBER ${btnIndex} não tem número`);
          }
        });
      }
    });

    this.logger.log(`[VALIDATE] ✅ Template validado com sucesso`);
  }

}
