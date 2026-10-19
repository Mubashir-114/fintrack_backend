-- Apply explicitly to Aiven to enable avatar storage. No automatic startup migration.
-- Before this migration, authenticated avatar operations return 503; other routes remain available.
-- Match users.id type (current schema: INT UNSIGNED) and InnoDB. One bounded avatar per user.
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  jpeg MEDIUMBLOB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_avatar_owner FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_avatar_size CHECK (OCTET_LENGTH(jpeg) <= 262144)
) ENGINE=InnoDB;
