import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
  private context?: string;
  private logDir = path.join(process.cwd(), 'logs');
  private logFile = path.join(this.logDir, 'api-oficial.log');
  private errorLogFile = path.join(this.logDir, 'api-oficial-error.log');

  constructor() {
    // Criar diretório de logs se não existir
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: any, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    return `[${timestamp}] [${level}] [${ctx}] ${msg}\n`;
  }

  private writeToFile(filePath: string, message: string) {
    try {
      fs.appendFileSync(filePath, message, 'utf8');
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }

  log(message: any, context?: string) {
    const formattedMessage = this.formatMessage('LOG', message, context);
    console.log(formattedMessage.trim());
    this.writeToFile(this.logFile, formattedMessage);
  }

  error(message: any, trace?: string, context?: string) {
    const formattedMessage = this.formatMessage('ERROR', message, context);
    const traceMessage = trace ? `\nStack Trace: ${trace}\n` : '';
    const fullMessage = formattedMessage + traceMessage;
    
    console.error(fullMessage.trim());
    this.writeToFile(this.errorLogFile, fullMessage);
    this.writeToFile(this.logFile, fullMessage);
  }

  warn(message: any, context?: string) {
    const formattedMessage = this.formatMessage('WARN', message, context);
    console.warn(formattedMessage.trim());
    this.writeToFile(this.logFile, formattedMessage);
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message, context);
      console.debug(formattedMessage.trim());
      this.writeToFile(this.logFile, formattedMessage);
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('VERBOSE', message, context);
      console.log(formattedMessage.trim());
      this.writeToFile(this.logFile, formattedMessage);
    }
  }
}
