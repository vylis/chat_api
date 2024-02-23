export const createMessageTable = `
    CREATE TABLE IF NOT EXISTS message (
      id int NOT NULL AUTO_INCREMENT,
      message text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
      created_at datetime NOT NULL,
      room_id int NOT NULL,
      patient_user_id int DEFAULT NULL,
      user_id int DEFAULT NULL,
      is_read tinyint NOT NULL,
      updated_at datetime DEFAULT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB AUTO_INCREMENT=151 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `;

export const createRoomTable = `
 CREATE TABLE IF NOT EXISTS room (
      room_id int NOT NULL AUTO_INCREMENT,
      name varchar(255) NOT NULL,
      created_at datetime NOT NULL,
      is_active tinyint NOT NULL,
      updated_at datetime DEFAULT NULL,
      owner_id int NOT NULL,
      PRIMARY KEY (room_id),
      UNIQUE KEY id_UNIQUE (room_id)
    ) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `;
