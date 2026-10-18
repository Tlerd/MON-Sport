-- Brief F-012 (UC-8, AC-14, ADR 0004): notify the 'lobby' channel whenever a Match row is inserted or changes status or joinedCount.
CREATE OR REPLACE FUNCTION match_notify_lobby() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('lobby', NEW."id"::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Match_notify_lobby"
  AFTER INSERT OR UPDATE OF "status", "joinedCount" ON "Match"
  FOR EACH ROW
  EXECUTE FUNCTION match_notify_lobby();
