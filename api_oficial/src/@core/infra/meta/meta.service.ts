import { Logger } from '@nestjs/common';
import {
  IBodyReadMessage,
  IMetaMessage,
  IResultTemplates,
  IReturnAuthMeta,
  IReturnMessageFile,
  IReturnMessageMeta,
  ICreateTemplateData,
  IUpdateTemplateData,
} from './interfaces/IMeta.interfaces';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { convertMimeTypeToExtension } from 'src/@core/common/utils/convertMimeTypeToExtension';
import axios from 'axios';
import { lookup } from 'mime-types';
import { deleteFile } from 'src/@core/common/utils/files.utils';

export class MetaService {
  private readonly logger: Logger = new Logger(`${MetaService.name}`);
  urlMeta = `https://graph.facebook.com/v20.0`;

  path = `./public`;

  constructor() {}

  async send<T>(
    url: string,
    token: string,
    existFile: boolean = false,
  ): Promise<T | any> {
    const headers = {
      'Content-Type': !!existFile ? 'arraybuffer' : 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'curl/7.64.1',
    };

    const res = await fetch(url, {
      method: 'GET',
      headers: headers,
    });

    if (!!existFile) {
      // return await res.arrayBuffer();
      return await res.json();
    } else {
      return (await res.json()) as T;
    }
  }

  async authFileMeta(
    idMessage: string,
    phone_number_id: string,
    token: string,
  ): Promise<IReturnAuthMeta> {
    try {
      const url = `https://graph.facebook.com/v20.0/${idMessage}?phone_number_id=${phone_number_id}`;

      return await this.send<IReturnAuthMeta>(url, token);
    } catch (error: any) {
      this.logger.error(`authDownloadFile - ${error.message}`);
      throw Error('Erro ao converter o arquivo');
    }
  }

  async downloadFileMeta(
    idMessage: string,
    phone_number_id: string,
    token: string,
    companyId: number,
    conexao: number,
  ): Promise<{ base64: string; mimeType: string }> {
    try {
      const auth = await this.authFileMeta(idMessage, phone_number_id, token);

      if (!existsSync(this.path)) mkdirSync(this.path);
      if (!existsSync(`${this.path}/${companyId}`))
        mkdirSync(`${this.path}/${companyId}`);
      if (!existsSync(`${this.path}/${companyId}/${conexao}`))
        mkdirSync(`${this.path}/${companyId}/${conexao}`);

      const pathFile = `${this.path}/${companyId}/${conexao}`;

      const mimeType = convertMimeTypeToExtension(auth.mime_type);

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1',
      };

      const result = await axios.get(auth.url, {
        headers,
        responseType: 'arraybuffer',
      });

      if (result.status != 200)
        throw new Error('Falha em baixar o arquivo da meta');

      const base64 = result.data.toString('base64');

      writeFileSync(`${pathFile}/${idMessage}.${mimeType}`, result.data);

      return {
        base64,
        mimeType: auth.mime_type,
      };
    } catch (error: any) {
      console.log(error);
      this.logger.error(`authDownloadFile - ${error.message}`);
      throw Error('Erro ao converter o arquivo');
    }
  }

  async sendFileToMeta(
    numberId: string,
    token: string,
    pathFile: string,
  ): Promise<IReturnMessageFile | null> {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const formData = new FormData();

      const file = readFileSync(pathFile);

      const mimeType = lookup(pathFile);
      if (!mimeType) {
        throw new Error('Could not determine the MIME type of the file.');
      }

      const blob = new Blob([file], { type: mimeType });

      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mimeType);
      formData.append('file', blob);

      const result = await fetch(`${this.urlMeta}/${numberId}/media`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (result.status != 200)
        throw new Error('Falha em baixar o arquivo da meta');

      return (await result.json()) as IReturnMessageFile;
    } catch (error: any) {
      deleteFile(pathFile);
      this.logger.error(`sendMessage - ${error.message}`);
      throw Error('Erro ao enviar o arquivo para a meta');
    }
  }

  async sendMessage(numberId: string, token: string, message: IMetaMessage) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const result = await fetch(`${this.urlMeta}/${numberId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });

      if (result.status != 200) {
        const resultError = await result.json();
        throw new Error(
          resultError.error.message || 'Falha ao enviar mensagem para a meta',
        );
      }

      return (await result.json()) as IReturnMessageMeta;
    } catch (error: any) {
      this.logger.error(`sendMessage - ${error.message}`);
      throw Error('Erro ao enviar a mensagem');
    }
  }

  async getListTemplates(wabaId: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const result = await fetch(`${this.urlMeta}/${wabaId}/message_templates`,
        {
          method: 'GET',
          headers,
        },
      );

      if (result.status != 200) {
        const resultError = await result.json();
        throw new Error(
          resultError.error.message || 'Falha ao buscar templates',
        );
      }

      return (await result.json()) as IResultTemplates;
    } catch (error: any) {
      this.logger.error(`getListTemplates - ${error.message}`);
      throw Error('Erro ao buscar templates');
    }
  }

  async createTemplate(wabaId: string, token: string, templateData: ICreateTemplateData) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      this.logger.log(`[META] Criando template: ${templateData.name}`);
      this.logger.log(`[META] WABA ID: ${wabaId}`);
      this.logger.log(`[META] Payload completo: ${JSON.stringify(templateData, null, 2)}`);

      const result = await fetch(`${this.urlMeta}/${wabaId}/message_templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(templateData),
      });

      if (result.status !== 200) {
        const resultError = await result.json();
        this.logger.error(`[META] Status HTTP: ${result.status}`);
        this.logger.error(`[META] Erro completo da Meta: ${JSON.stringify(resultError, null, 2)}`);
        this.logger.error(`[META] Payload enviado: ${JSON.stringify(templateData, null, 2)}`);
        
        // ✅ Priorizar mensagem amigável da Meta (error_user_msg)
        const errorMessage = resultError.error?.error_user_msg || 
                            resultError.error?.error_user_title ||
                            resultError.error?.message || 
                            resultError.error?.error_data?.details || 
                            'Falha ao criar template';
        
        this.logger.error(`[META] Mensagem de erro extraída: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const response = await result.json();
      this.logger.log(`[META] Template criado com sucesso. ID: ${response.id}`);
      return response;
    } catch (error: any) {
      this.logger.error(`createTemplate - ${error.message}`);
      // ✅ Propagar mensagem original sem adicionar prefixo
      throw error;
    }
  }

  async updateTemplate(templateId: string, token: string, updateData: IUpdateTemplateData) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      this.logger.log(`[META] Atualizando template: ${templateId}`);

      const result = await fetch(`${this.urlMeta}/${templateId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(updateData),
      });

      if (result.status !== 200) {
        const resultError = await result.json();
        this.logger.error(`[META] Erro ao atualizar template: ${JSON.stringify(resultError, null, 2)}`);
        
        const errorMessage = resultError.error?.error_user_msg || 
                            resultError.error?.error_user_title ||
                            resultError.error?.message || 
                            'Falha ao atualizar template';
        
        throw new Error(errorMessage);
      }

      const response = await result.json();
      this.logger.log(`[META] Template atualizado com sucesso`);
      return response;
    } catch (error: any) {
      this.logger.error(`updateTemplate - ${error.message}`);
      throw error;
    }
  }

  async deleteTemplate(wabaId: string, templateName: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      this.logger.log(`[META] Deletando template: ${templateName}`);

      const result = await fetch(
        `${this.urlMeta}/${wabaId}/message_templates?name=${templateName}`, 
        {
          method: 'DELETE',
          headers,
        }
      );

      if (result.status !== 200) {
        const resultError = await result.json();
        this.logger.error(`[META] Erro ao deletar template: ${JSON.stringify(resultError, null, 2)}`);
        
        const errorMessage = resultError.error?.error_user_msg || 
                            resultError.error?.error_user_title ||
                            resultError.error?.message || 
                            'Falha ao deletar template';
        
        throw new Error(errorMessage);
      }

      const response = await result.json();
      this.logger.log(`[META] Template deletado com sucesso`);
      return response;
    } catch (error: any) {
      this.logger.error(`deleteTemplate - ${error.message}`);
      throw error;
    }
  }

  async getTemplateById(templateId: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const result = await fetch(`${this.urlMeta}/${templateId}`, {
        method: 'GET',
        headers,
      });

      if (result.status !== 200) {
        const resultError = await result.json();
        
        const errorMessage = resultError.error?.error_user_msg || 
                            resultError.error?.error_user_title ||
                            resultError.error?.message || 
                            'Falha ao buscar template';
        
        throw new Error(errorMessage);
      }

      return await result.json();
    } catch (error: any) {
      this.logger.error(`getTemplateById - ${error.message}`);
      throw error;
    }
  }

  async sendReadMessage(
    numberId: string,
    token: string,
    data: IBodyReadMessage,
  ) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      console.log(data);

      const result = await fetch(`${this.urlMeta}/${numberId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (result.status != 200) {
        const resultError = await result.json();
        throw new Error(
          resultError.error.message || 'Falha ao enviar mensagem para a meta',
        );
      }

      return (await result.json()) as IResultTemplates;
    } catch (error: any) {
      this.logger.error(`sendReadMessage - ${error.message}`);
      throw Error('Erro ao marcar a mensagem como lida');
    }
  }
}
