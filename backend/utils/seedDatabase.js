import UserModel from '../models/Users.js';
import FriendshipModel from '../models/Friends.js';


async function seedDatabase() {
	try {
		// Verificar si ya hay usuarios en la base de datos
		const userCount = await UserModel.count();

		if (userCount > 0) {
			console.log(`✓ Base de datos ya contiene ${userCount} usuarios. No se crearán usuarios de prueba.`);
			return;
		}

		console.log('Poblando base de datos con usuarios de prueba...');

		// Crear 10 usuarios de prueba
		const users = [
			{ username: 'user1', email: 'user1@test.com', fullname: 'Usuario Uno', password: '1234' },
			{ username: 'user2', email: 'user2@test.com', fullname: 'Usuario Dos', password: '1234' },
			{ username: 'user3', email: 'user3@test.com', fullname: 'Usuario Tres', password: '1234' },
			{ username: 'user4', email: 'user4@test.com', fullname: 'Usuario Cuatro', password: '1234' },
			{ username: 'user5', email: 'user5@test.com', fullname: 'Usuario Cinco', password: '1234' },
			{ username: 'user6', email: 'user6@test.com', fullname: 'Usuario Seis', password: '1234' },
			{ username: 'user7', email: 'user7@test.com', fullname: 'Usuario Siete', password: '1234' },
			{ username: 'user8', email: 'user8@test.com', fullname: 'Usuario Ocho', password: '1234' },
			{ username: 'user9', email: 'user9@test.com', fullname: 'Usuario Nueve', password: '1234' },
			{ username: 'user10', email: 'user10@test.com', fullname: 'Usuario Diez', password: '1234' },


			{ username: 'guest1', email: 'guest1@guest.com', fullname: 'Invitado 1', password: '1234', is_guest: true },
			{ username: 'guest2', email: 'guest2@guest.com', fullname: 'Invitado 2', password: '1234', is_guest: true },
			{ username: 'guest3', email: 'guest3@guest.com', fullname: 'Invitado 3', password: '1234', is_guest: true },
			{ username: 'guest4', email: 'guest4@guest.com', fullname: 'Invitado 4', password: '1234', is_guest: true },
			{ username: 'guest5', email: 'guest5@guest.com', fullname: 'Invitado 5', password: '1234', is_guest: true },
			{ username: 'guest6', email: 'guest6@guest.com', fullname: 'Invitado 6', password: '1234', is_guest: true },
			{ username: 'guest7', email: 'guest7@guest.com', fullname: 'Invitado 7', password: '1234', is_guest: true },
			{ username: 'guest8', email: 'guest8@guest.com', fullname: 'Invitado 8', password: '1234', is_guest: true },
			{ username: 'guest9', email: 'guest9@guest.com', fullname: 'Invitado 9', password: '1234', is_guest: true },
			{ username: 'guest10', email: 'guest10@guest.com', fullname: 'Invitado 10', password: '1234', is_guest: true },
			{ username: 'guest11', email: 'guest11@guest.com', fullname: 'Invitado 11', password: '1234', is_guest: true },
			{ username: 'guest12', email: 'guest12@guest.com', fullname: 'Invitado 12', password: '1234', is_guest: true },
			{ username: 'guest13', email: 'guest13@guest.com', fullname: 'Invitado 13', password: '1234', is_guest: true },
			{ username: 'guest14', email: 'guest14@guest.com', fullname: 'Invitado 14', password: '1234', is_guest: true },
			{ username: 'guest15', email: 'guest15@guest.com', fullname: 'Invitado 15', password: '1234', is_guest: true },


			{ username: 'ia', email: 'ia@test.com', fullname: 'IA', password: '1234', is_guest: true },
			{ username: 'guess', email: 'guess@test.com', fullname: 'GUESS', password: '1234', is_guest: true }

		];

		// Insertar usuarios en la base de datos
		await UserModel.bulkCreate(users, {
			individualHooks: true // Esto activa los hooks beforeCreate para hashear las contraseñas
		});

		console.log(`✓ ${users.length} usuarios de prueba creados exitosamente`);
		console.log('  Usuarios: user1, user2, user3, ..., user10');
		console.log('  Contraseña para todos: 1234');



		console.log('Creando amistades de prueba...');
		const user1 = await UserModel.findOne({ where: { username: 'user1' } });
		const friends = await UserModel.findAll({
			where: {
				username: ['user2', 'user3', 'user4', 'user5']
			}
		});

		if (user1 && friends.length > 0) {
			const friendshipPromises = friends.map(friend => {
				// Se crea una sola entrada por amistad
				return FriendshipModel.create({
					one_user_id: user1.id,
					two_user_id: friend.id,
					state: 'accepted'
				});
			});

			await Promise.all(friendshipPromises);
			console.log(`✓ Amistades creadas para ${user1.username}`);
		}

	} catch (error) {
		console.error('Error al poblar la base de datos:', error);
	}
}

export default seedDatabase;