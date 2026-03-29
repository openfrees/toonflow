'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = path.join(__dirname, '..');

function resolvePreferredEnvFile() {
  
  if (process.env.APP_ENV_FILE) {
    return process.env.APP_ENV_FILE;
  }

  if (process.env.npm_lifecycle_event === 'dev') {
    return '.env.localhost';
  }

  if (process.env.npm_lifecycle_event === 'start') {
    return '.env.production';
  }

  if (process.env.EGG_SERVER_ENV === 'local' || process.env.NODE_ENV === 'development') {
    return '.env.localhost';
  }

  if (process.env.EGG_SERVER_ENV === 'prod' || process.env.NODE_ENV === 'production') {
    return '.env.production';
  }
  return '.env.localhost';
}

function resolveEnvPath() {
  const preferredFile = resolvePreferredEnvFile();
  const preferredPath = path.isAbsolute(preferredFile)
    ? preferredFile
    : path.join(projectRoot, preferredFile);

  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  return path.join(projectRoot, '.env');
}

const envPath = resolveEnvPath();
dotenv.config({ path: envPath });

module.exports = {
  envPath,
};
