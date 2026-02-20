export interface IReceivedWhatsppOficial {
  token: string;
  fromNumber: string;
  nameContact: string;
  companyId: number;
  message: IMessageReceived;
}

export interface IReceivedWhatsppOficialRead {
  messageId: string;
  companyId: number;
  token: string;
}

export interface IMessageReceived {
  type:
  | 'text'
  | 'image'
  | 'audio'
  | 'document'
  | 'video'
  | 'location'
  | 'contacts'
  | 'order'
  | 'interactive'
  | 'referral'
  | 'sticker'
  | 'system'
  | 'button'
  | 'reaction'
  | 'unsupported';
  timestamp: number;
  idMessage: string;
  text?: string;
  file?: string;
  mimeType?: string;
  idFile?: string;
  quoteMessageId?: string;
}

export interface ITemplateStatusUpdate {
  companyId: number;
  templateId: string;
  previousCategory?: string;
  newCategory?: string;
  status: string;
  reason?: string;
  token: string;
}
