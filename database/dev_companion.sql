CREATE DATABASE IF NOT EXISTS dev_companion;
USE dev_companion;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  owner_username VARCHAR(80) NULL,
  owner_display_name VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ideas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(80),
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  owner_username VARCHAR(80) NULL,
  owner_display_name VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ideas_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS errors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  technology VARCHAR(80),
  solution TEXT,
  status ENUM('pending', 'resolved') NOT NULL DEFAULT 'pending',
  owner_username VARCHAR(80) NULL,
  owner_display_name VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_errors_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  topic VARCHAR(80),
  owner_username VARCHAR(80) NULL,
  owner_display_name VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE SET NULL
);

INSERT INTO projects (title, description, status)
SELECT 'Dev Companion', 'Main capstone project tracking app.', 'in_progress'
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE title = 'Dev Companion'
);
