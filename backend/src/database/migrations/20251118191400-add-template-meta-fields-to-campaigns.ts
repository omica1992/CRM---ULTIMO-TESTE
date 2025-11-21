import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      // Alterar templateId de INTEGER para STRING
      queryInterface.changeColumn("Campaigns", "templateId", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      
      // Adicionar novos campos de template Meta
      queryInterface.addColumn("Campaigns", "templateName", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      
      queryInterface.addColumn("Campaigns", "templateLanguage", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      
      queryInterface.addColumn("Campaigns", "templateComponents", {
        type: DataTypes.JSON,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      // Reverter templateId para INTEGER
      queryInterface.changeColumn("Campaigns", "templateId", {
        type: DataTypes.INTEGER,
        allowNull: true
      }),
      
      // Remover campos adicionados
      queryInterface.removeColumn("Campaigns", "templateName"),
      queryInterface.removeColumn("Campaigns", "templateLanguage"),
      queryInterface.removeColumn("Campaigns", "templateComponents")
    ]);
  }
};
