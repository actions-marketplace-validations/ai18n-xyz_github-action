const axios = require('axios');
const core = require('@actions/core');
const fs = require('fs');

const UPLOAD_STRINGS_ENDPOINT = "https://996c-2603-7000-4e3e-f133-9909-6d11-f267-60ae.ngrok-free.app/upload-strings";

async function run() {
  try {
    const stringsPath = core.getInput('strings_path');
    const targetLocales = core.getInput('target_locales');
    const fileContent = fs.readFileSync(stringsPath, 'utf8');

    const ai18nProjectId = process.env.AI18N_PROJECT_ID;
    const ai18nUploadToken = process.env.AI18N_UPLOAD_TOKEN;

    const response = await axios.post(UPLOAD_STRINGS_ENDPOINT, {
      project_id: ai18nProjectId,
      upload_token: ai18nUploadToken,
      strings: fileContent,
      target_locales: targetLocales
    });

    if (response.status === 200) {
      console.log('Successfully uploaded strings file');
    } else {
      core.setFailed('Failed to upload strings file');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
