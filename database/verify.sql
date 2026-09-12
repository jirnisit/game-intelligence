-- Read-only assertions for the screenshot seed, run against an isolated test DB.
DO $$
BEGIN
  IF (SELECT count(*) FROM characters) <> 3 THEN RAISE EXCEPTION 'Expected 3 characters'; END IF;
  IF EXISTS (SELECT c.id FROM characters c LEFT JOIN skills s ON s.character_id=c.id GROUP BY c.id HAVING count(s.id) <> 6) THEN RAISE EXCEPTION 'Expected 6 skill categories each'; END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM skills WHERE has_hold) <> ARRAY['eliade-special','mei-normal_attack'] THEN RAISE EXCEPTION 'Incorrect hold actions'; END IF;
  IF EXISTS (SELECT 1 FROM skills WHERE name->>'en' IS NULL OR name->>'th' IS NULL OR description->>'th' IS NULL) THEN RAISE EXCEPTION 'Missing translations'; END IF;
  IF (SELECT value FROM effects WHERE status_id='mei-rift' AND awakening_from <= 2 AND (awakening_until IS NULL OR 2 < awakening_until)) <> 80 THEN RAISE EXCEPTION 'A2 ATK replacement'; END IF;
  IF (SELECT max_stacks FROM status_rules WHERE status_id='mei-collapse' AND awakening_from=5) <> 5 THEN RAISE EXCEPTION 'Collapse A5 stacks'; END IF;
  IF (SELECT value FROM effects WHERE status_id='mei-collapse' AND awakening_from=5) <> 400 THEN RAISE EXCEPTION 'Collapse A5 damage'; END IF;
  IF (SELECT count(*) FROM effects WHERE status_id='eliade-ruin' AND awakening_from=5 AND value=4) <> 2 THEN RAISE EXCEPTION 'Ruin A5 effects'; END IF;
  IF EXISTS (SELECT 1 FROM status_rules a JOIN status_rules b ON a.status_id=b.status_id AND a.id<b.id WHERE int4range(a.awakening_from,a.awakening_until,'[)') && int4range(b.awakening_from,b.awakening_until,'[)')) THEN RAISE EXCEPTION 'Overlapping rules'; END IF;
  IF EXISTS (SELECT 1 FROM effects a JOIN effects b ON a.character_id=b.character_id AND a.id<b.id AND a.status_id=b.status_id AND a.effect_type=b.effect_type AND a.stat_code IS NOT DISTINCT FROM b.stat_code WHERE int4range(a.awakening_from,a.awakening_until,'[)') && int4range(b.awakening_from,b.awakening_until,'[)')) THEN RAISE EXCEPTION 'Overlapping status effects'; END IF;
  IF (SELECT count(DISTINCT e.character_id) FROM effects e JOIN status_applications a ON a.status_id=e.status_id WHERE e.stat_code='crit_dmg' AND e.effect_type='stat_increase' AND e.target='all_allies' AND a.target='all_allies') <> 1 THEN RAISE EXCEPTION 'Incorrect direct team crit filter'; END IF;
  -- Ownership must reject mixing Mei actions with Helen's skill.
  BEGIN
    INSERT INTO effects(id,character_id,skill_id,effect_type,target,description) VALUES ('invalid','mei','helen-special','heal','self','{}');
    RAISE EXCEPTION 'Cross-character action was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
