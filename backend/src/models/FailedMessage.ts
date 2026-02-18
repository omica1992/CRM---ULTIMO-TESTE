import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    Default,
    BelongsTo,
    ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";

@Table({ tableName: "FailedMessages" })
class FailedMessage extends Model<FailedMessage> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    // ID da mensagem no WhatsApp (wid)
    @Column(DataType.STRING)
    wid: string;

    // Corpo/texto da mensagem
    @Column(DataType.TEXT)
    body: string;

    // Tipo da mensagem (text, image, video, audio, document, etc)
    @Column(DataType.STRING)
    messageType: string;

    // Número de quem enviou
    @Column(DataType.STRING)
    fromNumber: string;

    // Número de destino
    @Column(DataType.STRING)
    toNumber: string;

    // Canal (whatsapp_oficial, whatsapp, etc)
    @Column(DataType.STRING)
    channel: string;

    // Erro que causou a falha
    @Column(DataType.TEXT)
    errorMessage: string;

    // Stack trace do erro
    @Column(DataType.TEXT)
    errorStack: string;

    // Dados brutos recebidos da API (JSON completo para debug)
    @Column(DataType.JSON)
    rawData: any;

    // Status: 'pending' (aguardando análise), 'resolved' (resolvido), 'ignored' (ignorado)
    @Default("pending")
    @Column(DataType.STRING)
    status: string;

    // Notas do suporte (preenchido manualmente ao analisar)
    @Column(DataType.TEXT)
    supportNotes: string;

    // Se a mensagem foi recuperada via fallback (SafeCreateMessage)
    @Default(false)
    @Column
    recoveredByFallback: boolean;

    // Tentativas de salvamento
    @Default(1)
    @Column
    retryCount: number;

    @ForeignKey(() => Ticket)
    @Column
    ticketId: number;

    @BelongsTo(() => Ticket)
    ticket: Ticket;

    @ForeignKey(() => Contact)
    @Column
    contactId: number;

    @BelongsTo(() => Contact, "contactId")
    contact: Contact;

    @ForeignKey(() => Company)
    @Column
    companyId: number;

    @BelongsTo(() => Company)
    company: Company;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default FailedMessage;
