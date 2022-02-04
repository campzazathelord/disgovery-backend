require("dotenv").config();
const Sequelize  = require('sequelize')
const sequelize = new Sequelize(process.env.MYSQL_DATABASE || 'DisgoveryDatabase',process.env.MYSQL_USER || 'admin',process.env.MYSQL_PASSWORD || 'disgovery',{
    dialect:'mysql',
    host:process.env.MYSQL_HOST || 'disgovery-database.cg25477elnau.ap-southeast-1.rds.amazonaws.com'
});
module.exports = sequelize


