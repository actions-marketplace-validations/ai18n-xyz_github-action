const axios = require('axios');
const core = require('@actions/core');
const fs = require('fs');
const FormData = require('form-data');

const UPLOAD_STRINGS_ENDPOINT = "https://c2d1-69-38-171-2.ngrok-free.app/github-actions/upload-strings";

async function run() {
  try {
    const stringsPath = core.getInput('strings_path');
    const targetLocales = core.getInput('target_locales');
    const fileStream = fs.readFileSync(stringsPath, 'utf8');

    const ai18nProjectId   = process.env.AI18N_PROJECT_ID;
    const ai18nUploadToken = process.env.AI18N_UPLOAD_TOKEN;
    const githubRepository = process.env.GITHUB_REPOSITORY;

    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('project_id', ai18nProjectId);
    formData.append('upload_token', ai18nUploadToken);
    formData.append('target_locale_isos', targetLocales);
    formData.append('github_repository', githubRepository);

    const response = await axios.post(UPLOAD_STRINGS_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
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
