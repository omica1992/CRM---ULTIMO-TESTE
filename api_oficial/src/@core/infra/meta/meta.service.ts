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

  constructor() { }

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
      this.logger.log(`[META DOWNLOAD] 📥 Iniciando download - ID: ${idMessage}, Phone: ${phone_number_id}`);

      const auth = await this.authFileMeta(idMessage, phone_number_id, token);

      this.logger.log(`[META DOWNLOAD] ✅ Auth obtido - URL: ${auth.url}, MimeType: ${auth.mime_type}, Size: ${auth.file_size || 'N/A'} bytes`);

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

      this.logger.log(`[META DOWNLOAD] 🌐 Baixando arquivo de ${auth.url}...`);

      const result = await axios.get(auth.url, {
        headers,
        responseType: 'arraybuffer',
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
        maxBodyLength: 100 * 1024 * 1024,
      });

      this.logger.log(`[META DOWNLOAD] ✅ Download concluído - Status: ${result.status}, Size: ${result.data.length} bytes`);

      if (result.status != 200) {
        this.logger.error(`[META DOWNLOAD] ❌ Status HTTP inválido: ${result.status}`);
        throw new Error('Falha em baixar o arquivo da meta');
      }

      const base64 = result.data.toString('base64');

      this.logger.log(`[META DOWNLOAD] 💾 Salvando arquivo em ${pathFile}/${idMessage}.${mimeType}`);

      writeFileSync(`${pathFile}/${idMessage}.${mimeType}`, result.data);

      this.logger.log(`[META DOWNLOAD] ✅ Arquivo salvo com sucesso - Base64 length: ${base64.length}`);

      return {
        base64,
        mimeType: auth.mime_type,
      };
    } catch (error: any) {
      this.logger.error(`[META DOWNLOAD] ❌ ERRO CRÍTICO ao baixar arquivo ${idMessage}`);
      this.logger.error(`[META DOWNLOAD] Erro: ${error.message}`);
      if (error.response) {
        this.logger.error(`[META DOWNLOAD] Response Status: ${error.response.status}`);
        this.logger.error(`[META DOWNLOAD] Response Data: ${JSON.stringify(error.response.data).substring(0, 500)}`);
      }
      if (error.stack) {
        this.logger.error(`[META DOWNLOAD] Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
      throw Error(`Erro ao baixar arquivo: ${error.message}`);
    }
  }

  async sendFileToMeta(
    numberId: string,
    token: string,
    pathFile: string,
  ): Promise<IReturnMessageFile | null> {
    try {
      const FormData = require('form-data');
      const https = require('https');
      const { readFileSync } = require('fs');

      const formData = new FormData();
      const fileBuffer = readFileSync(pathFile);

      const mimeType = lookup(pathFile);
      if (!mimeType) {
        throw new Error('Could not determine the MIME type of the file.');
      }

      const fileName = pathFile.split('/').pop() || pathFile.split('\\').pop() || 'file';

      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });
      formData.append('messaging_product', 'whatsapp');

      const agent = new https.Agent({
        keepAlive: true,
        rejectUnauthorized: false
      });

      const formHeaders = formData.getHeaders();
      try {
        formHeaders['Content-Length'] = formData.getLengthSync();
      } catch (err: any) {
        this.logger.warn(`[MEDIA UPLOAD WARN] Could not calculate Content-Length: ${err.message}`);
      }

      const response = await axios.post(
        `${this.urlMeta}/${numberId}/media`,
        formData,
        {
          headers: {
            ...formHeaders,
            'Authorization': `Bearer ${token}`
          },
          httpsAgent: agent,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.status != 200)
        throw new Error('Falha em enviar o arquivo para a meta');

      return response.data as IReturnMessageFile;
    } catch (error: any) {
      deleteFile(pathFile);
      this.logger.error(`[MEDIA UPLOAD ERROR] sendFileToMeta - ${error.message}`);
      if (error.response) {
        this.logger.error(`[MEDIA UPLOAD ERROR] Response Data: ${JSON.stringify(error.response.data)}`);
      }
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

      let allTemplates = [];
      let nextUrl = `${this.urlMeta}/${wabaId}/message_templates?limit=100`;
      let pageCount = 0;

      this.logger.log(`[GET TEMPLATES] Iniciando busca de templates para WABA ${wabaId}`);

      // Loop para buscar todas as páginas
      while (nextUrl) {
        pageCount++;
        this.logger.log(`[GET TEMPLATES] 📄 Buscando página ${pageCount}...`);

        const result = await fetch(nextUrl, {
          method: 'GET',
          headers,
        });

        if (result.status != 200) {
          const resultError = await result.json();
          throw new Error(
            resultError.error.message || 'Falha ao buscar templates',
          );
        }

        const pageData = (await result.json()) as IResultTemplates;

        // Adicionar templates da página atual
        if (pageData.data && pageData.data.length > 0) {
          allTemplates = allTemplates.concat(pageData.data);
          this.logger.log(`[GET TEMPLATES] ✅ Página ${pageCount}: ${pageData.data.length} templates encontrados`);
        }

        // Verificar se há próxima página
        if (pageData.paging?.next) {
          nextUrl = pageData.paging.next;
          this.logger.log(`[GET TEMPLATES] 🔄 Próxima página disponível`);
        } else {
          nextUrl = null;
          this.logger.log(`[GET TEMPLATES] ✅ Última página alcançada`);
        }
      }

      this.logger.log(`[GET TEMPLATES] 🎉 Total de templates carregados: ${allTemplates.length} (${pageCount} páginas)`);

      // Retornar no formato esperado
      return {
        data: allTemplates,
        paging: {} // Paging vazio pois já buscamos tudo
      } as IResultTemplates;
    } catch (error: any) {
      this.logger.error(`getListTemplates - ${error.message}`);
      throw Error('Erro ao buscar templates');
    }
  }

  async uploadMedia(phoneNumberId: string, token: string, fileUrl: string, mimeType: string) {
    try {
      this.logger.log(`[META] Fazendo upload de mídia: ${fileUrl}`);

      // Baixar o arquivo da URL
      const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(fileResponse.data);

      // Criar FormData
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileUrl.split('/').pop(),
        contentType: mimeType
      });
      formData.append('messaging_product', 'whatsapp');

      // Upload para a Meta
      const response = await axios.post(
        `${this.urlMeta}/${phoneNumberId}/media`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        }
      );

      this.logger.log(`[META] ✅ Mídia enviada com sucesso. ID: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      this.logger.error(`[META] Erro ao fazer upload de mídia: ${error.message}`);
      throw error;
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
