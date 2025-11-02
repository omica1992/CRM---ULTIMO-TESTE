import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../@core/guard/auth.decorator';
import { IWebhookWhatsApp } from './interfaces/IWebhookWhatsApp.inteface';

@Controller('v1/webhook')
@ApiTags('Webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Public()
  @Post(':companyId/:conexaoId')
  @ApiOperation({ summary: 'Webhook para evento de empresa e conexão' })
  @ApiResponse({
    status: 400,
    description: 'Retorna o erro para quem esta chamando',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna somente um true caso tenha sucesso',
  })
  async webhookCompanyConexao(
    @Param('companyId') companyId: number,
    @Param('conexaoId') conexaoId: number,
    @Body() data: IWebhookWhatsApp,
  ) {
    return await this.webhookService.webhookCompanyConexao(
      companyId,
      conexaoId,
      data,
    );
  }

  @Public()
  @Get(':companyId/:conexaoId')
  @ApiOperation({ summary: 'Webhook para evento de empresa' })
  @ApiResponse({
    status: 400,
    description: 'Retorna o erro para quem esta chamando',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna somente um true caso tenha sucesso',
  })
  async webhookCompany(
    @Param('companyId') companyId: number,
    @Param('conexaoId') conexaoId: number,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verify_token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return await this.webhookService.webhookCompany(
      companyId,
      conexaoId,
      mode,
      verify_token,
      challenge,
    );
  }

  @Post('/test/:companyId/:conexaoId')
  @Public()
  @ApiOperation({ summary: 'Simular webhook para testes em desenvolvimento' })
  @ApiResponse({ status: 200, description: 'Webhook simulado processado' })
  async testWebhook(
    @Param('companyId') companyId: string,
    @Param('conexaoId') conexaoId: string,
    @Body() customMessage?: any,
  ) {
    // Se customMessage já tem a estrutura completa, usa ela; senão cria uma padrão
    const hasValidStructure = customMessage?.object === 'whatsapp_business_account' && customMessage?.entry;
    
    const fakeWebhookData = hasValidStructure ? customMessage : {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5511999999999',
                  phone_number_id: conexaoId,
                },
                contacts: [
                  {
                    profile: {
                      name: 'Teste Usuário',
                    },
                    wa_id: '5511987654321',
                  },
                ],
                messages: [
                  {
                    from: '5511987654321',
                    id: `test_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'oi' }, // Mensagem que ativa o fluxo
                    type: 'text',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    console.log(`[WEBHOOK TEST] Simulando webhook para company ${companyId}, conexão ${conexaoId}`);
    console.log(`[WEBHOOK TEST] Estrutura do webhook:`, JSON.stringify(fakeWebhookData, null, 2));
    
    return this.webhookService.webhookCompanyConexao(
      +companyId,
      +conexaoId,
      fakeWebhookData,
    );
  }
}
