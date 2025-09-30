import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Campaigns", "templateId", {
        type: DataTypes.INTEGER,
        references: { model: "QuickMessages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      }),
      queryInterface.addColumn("Campaigns", "templateVariables", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Campaigns", "templateId"),
      queryInterface.removeColumn("Campaigns", "templateVariables")
    ]);
  }
};
