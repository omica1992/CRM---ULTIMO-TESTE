import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Adicionar campos de erro de entrega em Messages
        await queryInterface.addColumn("Messages", "deliveryError", {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Mensagem de erro da Meta API quando entrega falha"
        });

        await queryInterface.addColumn("Messages", "deliveryErrorCode", {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Código do erro da Meta API (ex: 130472)"
        });

        await queryInterface.addColumn("Messages", "deliveryErrorAt", {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Timestamp de quando o erro de entrega ocorreu"
        });

        // Adicionar campo de motivo de rejeição em QuickMessages
        await queryInterface.addColumn("QuickMessages", "rejectionReason", {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Motivo da rejeição do template pela Meta API"
        });

        // Criar índice para buscar mensagens com erro
        await queryInterface.addIndex("Messages", ["deliveryErrorCode", "companyId"], {
            name: "messages_delivery_error_code_company_idx",
            where: {
                deliveryErrorCode: { [Symbol.for('ne')]: null }
            }
        });
    },

    down: async (queryInterface: QueryInterface) => {
        // Remover índice
        await queryInterface.removeIndex("Messages", "messages_delivery_error_code_company_idx");

        // Remover campos
        await queryInterface.removeColumn("Messages", "deliveryError");
        await queryInterface.removeColumn("Messages", "deliveryErrorCode");
        await queryInterface.removeColumn("Messages", "deliveryErrorAt");
        await queryInterface.removeColumn("QuickMessages", "rejectionReason");
    }
};
