import { where, Op } from "sequelize";
import UserModel from "../models/Users.js";
import TournamentModel from "../models/Tournament.js";
import MatchModel from "../models/match.js";

class TournamentController {
	constructor() { }


	createTournament = async (req, res) => 
		{
			try 
			{
				let { game, participants: humanParticipants, tournamentSize } = req.body;
	
				const validSizes = [4, 8, 16];
				tournamentSize = Number(tournamentSize); // Asegurar que sea un número
				if (!validSizes.includes(tournamentSize))
					return res.status(400).send({ message: 'El tamaño del torneo debe ser 4, 8 o 16.' });
	
				if (!humanParticipants || humanParticipants.length < 1 || humanParticipants.length > tournamentSize)
					 return res.status(400).send({ message: `El número de participantes humanos debe ser entre 1 y ${tournamentSize}.` });
	
				const iaUser = await UserModel.findOne({ where: { username: 'ia' } }); // Obtención del ID del usuario IA
				if (!iaUser) 
				{
					console.error("Usuario 'ia' no encontrado en la base de datos.");
					return res.status(500).send({ message: 'Error interno: La cuenta de la IA no está disponible.' });
				}
				const iaId = iaUser.id;
				let iaSlotsToFill = tournamentSize - humanParticipants.length;
	
				let finalParticipantsList = [];
				let humansArray = [...humanParticipants];
				
				let i = 0; // Prioriza la alternancia H-IA: 1. Alterna un Humano y una IA hasta que uno se agote. 2. Añade el resto de IAs o Humanos.
				while (humansArray.length > 0 && iaSlotsToFill > 0) // Fase 1: Intercalar H y IA hasta agotar el participante menos numeroso
				{
					if (i % 2 === 0)
						finalParticipantsList.push(humansArray.shift());
					else 
					{
						finalParticipantsList.push(iaId);
						iaSlotsToFill--;
					}
					i++;
				}
				while (iaSlotsToFill > 0) // Fase 2: Añadir los participantes restantes (solo serán humanos o solo IAs)
				{
					finalParticipantsList.push(iaId);
					iaSlotsToFill--;
				}
				while (humansArray.length > 0)
					finalParticipantsList.push(humansArray.shift());
				const participantsFinal = finalParticipantsList;

				const tournamentName = `Torneo de ${game} - ${new Date().toLocaleString('es-ES')}`; // Genera el Nombre del Torneo
	
				const tournament = await TournamentModel.create( // crea el torneo
				{ 
					name: tournamentName, 
					game, 
					participants: participantsFinal,
					status: 'pending'
				});
	
				res.status(201).send({ message: 'Torneo creado con éxito (sin bracket generado)', tournament });
			} 
			catch (error) 
			{
				console.error('Error creando el torneo:', error);
				res.status(500).send({ error: error.message });
			}
		};


	createBracket = async (tournament, participants) => {
        const numPlayers = participants.length;
        const totalRounds = Math.log2(numPlayers);
        let previousRoundMatches = [];

        // Crea las partidas desde la primera ronda hacia la final
        for (let round = 1; round <= totalRounds; round++) {
            const numMatchesInRound = numPlayers / (2 ** round);
            const currentRoundMatches = [];

            for (let i = 0; i < numMatchesInRound; i++) {
                const newMatch = await MatchModel.create({
                    tournament_id: tournament.id,
                    round: round,
                    game: tournament.game,
                    match_status: 'pending',
                    // Si es la ronda 1, asigna los jugadores
                    player_one_id: round === 1 ? participants[i * 2] : null,
                    player_two_id: round === 1 ? participants[i * 2 + 1] : null,
                });
                currentRoundMatches.push(newMatch);
            }

            // Enlaza las partidas de la ronda anterior a la actual
            if (previousRoundMatches.length > 0) {
                for (let i = 0; i < previousRoundMatches.length; i++) {
                    // El ganador de la partida 'i' de la ronda anterior
                    // va a la partida 'floor(i/2)' de la ronda actual.
                    await previousRoundMatches[i].update({
                        next_match_id: currentRoundMatches[Math.floor(i / 2)].id
                    });
                }
            }
            previousRoundMatches = currentRoundMatches;
        }
    }


	finishTournament = async (req, res) => {
		try {
			const { id } = req.params;

			// 1. Encontrar la partida final (la que no tiene next_match_id)
			const finalMatch = await MatchModel.findOne({
				where: {
					tournament_id: id,
					next_match_id: null,
					match_status: 'finish'
				}
			});

			if (!finalMatch) {
				return res.status(404).send({ message: 'La partida final del torneo no ha concluido o no se encuentra.' });
			}

			// 2. Determinar el ganador de la partida final
			const winnerId = finalMatch.player_one_points > finalMatch.player_two_points ? finalMatch.player_one_id : finalMatch.player_two_id;

			// 3. Actualizar el torneo con el ganador y el estado 'finished'
			await TournamentModel.update(
				{ winner_id: winnerId, status: 'finished' },
				{ where: { id: id } }
			);

			res.status(200).send({ message: 'Torneo finalizado con éxito', winnerId: winnerId });
		} catch (error) {
			console.error('Error finalizando el torneo:', error);
			res.status(500).send({ error: error.message });
		}
	}
}

export default new TournamentController();
