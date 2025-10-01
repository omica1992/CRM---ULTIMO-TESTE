import fs from 'fs';
import path from 'path';
import moment from 'moment';

class CampaignLogger {
  private logDir: string;
  private campaignLogFile: string;
  private errorLogFile: string;

  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.campaignLogFile = path.join(this.logDir, 'campaigns-api-oficial.log');
    this.errorLogFile = path.join(this.logDir, 'campaigns-errors.log');

    // Criar diretório se não existir
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLog(level: string, message: string, data?: any): string {
    const timestamp = moment().format('DD-MM-YYYY HH:mm:ss');
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
    }
    
    return logMessage + '\n';
  }

  private writeToFile(filePath: string, message: string) {
    try {
      fs.appendFileSync(filePath, message, 'utf8');
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  // Log de informação geral
  info(message: string, data?: any) {
    const logMessage = this.formatLog('INFO', message, data);
    console.log(logMessage);
    this.writeToFile(this.campaignLogFile, logMessage);
  }

  // Log de sucesso
  success(message: string, data?: any) {
    const logMessage = this.formatLog('SUCCESS', message, data);
    console.log(logMessage);
    this.writeToFile(this.campaignLogFile, logMessage);
  }

  // Log de erro
  error(message: string, error?: any, data?: any) {
    const errorData = {
      ...data,
      error: error?.message || error,
      stack: error?.stack
    };
    const logMessage = this.formatLog('ERROR', message, errorData);
    console.error(logMessage);
    this.writeToFile(this.errorLogFile, logMessage);
    this.writeToFile(this.campaignLogFile, logMessage);
  }

  // Log de aviso
  warn(message: string, data?: any) {
    const logMessage = this.formatLog('WARN', message, data);
    console.warn(logMessage);
    this.writeToFile(this.campaignLogFile, logMessage);
  }

  // Log de envio de template
  templateSent(campaignId: number, contactNumber: string, templateId: number, result: any) {
    this.success(`Template enviado - Campanha ${campaignId}`, {
      campaignId,
      contactNumber,
      templateId,
      messageId: result?.id || 'N/A',
      timestamp: moment().toISOString()
    });
  }

  // Log de falha no envio
  templateFailed(campaignId: number, contactNumber: string, error: any) {
    this.error(`Falha ao enviar template - Campanha ${campaignId}`, error, {
      campaignId,
      contactNumber,
      errorMessage: error?.message || error,
      timestamp: moment().toISOString()
    });
  }

  // Log de request para API Oficial
  apiRequest(method: string, url: string, data?: any) {
    this.info(`API Request: ${method} ${url}`, {
      method,
      url,
      requestData: data
    });
  }

  // Log de response da API Oficial
  apiResponse(method: string, url: string, status: number, data?: any) {
    if (status >= 200 && status < 300) {
      this.success(`API Response: ${method} ${url} - Status ${status}`, {
        method,
        url,
        status,
        responseData: data
      });
    } else {
      this.error(`API Response Error: ${method} ${url} - Status ${status}`, null, {
        method,
        url,
        status,
        responseData: data
      });
    }
  }
}

export default new CampaignLogger();
