import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verificar se as colunas já existem antes de adicionar
    const tableDescription = await queryInterface.describeTable("Webhooks") as any;

    if (!tableDescription.active) {
      await queryInterface.addColumn("Webhooks", "active", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true
      });
      console.log("✅ Coluna 'active' adicionada à tabela Webhooks");
    } else {
      console.log("⚠️ Coluna 'active' já existe na tabela Webhooks");
    }

    if (!tableDescription.requestMonth) {
      await queryInterface.addColumn("Webhooks", "requestMonth", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      });
      console.log("✅ Coluna 'requestMonth' adicionada à tabela Webhooks");
    } else {
      console.log("⚠️ Coluna 'requestMonth' já existe na tabela Webhooks");
    }

    if (!tableDescription.requestAll) {
      await queryInterface.addColumn("Webhooks", "requestAll", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      });
      console.log("✅ Coluna 'requestAll' adicionada à tabela Webhooks");
    } else {
      console.log("⚠️ Coluna 'requestAll' já existe na tabela Webhooks");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Webhooks", "active");
    await queryInterface.removeColumn("Webhooks", "requestMonth");
    await queryInterface.removeColumn("Webhooks", "requestAll");
  }
};
