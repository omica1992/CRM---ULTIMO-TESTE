import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey,
  Default,
  BelongsToMany
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import Whatsapp from "./Whatsapp";
import Queue from "./Queue";
import ScheduleUser from "./ScheduleUser";
import QuickMessage from "./QuickMessage";

@Table({
  hooks: {
    beforeCreate: (instance: any) => {
      // Log antes de criar
      if (instance.isTemplate) {
        console.log(`💻 [MODEL-HOOK] Criando agendamento com template:`);
        console.log(` - templateMetaId: "${instance.templateMetaId || ''}"`);
        console.log(` - templateName: "${instance.templateName || ''}"`);
      }
    },
    beforeUpdate: (instance: any) => {
      // Log antes de atualizar
      if (instance.isTemplate) {
        console.log(`💻 [MODEL-HOOK] Atualizando agendamento com template:`);
        console.log(` - templateMetaId: "${instance.templateMetaId || ''}"`);
        console.log(` - templateName: "${instance.templateName || ''}"`);
      }
    }
  }
})
class Schedule extends Model<Schedule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  body: string;

  @Column
  sendAt: Date;

  @Column
  sentAt: Date;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column(DataType.STRING)
  status: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @Column
  ticketUserId: number;

  @BelongsTo(() => User, "ticketUserId")
  ticketUser: User;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Column({ defaultValue: "closed" })
  statusTicket: string;

  @Column({ defaultValue: "disabled" })
  openTicket: string;

  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  intervalo: number;

  @Column
  valorIntervalo: number;

  @Column
  enviarQuantasVezes: number;

  @Column
  tipoDias: number;

  @Column
  contadorEnvio: number;

  @Default(false)
  @Column
  assinar: boolean;

  // ✅ Campos para lembrete
  @Column
  reminderDate: Date;

  @Column(DataType.TEXT)
  reminderMessage: string;

  @Column
  reminderSentAt: Date;

  @Column
  reminderStatus: string;

  // ✅ Campos para templates da API Oficial
  @ForeignKey(() => QuickMessage)
  @Column
  templateMetaId: string; // ID do template (QuickMessage) - ✅ CORREÇÃO: String para aceitar IDs grandes da Meta

  @Column
  templateName: string; // ✅ Nome do template (shortcode) como usado na API da Meta

  @Column
  templateLanguage: string;

  @Column(DataType.JSON)
  templateComponents: any;

  @Default(false)
  @Column
  isTemplate: boolean;

  // ✅ CORREÇÃO: Associação com QuickMessage usando configuração personalizada
  @BelongsTo(() => QuickMessage, {
    foreignKey: "templateMetaId",
    targetKey: "id",
    constraints: false // Desabilitar constraints para evitar erros de tipo
    // Removido scope de isTemplate - essa coluna não existe na tabela QuickMessages
  })
  template: QuickMessage;

  // Relacionamento many-to-many com usuários
  @BelongsToMany(() => User, () => ScheduleUser)
  users: User[];
}

export default Schedule;
