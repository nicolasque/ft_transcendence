import db from '../db.js';
import sequelize from "sequelize";

const TournamentModel = db.define('tournament', {
	id: {
		type: sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	status: {
		type: sequelize.ENUM('pending', 'finished'),
		allowNull: false,
		defaultValue: 'pending'
	},
	game: {
        type: sequelize.ENUM('pong', 'tictactoe'),
        allowNull: false
    },
	participants: {
		type: sequelize.JSON,
		allowNull: false
	},
});

export default TournamentModel;