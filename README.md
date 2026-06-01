# Breja Family Tree

This repository hosts a **static family tree website** built with HTML, CSS, and JavaScript.

## What is included

- `index.html` — static site entry point
- `script.js` — JavaScript for rendering the family tree and search highlighting
- `style.css` — styling for the web app
- `data/family.json` — the family tree dataset
- `img/` — image assets used by the site

## Run locally

```bash
cd /Users/vbreja/Desktop/Different_Works/Family_Tree
python -m http.server 8000
```

Then open:

```bash
http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repository to GitHub if not already pushed.
2. Open the GitHub repo in your browser.
3. Go to **Settings** → **Pages**.
4. Under **Source**, select **main** branch and **/root** folder.
5. Save and wait a minute for GitHub Pages to publish.

Your site will usually appear at:

```bash
https://<your-username>.github.io/<repo-name>/
```

## Update the family tree

Edit `data/family.json` with your family members.

## Notes

- This repo is now static-only.
- There is no Streamlit or Python app included.
- Visitors can view the tree, but cannot edit it through the website.
