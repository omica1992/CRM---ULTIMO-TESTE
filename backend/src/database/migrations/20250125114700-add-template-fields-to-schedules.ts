import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo: any = await queryInterface.describeTable("Schedules");
    
    const promises = [];
    
    // Adicionar apenas se não existir
    if (!tableInfo.templateMetaId) {
      promises.push(
        queryInterface.addColumn("Schedules", "templateMetaId", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        })
      );
    }
    
    if (!tableInfo.templateLanguage) {
      promises.push(
        queryInterface.addColumn("Schedules", "templateLanguage", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        })
      );
    }
    
    if (!tableInfo.templateComponents) {
      promises.push(
        queryInterface.addColumn("Schedules", "templateComponents", {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null
        })
      );
    }
    
    if (!tableInfo.isTemplate) {
      promises.push(
        queryInterface.addColumn("Schedules", "isTemplate", {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false
        })
      );
    }
    
    return Promise.all(promises);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Schedules", "templateMetaId"),
      queryInterface.removeColumn("Schedules", "templateLanguage"),
      queryInterface.removeColumn("Schedules", "templateComponents"),
      queryInterface.removeColumn("Schedules", "isTemplate")
    ]);
  }
};
