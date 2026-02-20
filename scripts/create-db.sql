-- Create database if it doesn't exist
SELECT 'CREATE DATABASE dakiybuilds'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dakiybuilds')\gexec
