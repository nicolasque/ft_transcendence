import UserModel from "../models/Users.js";
import jwtUtils from "../utils/jwtUtils.js";
import twoFAUtils from "../utils/twoFAUtils.js";
import ChatModel from "../models/Chat.js";
import { Op } from "sequelize";

class ChatController {
	constructor() {
	}

	async sendMessage(req, res) {
		try {
			const { recipientId, message } = req.body;
			const senderId = req.user.id;

			if (senderId === recipientId) {
				return res.status(400).send({ status: false, message: "No puedes enviarte mensajes a ti mismo." });
			}
			const recipient = await UserModel.findByPk(recipientId);
			if (!recipient) {
				return res.status(404).send({ status: false, message: "El destinatario no existe." });
			}

			// CORRECCIÓN: Usar los nombres de columna del modelo
			const chatMessage = await ChatModel.create({
				sender_id: senderId,
				reciver_id: recipientId, // Corregido para coincidir con el typo en el modelo
				message: message,
				timestamp: new Date()
			});

			return res.status(200).send({ status: true, message: "Mensaje enviado.", data: chatMessage });
		} catch (e) {
			return res.status(500).send({ error: e.message });
		}
	}

	async sendPublicMessage(req, res) {
		try {
			const { message } = req.body;
			const senderId = req.user.id;

			const chatMessage = await ChatModel.create({
				sender_id: senderId, // Corregido
				reciver_id: null,
				message: message,
				timestamp: new Date()
			});

			return res.status(200).send({ status: true, message: "Mensaje público enviado.", data: chatMessage });
		} catch (e) {
			return res.status(500).send({ error: e.message });
		}
	}

	async getPublicMessages(req, res) {
		try {
			const messages = await ChatModel.findAll({
				where: { reciver_id: null }, // Corregido
				order: [['timestamp', 'ASC']]
			});

			return res.status(200).send(messages);
		} catch (e) {
			return res.status(500).send({ error: e.message });
		}
	}

	async getMessages(req, res) {
		try {
			const userId = req.user.id;
			// CORRECCIÓN: Usar el nombre del parámetro de la ruta
			const { otherUserId } = req.params;

			const withUser = await UserModel.findByPk(Number(otherUserId));
			if (!withUser) {
				return res.status(404).send({ status: false, message: "El usuario con el que quieres chatear no existe." });
			}

			const messages = await ChatModel.findAll({
				where: {
					[Op.or]: [
						{ sender_id: userId, reciver_id: otherUserId },
						{ sender_id: otherUserId, reciver_id: userId }
					]
				},
				order: [['timestamp', 'ASC']]
			});

			return res.status(200).send(messages);
		} catch (e) {
			return res.status(500).send({ error: e.message });
		}
	}
}

export default new ChatController();