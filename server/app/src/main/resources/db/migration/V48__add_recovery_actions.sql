PRAGMA foreign_keys = ON;

CREATE TABLE recovery_actions (
    id TEXT PRIMARY KEY NOT NULL,
    actor_user_id TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    requested_at VARCHAR(50) NOT NULL,
    started_at VARCHAR(50),
    completed_at VARCHAR(50),
    result_code VARCHAR(100),
    result_message VARCHAR(500),
    executor VARCHAR(50) NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX recovery_actions_actor_requested_idx
    ON recovery_actions(actor_user_id, requested_at DESC);

CREATE INDEX recovery_actions_status_idx ON recovery_actions(status);

CREATE UNIQUE INDEX recovery_actions_single_active_idx
    ON recovery_actions((1))
    WHERE status IN ('ACCEPTED', 'RUNNING');
