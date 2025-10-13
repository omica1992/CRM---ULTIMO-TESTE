import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("CampaignShipping", "failedAt", {
        type: DataTypes.DATE,
        allowNull: true
      }),
      queryInterface.addColumn("CampaignShipping", "errorMessage", {
        type: DataTypes.TEXT,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("CampaignShipping", "failedAt"),
      queryInterface.removeColumn("CampaignShipping", "errorMessage")
    ]);
  }
};
