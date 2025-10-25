import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Schedules", "templateMetaId", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Schedules", "templateLanguage", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Schedules", "templateComponents", {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Schedules", "isTemplate", {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Schedules", "templateMetaId");
    await queryInterface.removeColumn("Schedules", "templateLanguage");
    await queryInterface.removeColumn("Schedules", "templateComponents");
    await queryInterface.removeColumn("Schedules", "isTemplate");
  }
};
