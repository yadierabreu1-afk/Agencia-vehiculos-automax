CREATE DATABASE IF NOT EXISTS vehiculosdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vehiculosdb;

CREATE TABLE IF NOT EXISTS marcas (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  sigla CHAR(2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marcas_nombre (nombre),
  UNIQUE KEY uq_marcas_sigla (sigla)
) ENGINE=InnoDB;

INSERT IGNORE INTO marcas (nombre, sigla) VALUES
  ('Toyota', 'TY'),
  ('Honda', 'HN'),
  ('Ford', 'FD'),
  ('Chevrolet', 'CV'),
  ('Nissan', 'NS'),
  ('Hyundai', 'HY'),
  ('Kia', 'KA'),
  ('Volkswagen', 'VW'),
  ('Mercedes-Benz', 'MB'),
  ('BMW', 'BM'),
  ('Audi', 'AU'),
  ('Tesla', 'TS'),
  ('Porsche', 'PR'),
  ('Ferrari', 'FR'),
  ('Lamborghini', 'LB');

CREATE TABLE IF NOT EXISTS vehiculos (
  codigo VARCHAR(10) NOT NULL,
  marca_id SMALLINT UNSIGNED NOT NULL,
  modelo VARCHAR(120) NOT NULL,
  anio SMALLINT UNSIGNED NOT NULL,
  color VARCHAR(60) NOT NULL,
  combustible ENUM('Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)') NOT NULL,
  precio DECIMAL(12, 2) NOT NULL,
  cantidad INT UNSIGNED NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (codigo),
  KEY ix_vehiculos_marca (marca_id),
  CONSTRAINT fk_vehiculos_marca
    FOREIGN KEY (marca_id) REFERENCES marcas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_vehiculos_anio CHECK (anio BETWEEN 1900 AND 2100),
  CONSTRAINT chk_vehiculos_precio CHECK (precio > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  password VARCHAR(255) NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo)
) ENGINE=InnoDB;