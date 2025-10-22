import { where, Op } from "sequelize";
import UserModel from "../models/Users.js";
import TournamentModel from "../models/Tournament.js";
import MatchModel from "../models/match.js";

class TournamentController 
{
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

			const tournament = await TournamentModel.create( // crea el torneo
			{
				game,
				participants: participantsFinal,
			});
	
			res.status(201).send({ message: 'Torneo creado con éxito (sin bracket generado)', tournament });
		} 
			catch (error) 
			{
				console.error('Error creando el torneo:', error);
				res.status(500).send({ error: error.message });
			}
		};

	getTournamentInfo = async (req, res) => 
	{
		try 
		{
			const { id } = req.params;
		
			if (!id)
					return res.status(400).send({ message: 'ID del torneo es requerido.' });
		
			const tournament = await TournamentModel.findByPk(Number(id), // 1. Obtener estado, juego y lista de IDs (participants)
			{
					attributes: ['status', 'game', 'participants']
			});
			if (!tournament)
					return res.status(404).send({ message: 'Torneo no encontrado.' });
		
			const { status, game, participants } = tournament.get({ plain: true });
		
			const users = await UserModel.findAll( // 2. Obtener la información detallada de los usuarios
			{
					where: { id: participants },
					attributes: ['id', 'username', 'elo', 'avatar'],
			});
		
			const formattedParticipants = users.map(user => // 3. Formatear los datos para incluir el avatar_url
			{ 
					const userData = user.get({ plain: true }); // convierte el objeto del modelo Sequelize a un objeto JavaScript simple, facilitando el acceso a sus propiedades
					return { id: userData.id, username: userData.username, elo: userData.elo, avatar: userData.avatar };
			});
		
			const responseData = // 4. Construir la respuesta final
			{
				id: Number(id),
				status: status,
				game: game,
				participants: formattedParticipants,
			};
		
			res.status(200).send({ status: true, data: responseData });
		
		}
		catch (error) 
		{
			console.error('Error al obtener información del torneo:', error);
			res.status(500).send({ error: error.message });
		}
	};
}

export default new TournamentController();
