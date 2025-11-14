import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TemplatesWhatsappService } from './templates-whatsapp.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('v1/templates-whatsapp')
@ApiBearerAuth()
@ApiTags('Templates WhatsApp')
export class TemplatesWhatsappController {
  constructor(private readonly service: TemplatesWhatsappService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Retorna registros do templates' })
  @ApiResponse({
    status: 400,
    description: 'Erro ao encontrar os templates com o Whatsapp Oficial',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna os registros de templates do Whatsapp Oficial',
  })
  findAll(@Param('token') token: string) {
    return this.service.findAll(token);
  }

  @Post(':token')
  @ApiOperation({ summary: 'Cria um novo template' })
  @ApiResponse({
    status: 201,
    description: 'Template criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar template',
  })
  create(@Param('token') token: string, @Body() templateData: any) {
    return this.service.create(token, templateData);
  }

  @Get(':token/:templateId')
  @ApiOperation({ summary: 'Busca um template por ID' })
  @ApiResponse({
    status: 200,
    description: 'Template encontrado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Template não encontrado',
  })
  findById(@Param('token') token: string, @Param('templateId') templateId: string) {
    return this.service.findById(token, templateId);
  }

  @Patch(':token/:templateId')
  @ApiOperation({ summary: 'Atualiza um template existente' })
  @ApiResponse({
    status: 200,
    description: 'Template atualizado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao atualizar template',
  })
  update(
    @Param('token') token: string,
    @Param('templateId') templateId: string,
    @Body() updateData: any,
  ) {
    return this.service.update(token, templateId, updateData);
  }

  @Delete(':token/:templateName')
  @ApiOperation({ summary: 'Deleta um template' })
  @ApiResponse({
    status: 200,
    description: 'Template deletado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao deletar template',
  })
  delete(@Param('token') token: string, @Param('templateName') templateName: string) {
    return this.service.delete(token, templateName);
  }
}
