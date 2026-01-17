-- DEV SEED: populates 50 seekers + 10 retainers

TRUNCATE TABLE seekers RESTART IDENTITY CASCADE;
TRUNCATE TABLE retainers RESTART IDENTITY CASCADE;

-- 50 seekers
INSERT INTO seekers (
  name, company_dba, birthday, city, state, zip, years_in_business,
  delivery_verticals, vehicle, insurance,
  ref1_name, ref1_phone, ref1_email, ref1_company,
  ref2_name, ref2_phone, ref2_email, ref2_company, status
)
SELECT
  'Seeker ' || i,
  'DBA ' || i,
  (DATE '1980-01-01' + (i || ' days')::interval),
  'City' || (i % 10),
  'ST',
  lpad((70000 + i)::text, 5, '0'),
  (i % 15),
  ARRAY[ (ARRAY['Medical','On-Demand','Final Mile'])[(i % 3) + 1] ],
  'Van Model ' || (i % 5),
  'Commercial',
  'RefA ' || i, '555-100' || i, 'refA' || i || '@mail.com', 'RefCoA ' || i,
  'RefB ' || i, '555-200' || i, 'refB' || i || '@mail.com', 'RefCoB ' || i,
  CASE WHEN i % 4 = 0 THEN 'approved' WHEN i % 5 = 0 THEN 'rejected' ELSE 'pending' END
FROM generate_series(1,50) AS s(i);

-- 10 retainers
INSERT INTO retainers (
  company, ceo, city, state, zip, mission, employees,
  delivery_verticals, desired_traits, status
)
SELECT
  'Company ' || i,
  'CEO ' || i,
  'Metro' || i,
  'ST',
  lpad((90000 + i)::text, 5, '0'),
  'Mission statement ' || i,
  (10 + i),
  ARRAY[ (ARRAY['Medical','On-Demand','Scheduled'])[(i % 3) + 1] ],
  ARRAY[ (ARRAY['Reliable','Punctual','Communicative'])[(i % 3) + 1] ],
  CASE WHEN i % 3 = 0 THEN 'approved' ELSE 'pending' END
FROM generate_series(1,10) AS s(i);

