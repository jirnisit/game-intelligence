-- Read-only structural checks, independent of how many local characters exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM characters c LEFT JOIN skills s ON s.character_id=c.id GROUP BY c.id HAVING count(s.id) <> 6) THEN RAISE EXCEPTION 'Expected six skill categories for complete local characters'; END IF;
  IF EXISTS (SELECT 1 FROM skills WHERE name->>'en' IS NULL OR name->>'th' IS NULL OR description->>'en' IS NULL OR description->>'th' IS NULL) THEN RAISE EXCEPTION 'Missing translations'; END IF;
  IF EXISTS (SELECT 1 FROM status_rules a JOIN status_rules b ON a.status_id=b.status_id AND a.id<b.id
    AND (a.character_id IS NULL OR b.character_id IS NULL OR a.character_id=b.character_id)
    WHERE int4range(a.awakening_from,a.awakening_until,'[)') && int4range(b.awakening_from,b.awakening_until,'[)')) THEN RAISE EXCEPTION 'Overlapping status rule intervals'; END IF;
  IF EXISTS (SELECT 1 FROM character_statuses cs JOIN characters c ON c.id=cs.character_id JOIN statuses s ON s.id=cs.status_id WHERE c.game_id<>s.game_id) THEN RAISE EXCEPTION 'Cross-game status usage'; END IF;
  IF EXISTS (SELECT 1 FROM status_applications a JOIN characters c ON c.id=a.character_id JOIN statuses s ON s.id=a.status_id WHERE c.game_id<>s.game_id) THEN RAISE EXCEPTION 'Cross-game status application'; END IF;
  IF EXISTS (SELECT 1 FROM status_applications a WHERE NOT EXISTS (SELECT 1 FROM character_statuses cs WHERE cs.character_id=a.character_id AND cs.status_id=a.status_id AND cs.target=a.target)) THEN RAISE EXCEPTION 'Application is missing a status usage link'; END IF;
END $$;
