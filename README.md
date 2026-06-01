# Breja Family Tree — Repository

This folder contains **two family tree applications**:

## 🌐 Static Site (GitHub Pages Ready)

- `index.html`, `script.js`, `style.css` — pure HTML/CSS/JS tree viewer
- `data/family.json` — family dataset with parent/sibling/spouse links
- `img/` — photo directory

Preview locally:
```bash
python -m http.server 8000  # open http://localhost:8000
```

## 🎨 Streamlit Interactive App (main.py)

A feature-rich, interactive family tree builder with:

### ✨ High Impact Improvements
- **File-based persistence** — trees auto-save to `.streamlit_family_tree.json` (no URL length limits!)
- **Search bar** — find people by name in the sidebar
- **Delete confirmation** — prevents accidental deletion
- **Selected person highlighting** — visual feedback in tree SVG
- **Notes & image fields** — add rich metadata to each person

### 🔧 Medium Impact Improvements
- **Type annotations** — full typing for IDE support & clarity
- **Consolidated forms** — reusable `person_form()` helper reduces duplication
- **Better error messages** — contextual details (e.g., "only 5 years apart" vs generic errors)
- **Responsive SVG** — media queries for mobile; scales properly on small screens
- **Comprehensive unit tests** — 30+ tests covering all core logic

### Features
- ✅ Multiple entry modes: Add Person, Quick Add, Link Existing
- ✅ Full family tree visualization with expand/collapse
- ✅ Validation: circular references, age gaps, sex/role checks
- ✅ Relationship queries: parents, grandparents, siblings, cousins, aunts/uncles
- ✅ JSON export/import
- ✅ Auto-save on every change

### Getting Started

```bash
# Install dependencies
python -m pip install -r requirements.txt

# Run the app
streamlit run main.py
```

The app opens at `http://localhost:8501`.

### Run Tests

```bash
pytest test_family_tree.py -v
```

Tests cover:
- Person model (add/remove children/spouses)
- Validation (dates, age gaps, circular references)
- Family relationships (parents, grandparents, siblings, cousins)
- JSON serialization round-trips
- 30+ test cases total

### File Structure

```
Family_Tree/
├── main.py                      # Streamlit app (improved)
├── test_family_tree.py          # Unit tests
├── requirements.txt             # Python dependencies
├── .env.example                 # Sample environment variables
├── .streamlit_family_tree.json  # Persisted tree (auto-created)
├── index.html                   # Static site entry
├── script.js                    # Static site rendering
├── style.css                    # Static site styles
├── data/                        # Static site data
├── img/                         # Photos
└── README.md                    # This file
```

### Notes

- **Persistence**: Streamlit app saves to `.streamlit_family_tree.json` in the workspace folder (survives restarts)
- **Formats**: Static site uses different JSON schema (`father`/`mother` keys); Streamlit uses `parent_id` fields
- **Scaling**: Streamlit handles 100+ people smoothly; static site works with any size
- **Mobile**: Streamlit app is responsive; test it on your phone

### Environment Variables

See `.env.example`:
```bash
STREAMLIT_PORT=8501           # Custom port (default 8501)
FAMILY_JSON_PATH=.streamlit_family_tree.json  # Custom save location
VERBOSE=false                 # Enable debug logging
```

Create a `.env` file and load it:
```bash
cp .env.example .env
# Edit .env as needed
```

### Backups

Your original `Family_Tree` folder was backed up at:
```
../backups/Family_Tree_backup_<timestamp>/
```
