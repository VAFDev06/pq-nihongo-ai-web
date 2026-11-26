-- Align srs_level / previous_level / new_level columns with JPA Integer (INT4) for Hibernate ddl-auto=validate
ALTER TABLE card_progress ALTER COLUMN srs_level TYPE INT;
ALTER TABLE review_logs ALTER COLUMN previous_level TYPE INT;
ALTER TABLE review_logs ALTER COLUMN new_level TYPE INT;
