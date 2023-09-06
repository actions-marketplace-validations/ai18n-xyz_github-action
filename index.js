const axios = require('axios');
const core = require('@actions/core');
const fs = require('fs');

const UPLOAD_STRINGS_ENDPOINT = "https://996c-2603-7000-4e3e-f133-9909-6d11-f267-60ae.ngrok-free.app/upload-strings";

async function run() {
  try {
    const ai18nStringsPath = core.getInput('ai18n_strings_path');
    const fileContent = fs.readFileSync(ai18nStringsPath, 'utf8');

    const response = await axios.post(UPLOAD_STRINGS_ENDPOINT, {
      data: fileContent,
    });

    if (response.status === 200) {
      console.log('Successfully uploaded ai18n-strings.yml');
    } else {
      core.setFailed('Failed to upload ai18n-strings.yml');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
