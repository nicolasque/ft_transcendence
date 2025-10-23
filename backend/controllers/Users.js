import { promises as fsPromises } from 'fs';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';
import path from 'path';
import { randomBytes } from 'crypto';
import UserModel from "../models/Users.js";

const pump = util.promisify(pipeline);

class UserControler {
	cosntructor() {
	}

	async create(req, res) {
		try {
			const userModel = await UserModel.create(req.body);
			if (userModel)
				return res.status(200).send({ status: true, id: userModel.id });
		}
		catch (error) {
			return res.status(500).send({ error: error });
		}
	}

	async getAll(req, res) {
		try {
			const where = { ...req.query };

			const lista = await UserModel.findAll({ where, attributes: { exclude: ['password'] } });
			return res.status(200).send(lista);

		} catch (error) {
			return res.status(500).send({ error: error });
		}
	}

	async getOne(req, res) {
		try {
			const { identifier } = req.params;

			let userModel;
			if (/^\d+$/.test(identifier)) {
				userModel = await UserModel.findByPk(Number(identifier), {
					attributes: { exclude: ['password'] }
				});
			} else {
				userModel = await UserModel.findOne({
					where: { username: identifier },
					attributes: { exclude: ['password'] }
				});
			}

			if (userModel) {
				const userData = userModel.get({ plain: true });

				if (userData.avatar && userData.avatar !== 'placeholder.png') {
					userData.avatar_url = `/uploads/avatars/${userData.avatar}`;
				} else {
					userData.avatar_url = null;
				}

				delete userData.password;
				delete userData.twofa_secret;
				return res.status(200).send(userData);
			}
			return res.status(404).send({ message: 'Registro no encontrado' });

		} catch (error) {
			return res.status(500).send({ error });
		}
	}

	async update(req, res) {
		try {
			const { identifier } = req.params;

			let userModel = /^\d+$/.test(identifier)
				? await UserModel.findByPk(Number(identifier))
				: await UserModel.findOne({ where: { username: identifier } });

			if (!userModel)
				return res.status(404).send({ message: 'Registro no encontrado' });

			if ('id' in req.body) delete req.body.id;

			Object.assign(userModel, req.body);
			await userModel.save(); // dispara hooks (hash password si cambió)

			const plain = userModel.get({ plain: true });
			delete plain.password;

			return res.status(200).send(plain);
		} catch (error) {
			return res.status(500).send({ error });
		}
	}

	async delete(req, res) {
		try {
			const { id } = req.params;
			const userModel = await UserModel.destroy({ where: { id } });
			if (userModel)
				return res.status(200).send({ status: true });
			else {
				return res.status(404).send({ message: 'Registro no encontrado', });
			}
		} catch (error) {
			return res.status(500).send({ error: error });
		}
	}

	async uploadAvatar(req, res) {
		try {
			const data = await req.file();
			if (!data) {
				return res.status(400).send({ message: 'No se subió ningún archivo.' });
			}
			const uniqueSuffix = randomBytes(16).toString('hex');
			const extension = path.extname(data.filename);
			const newFilename = `${uniqueSuffix}${extension}`;
			const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
			const uploadPath = path.join(uploadDir, newFilename);

			try {
				await fsPromises.access(uploadDir);
			} catch (error) {
				await fsPromises.mkdir(uploadDir, { recursive: true });
				console.log(`Directorio creado: ${uploadDir}`);
			}
			await pump(data.file, fs.createWriteStream(uploadPath));
			console.log(`Archivo guardado en: ${uploadPath}`);

			const userId = req.user.id;
			const user = await UserModel.findByPk(userId);
			if (!user) {
				await fs.unlink(uploadPath);
				return res.status(404).send({ message: 'Usuario no encontrado.' });
			}
			user.avatar = newFilename;
			await user.save();
			console.log(`Avatar actualizado en BD para user ${userId}: ${newFilename}`);

			const avatarUrl = `/uploads/avatars/${newFilename}`;
			return res.status(200).send({
				message: 'Avatar actualizado correctamente.',
				avatarUrl: avatarUrl
			});

		} catch (error) {
			console.error('Error al procesar la subida del avatar:', error);
			return res.status(500).send({ error: 'Error interno al procesar el archivo.' });
		}
	}

}

export default new UserControler();
