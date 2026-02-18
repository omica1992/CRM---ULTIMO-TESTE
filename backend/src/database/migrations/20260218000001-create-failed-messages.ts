import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("FailedMessages", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            wid: {
                type: DataTypes.STRING,
                allowNull: true
            },
            body: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            messageType: {
                type: DataTypes.STRING,
                allowNull: true
            },
            fromNumber: {
                type: DataTypes.STRING,
                allowNull: true
            },
            toNumber: {
                type: DataTypes.STRING,
                allowNull: true
            },
            channel: {
                type: DataTypes.STRING,
                allowNull: true
            },
            errorMessage: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            errorStack: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            rawData: {
                type: DataTypes.JSON,
                allowNull: true
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "pending"
            },
            supportNotes: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            recoveredByFallback: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            retryCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            ticketId: {
                type: DataTypes.INTEGER,
                references: { model: "Tickets", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                allowNull: true
            },
            contactId: {
                type: DataTypes.INTEGER,
                references: { model: "Contacts", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
                allowNull: true
            },
            companyId: {
                type: DataTypes.INTEGER,
                references: { model: "Companies", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Índice para busca rápida por empresa e status
        await queryInterface.addIndex("FailedMessages", ["companyId", "status"], {
            name: "idx_failed_messages_company_status"
        });

        // Índice para busca por ticket
        await queryInterface.addIndex("FailedMessages", ["ticketId"], {
            name: "idx_failed_messages_ticket"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("FailedMessages");
    }
};
