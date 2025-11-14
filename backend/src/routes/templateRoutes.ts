import express from "express";
import isAuth from "../middleware/isAuth";

import * as TemplateController from "../controllers/TemplateController";

const templateRoutes = express.Router();

templateRoutes.get("/templates", isAuth, TemplateController.index);
templateRoutes.post("/templates/:whatsappId", isAuth, TemplateController.store);
templateRoutes.get("/templates/:whatsappId/:templateId", isAuth, TemplateController.show);
templateRoutes.put("/templates/:whatsappId/:templateId", isAuth, TemplateController.update);
templateRoutes.delete("/templates/:whatsappId/:templateName", isAuth, TemplateController.remove);

export default templateRoutes;
