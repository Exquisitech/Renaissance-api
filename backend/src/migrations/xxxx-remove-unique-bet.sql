DROP INDEX "IDX_user_match_unique";
CREATE INDEX "IDX_user_match" ON bets(user_id, match_id);