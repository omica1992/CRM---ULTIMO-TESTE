import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import ListTemplatesService from "../services/TemplateService/ListTemplatesService";
import CreateTemplateService from "../services/TemplateService/CreateTemplateService";
import ShowTemplateService from "../services/TemplateService/ShowTemplateService";
import UpdateTemplateService from "../services/TemplateService/UpdateTemplateService";
import DeleteTemplateService from "../services/TemplateService/DeleteTemplateService";

interface TemplateData {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: any;
    buttons?: any[];
  }>;
  parameter_format?: 'named' | 'positional';
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId } = req.query;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para acessar templates", 403);
  }

  if (!whatsappId) {
    throw new AppError("WhatsApp ID é obrigatório");
  }

  const templates = await ListTemplatesService({
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json(templates);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const data = req.body as TemplateData;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para criar templates", 403);
  }
  const { whatsappId } = req.params;

  const schema = Yup.object().shape({
    name: Yup.string().required("Nome do template é obrigatório"),
    category: Yup.string()
      .oneOf(['AUTHENTICATION', 'MARKETING', 'UTILITY'])
      .required("Categoria é obrigatória"),
    language: Yup.string().required("Idioma é obrigatório"),
    components: Yup.array()
      .min(1, "Pelo menos um componente é obrigatório")
      .required("Componentes são obrigatórios")
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Validar que tem pelo menos um componente BODY
  const hasBody = data.components.some(comp => comp.type === 'BODY');
  if (!hasBody) {
    throw new AppError("Template deve ter pelo menos um componente BODY");
  }

  const template = await CreateTemplateService({
    ...data,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.status(201).json(template);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId, templateId } = req.params;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para visualizar templates", 403);
  }

  const template = await ShowTemplateService({
    templateId,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json(template);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const data = req.body;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para editar templates", 403);
  }
  const { whatsappId, templateId } = req.params;

  const schema = Yup.object().shape({
    category: Yup.string()
      .oneOf(['AUTHENTICATION', 'MARKETING', 'UTILITY'])
      .optional(),
    components: Yup.array().optional()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const template = await UpdateTemplateService({
    templateId,
    updateData: data,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json(template);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId, templateName } = req.params;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para deletar templates", 403);
  }

  await DeleteTemplateService({
    templateName,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json({ message: "Template removido com sucesso" });
};
