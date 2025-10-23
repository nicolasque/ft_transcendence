import { where, Op } from "sequelize";
import UserModel from "../models/Users.js";
import MatchModel from "../models/match.js";

function calculateNewElo(eloPlayerOne, eloPlayerTwo, playerOneWon) {
	const K = 32;
	const expectedScoreOne = 1 / (1 + 10 ** ((eloPlayerTwo - eloPlayerOne) / 400));
	const expectedScoreTwo = 1 / (1 + 10 ** ((eloPlayerOne - eloPlayerTwo) / 400));
	const actualScoreOne = playerOneWon ? 1 : 0;
	const actualScoreTwo = playerOneWon ? 0 : 1;
	const newEloPlayerOne = Math.round(eloPlayerOne + K * (actualScoreOne - expectedScoreOne));
	const newEloPlayerTwo = Math.round(eloPlayerTwo + K * (actualScoreTwo - expectedScoreTwo));
	return { newEloPlayerOne, newEloPlayerTwo };
}

class MatchControler {

	constructor() { };

	async createMatch(req, res) {
		try {
			const matchData = { ...req.body };

			if (matchData.match_type === 'ia') {
				const iaUser = await UserModel.findOne({ where: { username: 'ia' } });
				if (!iaUser) {
					return res.status(500).send({ error: 'El usuario IA no se encuentra en la base de datos.' });
				}
				matchData.palyer2 = iaUser.id;
				console.log('Match vs IA creado.');
			}
			else if (matchData.match_type === 'local') {
				const guessUser = await UserModel.findOne({ where: { username: 'guess' } });
				if (!guessUser) {
					return res.status(500).send({ error: 'El usuario Guest (guess) no se encuentra en la base de datos.' });
				}
				matchData.palyer2 = guessUser.id;
				console.log('Match Local (vs Guess) creado.');
			} else if (matchData.match_type === 'friends') {
				if (!matchData.palyer2) {
					return res.status(400).send({ error: 'Falta el ID del oponente para una partida entre amigos.' });
				}
				const opponentUser = await UserModel.findByPk(matchData.palyer2);
				if (!opponentUser) {
					return res.status(404).send({ error: 'El usuario oponente especificado no existe.' });
				}
				console.log(`Match vs Friend (ID: ${matchData.palyer2}) creado.`);
			} else if (!matchData.palyer2) {
				console.warn(`Tipo de partida desconocido o palyer2 faltante: ${matchData.match_type}. Asignando 'guess' por defecto.`);
				const guessUser = await UserModel.findOne({ where: { username: 'guess' } });
				matchData.palyer2 = guessUser ? guessUser.id : null;
				if (!matchData.palyer2) return res.status(500).send({ error: 'El usuario Guest (guess) no se encuentra y es necesario.' });
			}
			const matchModel = await MatchModel.create(matchData);

			if (matchModel) {
				return res.status(200).send({ status: true, message: 'Partida creada correctamente', id: matchModel.id });
			} else {
				return res.status(500).send({ error: 'No se pudo crear la partida.' });
			}
		} catch (e) {
			console.error('Error en createMatch:', e);
			if (e.name === 'SequelizeValidationError') {
				return res.status(400).send({ error: 'Datos inválidos para crear la partida.', details: e.errors });
			}
			return res.status(500).send({ error: e.message || 'Error interno del servidor.' });
		};
	}

	async getAllMatch(req, res) {
		try {
			const queryParams = { ...req.query };
			const whereClause = {};

			if (queryParams.user_id) {
				whereClause[Op.or] = [
					{ palyer1: queryParams.user_id },
					{ palyer2: queryParams.user_id }
				];
				delete queryParams.user_id;
			}
			Object.assign(whereClause, queryParams);

			const lista = await MatchModel.findAll({
				where: whereClause,
				include: [
					{
						model: UserModel,
						as: 'player_one',
						attributes: ['id', 'username']
					},
					{
						model: UserModel,
						as: 'player_two',
						attributes: ['id', 'username']
					}
				],
				order: [['createdAt', 'DESC']]
			});

			return res.status(200).send(lista);
		} catch (e) {
			console.error("Error en getAllMatch:", e);
			return res.status(500).send({ error: e.message });
		}
	}

	async update(req, res) {
		try {
			const { matchId } = req.params;
			const updates = req.body;
			const match = await MatchModel.findByPk(matchId);
			if (!match) {
				return res.status(404).send({ message: 'Partida no encontrada' });
			}
			Object.assign(match, updates);
			await match.save();

			let updatedPlayerOne = null;
			let updatedPlayerTwo = null;
			if (updates.match_status === 'finish' && match.player_one_points !== match.player_two_points) {
				const playerOne = await UserModel.findByPk(match.palyer1);
				const playerTwo = await UserModel.findByPk(match.palyer2);

				if (playerOne && playerTwo) {
					const playerOneWon = match.player_one_points > match.player_two_points;
					const { newEloPlayerOne, newEloPlayerTwo } = calculateNewElo(playerOne.elo, playerTwo.elo, playerOneWon);

					playerOne.elo = newEloPlayerOne;
					playerTwo.elo = newEloPlayerTwo;

					await playerOne.save();
					await playerTwo.save();

					updatedPlayerOne = playerOne.get({ plain: true });
					delete updatedPlayerOne.password;
					delete updatedPlayerOne.twofa_secret;

					updatedPlayerTwo = playerTwo.get({ plain: true });
					delete updatedPlayerTwo.password;
					delete updatedPlayerTwo.twofa_secret;

					console.log(`ELO Actualizado: ${playerOne.username} (${newEloPlayerOne}), ${playerTwo.username} (${newEloPlayerTwo})`);
				} else {
					console.log('No se actualiza el ELO si uno de los jugadores no existe.');
				}
			} else if (updates.match_status === 'finish') {
				console.log(`Partida ${matchId} terminada en empate. No se actualiza el ELO.`);
				const playerOne = await UserModel.findByPk(match.palyer1, { attributes: { exclude: ['password', 'twofa_secret'] } });
				const playerTwo = await UserModel.findByPk(match.palyer2, { attributes: { exclude: ['password', 'twofa_secret'] } });
				updatedPlayerOne = playerOne ? playerOne.get({ plain: true }) : null;
				updatedPlayerTwo = playerTwo ? playerTwo.get({ plain: true }) : null;
			}

			return res.status(200).send({
				match: match.get({ plain: true }),
				playerOne: updatedPlayerOne,
				playerTwo: updatedPlayerTwo
			});

		} catch (e) {
			console.error("Error al actualizar partida y ELO:", e);
			return res.status(500).send({ error: e.message });
		}
	}
}

export default new MatchControler();