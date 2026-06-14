# Andrew's Portfolio

A standalone Flask portfolio for showcasing personal projects, experiments, and development work.

## Run locally

1. Create and activate a virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and replace the placeholder values.
4. Run the site with `python app.py`.

## Customize

- Update the `PROJECTS` list in `app.py` with real projects and links.
- Replace the starter biography and toolbox in `templates/about.html`.
- Set your email, GitHub, LinkedIn, title, and public URL in `.env`.
- Adjust the color tokens at the top of `static/css/style.css` to change the visual theme.

Before production, set `FLASK_ENV=production`, use a unique long `FLASK_SECRET_KEY`, and set the public `SITE_URL`.

## Create the new repository

This directory has a fresh Git history. Create an empty repository on GitHub and connect it:

```powershell
git remote add origin https://github.com/your-username/my-portfolio-website.git
git add .
git commit -m "Create personal portfolio website"
git push -u origin main
```

## Checks

```powershell
python -m unittest discover -s tests
```
