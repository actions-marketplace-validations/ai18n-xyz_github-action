const axios = require('axios');
const core = require('@actions/core');
const FormData = require('form-data');
const fs = require('fs');
const parser = require('@babel/parser');
const path = require('path');
const SHA3 = require('crypto-js/sha3');
const traverse = require('@babel/traverse').default;
const { execSync } = require('child_process');

// Helper function to get all files in directory recursively
function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = dir + '/' + files[i];
    if (fs.statSync(name).isDirectory() && !name.includes('node_modules')) {
      getFiles(name, files_);
    } else if (name.match(/\.(jsx?|tsx?)$/)) {
      files_.push(name);
    }
  }
  return files_;
}

// Helper function to extract localize function calls and create hash map
function extractLocalizeStrings(files) {
  let localizationMap = {};

  files.forEach((file) => {
    const code = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      CallExpression(path) {
        if (path.node.callee.name === 't') {
          const arg = path.node.arguments[0];
          if (arg && arg.type === 'StringLiteral') {
            const text = arg.value;
            const hash = SHA3(text).toString();
            localizationMap[hash] = text;
          }
        }
      },
    });
  });

  return localizationMap;
}

// Main function to generate localization map
function generateLocalizationMap() {
  const files = getFiles('./src'); // Point this to your source files directory
  const localizationMap = extractLocalizeStrings(files);
  fs.writeFileSync('localizationMap.json', JSON.stringify(localizationMap, null, 2), 'utf8');
}

async function run() {
  const UPLOAD_STRINGS_ENDPOINT = "https://alwaysbcoding.ngrok.io/github-actions/upload-strings";

  try {
    generateLocalizationMap();

    if (!fs.existsSync('localizationMap.json')) {
      throw new Error('localizationMap.json file not found.');
    }

    const localizationMap = fs.createReadStream('localizationMap.json');

    const blendinProjectId   = process.env.BLENDIN_PROJECT_ID;
    const blendinUploadToken = process.env.BLENDIN_UPLOAD_TOKEN;
    const githubRepository = process.env.GITHUB_REPOSITORY;

    const formData = new FormData();
    formData.append('file', localizationMap);
    formData.append('project_id', blendinProjectId);
    formData.append('upload_token', blendinUploadToken);
    formData.append('github_repository', githubRepository);

    const response = await axios.post(UPLOAD_STRINGS_ENDPOINT, formData, {
      headers: formData.getHeaders()
    });

    if (response.status === 200) {
      console.log('Successfully synchronized strings file');
    } else if (response.status === 201) {
      console.log('Successfully uploaded new strings file');
    }
  } catch (error) {
    const failureMessage = error.message;
    core.setFailed(failureMessage);
  }
}

run();
