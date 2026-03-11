<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/556d45ee-a375-4ef8-8389-45b4702c9229

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

1. Make sure `homepage` in `package.json` is set to `https://<YOUR_GITHUB_USERNAME>.github.io/Findyourseat`.
2. Install the deployment package: `npm install --save-dev gh-pages`.
3. Build and publish the `dist` folder by running:
   ```bash
   npm run predeploy
   npm run deploy
   ```
4. In your repository settings on GitHub, enable GitHub Pages using the `gh-pages` branch.

> ⚠️ Replace `<YOUR_GITHUB_USERNAME>` with your actual GitHub username. If your repo is under an organization, adjust the URL accordingly.
