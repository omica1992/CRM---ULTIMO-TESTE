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
import * as https from 'https';
import { lookup } from 'mime-types';
import { deleteFile } from 'src/@core/common/utils/files.utils';

export class MetaService {
  private readonly logger: Logger = new Logger(`${MetaService.name}`);
  urlMeta = `https://graph.facebook.com/v20.0`;

  path = `./public`;

  // ✅ BUG 1+6 FIX: Agent IPv4 compartilhado — força todas as requisições a usar IPv4
  // Evita ECONNRESET causado por IPv6 instável na comunicação com a Meta
  private readonly ipv4Agent = new https.Agent({
    family: 4,
    keepAlive: true,
    timeout: 30000, // 30s — evita bloqueio indefinido se Meta API travar
  });

  constructor() { }

  async send<T>(
    url: string,
    token: string,
    existFile: boolean = false,
  ): Promise<T | any> {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': existFile ? 'arraybuffer' : 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1',
      },
      responseType: existFile ? 'json' : 'json',
      httpsAgent: this.ipv4Agent,
      timeout: 30000,
    });

    return response.data as T;
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
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        httpsAgent: this.ipv4Agent,
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
      const { readFileSync, statSync } = require('fs');

      const formData = new FormData();
      const fileBuffer = readFileSync(pathFile);
      const fileSize = statSync(pathFile).size;

      const mimeType = lookup(pathFile);
      if (!mimeType) {
        throw new Error('Could not determine the MIME type of the file.');
      }

      const fileName = pathFile.split('/').pop() || pathFile.split('\\').pop() || 'file';

      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
        knownLength: fileSize
      });
      formData.append('messaging_product', 'whatsapp');

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
          httpsAgent: this.ipv4Agent,
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
      const response = await axios.post(
        `${this.urlMeta}/${numberId}/messages`,
        message,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          httpsAgent: this.ipv4Agent,
          timeout: 30000,
        }
      );

      return response.data as IReturnMessageMeta;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`sendMessage - ${errMsg}`);
      throw Error(errMsg);
    }
  }

  async getListTemplates(wabaId: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let allTemplates: IResultTemplates['data'] = [];
      const templatesUrl = `${this.urlMeta}/${wabaId}/message_templates`;
      const fields = 'name,components,language,status,category,id,parameter_format';
      let after: string | undefined;
      let limit = 100;
      let pageCount = 0;
      const seenCursors = new Set<string>();

      this.logger.log(`[GET TEMPLATES] Iniciando busca de templates para WABA ${wabaId}`);

      while (true) {
        const currentPage = pageCount + 1;
        let result;

        while (true) {
          try {
            this.logger.log(
              `[GET TEMPLATES] Buscando pagina ${currentPage} (limit=${limit}${after ? ', after=...' : ''})...`,
            );

            result = await axios.get(templatesUrl, {
              headers,
              httpsAgent: this.ipv4Agent,
              timeout: 30000,
              params: {
                limit,
                fields,
                ...(after ? { after } : {}),
              },
            });
            break;
          } catch (error: any) {
            const metaError = error.response?.data?.error;
            const status = error.response?.status || 'unknown';
            const message = metaError?.message || error.message;

            this.logger.error(
              `[GET TEMPLATES] Erro na pagina ${currentPage} (status=${status}, limit=${limit}): code=${metaError?.code || 'n/a'} type=${metaError?.type || 'n/a'} message=${message} fbtrace=${metaError?.fbtrace_id || 'n/a'}`,
            );

            if (status === 400 && limit > 25) {
              limit = limit > 50 ? 50 : 25;
              this.logger.warn(
                `[GET TEMPLATES] Tentando novamente a pagina ${currentPage} com limit=${limit}`,
              );
              continue;
            }

            if (status === 400 && allTemplates.length > 0) {
              this.logger.warn(
                `[GET TEMPLATES] Falha na pagina ${currentPage}; retornando ${allTemplates.length} templates ja carregados`,
              );
              return {
                data: allTemplates,
                paging: {},
              } as IResultTemplates;
            }

            throw error;
          }
        }

        pageCount = currentPage;

        const pageData = result.data as IResultTemplates;
        const pageTemplates = Array.isArray(pageData.data) ? pageData.data : [];

        if (pageTemplates.length > 0) {
          allTemplates = allTemplates.concat(pageTemplates);
          this.logger.log(`[GET TEMPLATES] Pagina ${pageCount}: ${pageTemplates.length} templates encontrados`);
        }

        const nextCursor = pageData.paging?.cursors?.after;
        if (!pageData.paging?.next || !nextCursor) {
          this.logger.log(`[GET TEMPLATES] Ultima pagina alcancada`);
          break;
        }

        if (seenCursors.has(nextCursor)) {
          this.logger.warn(`[GET TEMPLATES] Cursor repetido detectado; encerrando paginacao`);
          break;
        }

        seenCursors.add(nextCursor);
        after = nextCursor;
      }

      this.logger.log(`[GET TEMPLATES] Total de templates carregados: ${allTemplates.length} (${pageCount} paginas)`);

      return {
        data: allTemplates,
        paging: {},
      } as IResultTemplates;
    } catch (error: any) {
      const metaError = error.response?.data?.error;
      const message = metaError?.message || error.message;
      this.logger.error(`getListTemplates - ${message}`);
      throw Error('Erro ao buscar templates');
    }
  }

  async uploadMedia(phoneNumberId: string, token: string, fileUrl: string, mimeType: string) {
    try {
      this.logger.log(`[META] Fazendo upload de mídia: ${fileUrl}`);

      // Baixar o arquivo da URL
      const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer', httpsAgent: this.ipv4Agent });
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
          },
          httpsAgent: this.ipv4Agent,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
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

      const response = await axios.post(
        `${this.urlMeta}/${wabaId}/message_templates`,
        templateData,
        { headers, httpsAgent: this.ipv4Agent }
      );

      this.logger.log(`[META] Template criado com sucesso. ID: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.error_user_msg ||
        error.response?.data?.error?.message || error.message;
      this.logger.error(`createTemplate - ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async updateTemplate(templateId: string, token: string, updateData: IUpdateTemplateData) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      this.logger.log(`[META] Atualizando template: ${templateId}`);

      const response = await axios.post(
        `${this.urlMeta}/${templateId}`,
        updateData,
        { headers, httpsAgent: this.ipv4Agent }
      );

      this.logger.log(`[META] Template atualizado com sucesso`);
      return response.data;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`updateTemplate - ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async deleteTemplate(wabaId: string, templateName: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      this.logger.log(`[META] Deletando template: ${templateName}`);

      const response = await axios.delete(
        `${this.urlMeta}/${wabaId}/message_templates?name=${templateName}`,
        { headers, httpsAgent: this.ipv4Agent }
      );

      this.logger.log(`[META] Template deletado com sucesso`);
      return response.data;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`deleteTemplate - ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async getTemplateById(templateId: string, token: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await axios.get(`${this.urlMeta}/${templateId}`, {
        headers,
        httpsAgent: this.ipv4Agent,
      });

      return response.data;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`getTemplateById - ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async sendReadMessage(
    numberId: string,
    token: string,
    data: IBodyReadMessage,
  ) {
    try {
      // Usar agent IPv4 compartilhado para evitar ECONNRESET

      const response = await axios.post(
        `${this.urlMeta}/${numberId}/messages`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          httpsAgent: this.ipv4Agent,
        }
      );

      return response.data as IResultTemplates;
    } catch (error: any) {
      this.logger.error(`sendReadMessage - ${error.message}`);
      throw Error('Erro ao marcar a mensagem como lida');
    }
  }
}
