import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "../../utils/logger";

interface DownloadResult {
    fileName: string;
    mimeType: string;
}

/**
 * Baixa arquivo de mídia da API Meta usando media_id
 * @param mediaId - ID do arquivo na API Meta
 * @param token - Token de autenticação da API Meta
 * @param companyId - ID da empresa para salvar arquivo
 * @returns Informações do arquivo baixado ou null em caso de erro
 */
export async function downloadMetaMedia(
    mediaId: string,
    token: string,
    companyId: number
): Promise<DownloadResult | null> {
    try {
        logger.info(`[META-DOWNLOAD] 📥 Iniciando download de mídia: ${mediaId}`);

        // Passo 1: Obter URL temporária do arquivo
        const mediaInfoResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${mediaId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const { url, mime_type, file_size } = mediaInfoResponse.data;
        logger.info(`[META-DOWNLOAD] URL obtida - Type: ${mime_type}, Size: ${file_size} bytes`);

        // Passo 2: Baixar arquivo da URL temporária
        const fileResponse = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            responseType: 'arraybuffer',
            timeout: 60000 // 60 segundos para arquivos grandes
        });

        logger.info(`[META-DOWNLOAD] Arquivo baixado - ${fileResponse.data.byteLength} bytes`);

        // Passo 3: Determinar extensão do arquivo
        const mimeToExt: { [key: string]: string } = {
            // Imagens
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',

            // Documentos
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'text/plain': 'txt',
            'text/csv': 'csv',

            // Vídeos
            'video/mp4': 'mp4',
            'video/3gpp': '3gp',
            'video/quicktime': 'mov',
            'video/x-msvideo': 'avi',

            // Áudios
            'audio/ogg': 'ogg',
            'audio/mpeg': 'mp3',
            'audio/mp4': 'm4a',
            'audio/aac': 'aac',
            'audio/amr': 'amr',

            // Outros
            'application/zip': 'zip',
            'application/x-rar-compressed': 'rar'
        };

        const ext = mimeToExt[mime_type] || 'bin';
        const fileName = `${mediaId}.${ext}`;

        // Passo 4: Criar pasta se não existir
        const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            fs.chmodSync(folder, 0o777);
            logger.info(`[META-DOWNLOAD] Pasta criada: ${folder}`);
        }

        // Passo 5: Salvar arquivo
        const filePath = path.join(folder, fileName);
        fs.writeFileSync(filePath, Buffer.from(fileResponse.data));

        logger.info(`[META-DOWNLOAD] ✅ Arquivo salvo: ${fileName} (${file_size} bytes)`);

        return {
            fileName,
            mimeType: mime_type
        };

    } catch (error: any) {
        logger.error(`[META-DOWNLOAD] ❌ Erro ao baixar mídia ${mediaId}:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        // Log adicional para debug
        if (error.response?.status === 401) {
            logger.error(`[META-DOWNLOAD] Token inválido ou expirado`);
        } else if (error.response?.status === 404) {
            logger.error(`[META-DOWNLOAD] Mídia não encontrada (pode ter expirado)`);
        }

        return null;
    }
}
