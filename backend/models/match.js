import sequelize from "sequelize";
import db from '../db.js';
import UserModel from "./Users.js"
import ChatModel from "./Chat.js";
import TournamentModel from "./Tournament.js"

const MatchModel = db.define('match', {
	id: {
		type: sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	palyer1: {
		type: sequelize.INTEGER,
		allowNull: true
	},
	palyer2: {
		type: sequelize.INTEGER,
		allowNull: true,
	},
	game: {
		type: sequelize.ENUM('pong', 'tictactoe'),
		allowNull: false
	},
	match_type: {
		type: sequelize.ENUM('local', 'friends', 'ia', 'gues'),
		allowNull: true,
		defaultValue: null
	},
	match_status: {
		type: sequelize.ENUM('pending', 'playing', 'finish'),
		allowNull: false,
	},
	tournament_id: {
		type: sequelize.INTEGER,
		allowNull: true,
		references: {
			model: 'tournaments',
			key: 'id'
		}
	},
	round: { // El número de la ronda a la que pertenece esta partida
		type: sequelize.INTEGER,
		allowNull: true
	},
	next_match_id: { // El ID de la partida a la que pasará el ganador
		type: sequelize.INTEGER,
		allowNull: true,
		references: {
			model: 'matches',
			key: 'id'
		}
	},
	player_one_points: {
		type: sequelize.INTEGER,
		allowNull: false,
		defaultValue: 0
	},
	player_two_points: {
		type: sequelize.INTEGER,
		allowNull: false,
		defaultValue: 0
	}
});

MatchModel.belongsTo(UserModel, { as: 'player_one', foreignKey: 'palyer1' });
MatchModel.belongsTo(UserModel, { as: 'player_two', foreignKey: 'palyer2' });

UserModel.hasMany(ChatModel, {
	foreignKey: 'palyer1',
	as: 'player_one'
});

UserModel.hasMany(ChatModel, {
	foreignKey: 'palyer2',
	as: 'player_two'
});

TournamentModel.hasMany(MatchModel, { foreignKey: 'tournament_id' });
MatchModel.belongsTo(TournamentModel, { foreignKey: 'tournament_id' });
MatchModel.belongsTo(MatchModel, { as: 'next_match', foreignKey: 'next_match_id' });

MatchModel.afterUpdate(async (match, options) => {
	// Comprobar PRIMERO si una partida de torneo ha terminado.
	if (match.changed('match_status') && match.match_status === 'finish' && match.tournament_id) {

		//Definir al ganador aquí para que esté disponible en ambos casos.
		const winnerId = match.player_one_points > match.player_two_points
			? match.palyer1
			: match.palyer2;

		//Si ay una siguiente partida, avanza al ganador.
		if (match.next_match_id) {
			const nextMatch = await MatchModel.findByPk(match.next_match_id);

			if (nextMatch) {
				if (!nextMatch.palyer1) {
					await nextMatch.update({ palyer1: winnerId });
				} else if (!nextMatch.palyer2) {
					await nextMatch.update({ palyer2: winnerId });
				}
			}
		}
		//Si NO ay siguiente partida, Fianliza el torneo.
		else {
			const tournament = await TournamentModel.findByPk(match.tournament_id);

			if (tournament) {
				await tournament.update({
					status: 'finished',
					winner_id: winnerId
				});
				console.log(`🏆 Torneo ${tournament.id} finalizado. Ganador: Usuario ${winnerId}`);
			}
		}
	}
});

export default MatchModel;
