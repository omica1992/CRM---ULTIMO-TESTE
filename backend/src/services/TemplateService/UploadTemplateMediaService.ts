import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import AppError from "../../errors/AppError";

interface Request {
  file: Express.Multer.File;
  companyId: number;
}

interface Response {
  publicUrl: string;
  filename: string;
  path: string;
}

const UploadTemplateMediaService = async ({
  file,
  companyId
}: Request): Promise<Response> => {
  try {
    console.log(`[UPLOAD SERVICE] Iniciando upload - File: ${file.originalname}, Type: ${file.mimetype}, Size: ${file.size}`);
    
    // Validar tipo de arquivo
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(`[UPLOAD SERVICE] ❌ Tipo de arquivo não suportado: ${file.mimetype}`);
      throw new AppError(
        "Tipo de arquivo não suportado. Use: JPEG, PNG, GIF, WEBP, MP4 ou PDF",
        400
      );
    }
    
    console.log(`[UPLOAD SERVICE] ✅ Tipo de arquivo válido`);


    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new AppError("Arquivo muito grande. Tamanho máximo: 5MB", 400);
    }

    // Criar diretório se não existir
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      "template-media",
      String(companyId)
    );

    if (!fsSync.existsSync(uploadDir)) {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = path.extname(file.originalname);
    const filename = `template_${timestamp}_${randomString}${extension}`;
    const filePath = path.join(uploadDir, filename);

    // Salvar arquivo
    await fs.writeFile(filePath, file.buffer as any);

    // ✅ CORREÇÃO: Gerar URL pública com HTTPS (Meta API exige)
    let baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    
    // Se for localhost, alertar que precisa usar HTTPS em produção
    if (baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1')) {
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ ATENÇÃO: URL localhost detectada. Templates com mídia NÃO funcionarão!`);
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ Configure BACKEND_URL com domínio HTTPS no .env`);
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ Exemplo: BACKEND_URL=https://seu-dominio.com`);
    }
    
    // Garantir que URL usa HTTPS (exceto localhost para desenvolvimento)
    if (!baseUrl.startsWith('http://localhost') && !baseUrl.startsWith('http://127.0.0.1')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    
    const publicUrl = `${baseUrl}/public/template-media/${companyId}/${filename}`;

    console.log(`[UPLOAD TEMPLATE MEDIA] Arquivo salvo: ${filename}`);
    console.log(`[UPLOAD TEMPLATE MEDIA] URL pública: ${publicUrl}`);

    return {
      publicUrl,
      filename,
      path: filePath
    };
  } catch (error: any) {
    console.error("[UPLOAD TEMPLATE MEDIA] Erro:", error);
    throw new AppError(
      `Erro ao fazer upload: ${error.message}`,
      error.statusCode || 500
    );
  }
};

export default UploadTemplateMediaService;
