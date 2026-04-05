#!/bin/bash

# A simple helper script to deploy changes to GitHub Pages
# Use this when you've made local changes to the code.

echo "🚀 Preparing deployment to GitHub Pages..."

# 1. Add all changes
git add -A

# 2. Prompt for commit message
echo -n "Enter commit message (or press enter for default): "
read COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Deploy website updates"
fi

# 3. Commit and push
git commit -m "$COMMIT_MSG"

echo "☁️ Pushing to GitHub Main Branch..."
git push origin main

echo ""
echo "✅ Push successful! The GitHub Actions workflow will now build and deploy the site."
echo "You can check the progress at: https://github.com/quarkxtech/quarkxtech.github.io/actions"
