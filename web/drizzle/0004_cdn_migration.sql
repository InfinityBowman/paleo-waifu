UPDATE creature SET image_url = REPLACE(image_url, '/api/images/', 'https://cdn.jacobmaynard.dev/') WHERE image_url LIKE '/api/images/%';
UPDATE banner SET image_url = REPLACE(image_url, '/api/images/', 'https://cdn.jacobmaynard.dev/') WHERE image_url LIKE '/api/images/%';
