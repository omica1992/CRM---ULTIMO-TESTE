import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";

import * as TemplateController from "../controllers/TemplateController";

const templateRoutes = express.Router();

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

templateRoutes.get("/templates", isAuth, TemplateController.index);
templateRoutes.post("/templates/:whatsappId", isAuth, TemplateController.store);
templateRoutes.get("/templates/:whatsappId/:templateId", isAuth, TemplateController.show);
templateRoutes.put("/templates/:whatsappId/:templateId", isAuth, TemplateController.update);
templateRoutes.delete("/templates/:whatsappId/:templateName", isAuth, TemplateController.remove);

// Rota para upload de mídia (imagens, vídeos, documentos)
templateRoutes.post("/templates/upload-media", isAuth, upload.single("file"), TemplateController.uploadMedia);

export default templateRoutes;
