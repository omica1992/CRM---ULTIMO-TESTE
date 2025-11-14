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
    if (!templateData.name) {
      throw new Error('Nome do template é obrigatório');
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

    // Validar que tem pelo menos um componente BODY
    const hasBody = templateData.components.some((comp: any) => comp.type === 'BODY');
    if (!hasBody) {
      throw new Error('Template deve ter pelo menos um componente BODY');
    }
  }

}
