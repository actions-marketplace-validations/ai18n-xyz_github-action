const axios = require('axios');
const core = require('@actions/core');
const FormData = require('form-data');
const fs = require('fs');
const parser = require('@babel/parser');
const path = require('path');
const SHA3 = require('crypto-js/sha3');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

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
// function extractLocalizeStrings(files) {
//   let localizationMap = {};

//   files.forEach((file) => {
//     const code = fs.readFileSync(file, 'utf8');
//     const ast = parser.parse(code, {
//       sourceType: 'module',
//       plugins: ['jsx', 'typescript'],
//     });

//     traverse(ast, {
//       CallExpression(path) {
//         if (path.node.callee.name === 't') {
//           const arg = path.node.arguments[0];
//           if (arg && arg.type === 'StringLiteral') {
//             const text = arg.value;
//             const hash = SHA3(text).toString();
//             localizationMap[hash] = text;
//           }
//         }
//       },
//     });
//   });

//   return localizationMap;
// }

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
        if (t.isIdentifier(path.node.callee, { name: 't' })) {
          const arg = path.node.arguments[0];

          // Handle string literals
          if (t.isStringLiteral(arg)) {
            const textObject = { text: arg.value };
            const hash = SHA3(JSON.stringify(textObject)).toString();
            localizationMap[hash] = textObject;
          }
          // Handle object expressions
          else if (t.isObjectExpression(arg)) {
            const properties = arg.properties;
            let textObject = {};
            properties.forEach(prop => {
              if (t.isObjectProperty(prop) && t.isStringLiteral(prop.value)) {
                textObject[prop.key.name || prop.key.value] = prop.value.value;
              }
            });
            const hash = SHA3(JSON.stringify(textObject)).toString();
            localizationMap[hash] = textObject;
          }
        }
      },
    });
  });

  return localizationMap;
}

// Main function to generate localization map
function generateLocalizationMap() {
  const source_path = core.getInput('source_path');
  const files = getFiles(source_path); // Point this to your source files directory
  const localizationMap = extractLocalizeStrings(files);
  fs.writeFileSync('localizationMap.json', JSON.stringify(localizationMap, null, 2), 'utf8');
}

async function run() {
  const GITHUB_ACTION_API_ENTRYPOINT = "https://alwaysbcoding.ngrok.io/github-actions/entrypoint";

  try {
    const config = JSON.parse(fs.readFileSync('./src/blendin.json', 'utf8'));

    generateLocalizationMap();

    if (!fs.existsSync('localizationMap.json')) {
      throw new Error('localizationMap.json file not found.');
    }

    const localizationMap = fs.createReadStream('localizationMap.json');

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepository = process.env.GITHUB_REPOSITORY;
    const GITHUB_REPOSITORY_INFO_URI = `https://api.github.com/repos/${githubRepository}`;

    var repoDetails = {};

    try {
      const repoResponse = await axios.get(GITHUB_REPOSITORY_INFO_URI, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const repoData = repoResponse.data;

      repoDetails = {
        id: repoData.id,
        name: repoData.name,
        url: repoData.html_url,
        is_private: repoData.private
      }
    } catch (error) {
      console.log(`GOT Github API ERROR`);
      console.log(error);
    }

    const formData = new FormData();
    formData.append('file', localizationMap);

    formData.append('project_id', config.projectId);
    formData.append('api_token', config.apiToken); // read from environment variable in production

    formData.append('source_locale', config.sourceLocale);
    formData.append('default_locale', config.defaultLocale);
    formData.append('target_locales', config.targetLocales.join(','));

    formData.append('base_branch_name', config.baseBranchName);
    formData.append('pr_branch_name', config.prBranchName);
    formData.append('locales_path', config.localesPath);

    formData.append('github_repository_id', `${repoDetails.id}`);
    formData.append('github_repository_name', `${repoDetails.name}`);
    formData.append('github_repository_url', `${repoDetails.url}`);
    formData.append('github_repository_is_private', `${repoDetails.is_private}`);

    const response = await axios.post(GITHUB_ACTION_API_ENTRYPOINT, formData, {
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
