require("dotenv").config();
const Sequelize  = require('sequelize')
const sequelize = new Sequelize(process.env.MYSQL_DATABASE || 'Camp',process.env.MYSQL_USER || 'root',process.env.MYSQL_PASSWORD || 'camperzaza123',{
    dialect:'mysql',
    host:process.env.MYSQL_HOST || 'localhost'
});
module.exports = sequelize


