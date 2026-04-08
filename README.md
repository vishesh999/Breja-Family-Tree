# Breja Family Tree

A private, self-hosted family tree web app. Deployed via GitHub Pages.

## How to add a family member

Edit `data/family.json`. Each person supports these fields:

| Field | Description |
|---|---|
| `id` | Unique key (no spaces) |
| `name` | Full display name |
| `role` | e.g. Son, Daughter-in-law, Patriarch |
| `status` | `"living"` or `"deceased"` |
| `img` | Path to photo, e.g. `img/name.jpeg` |
| `father` | `id` of father |
| `mother` | `id` of mother |
| `spouse` | `id` of spouse (must be set on both partners) |
| `sibling` | Array of sibling `id`s |

## How to add a photo

Drop the image file (JPEG or PNG) into the `img/` folder. Reference it as `"img/filename.jpeg"` in `family.json`. If no photo is provided, a tasteful silhouette placeholder is shown automatically.

## GitHub Pages deployment

1. Push to `main` branch.
2. Go to **Settings → Pages → Source: Deploy from branch → main / root**.
3. The site is live at `https://<your-username>.github.io/Breja-Family-Tree/`.
