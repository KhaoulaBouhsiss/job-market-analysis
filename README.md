# JobScope — Smart Job Market Dashboard

Application web Flask + MySQL + Chart.js pour analyser un marché de l'emploi : dashboard, analytics, table filtrable et import CSV.

## 📁 Structure

```
job-market-dashboard/
├── app.py                  ← Backend Flask (API)
├── db.py                   ← Connexion MySQL
├── seed_data.py            ← Données d'exemple (pour "Restore Sample")
├── schema.sql              ← Script SQL (à exécuter dans MySQL Workbench)
├── sample_data.csv         ← CSV d'exemple pour tester l'import
├── requirements.txt
├── .env.example
├── templates/index.html
└── static/
    ├── css/style.css
    └── js/main.js
```

## ⚙️ 1. Base de données (MySQL Workbench)

1. Ouvre **MySQL Workbench** et connecte-toi à ton serveur local.
2. Ouvre le fichier `schema.sql` (File > Open SQL Script).
3. Exécute tout le script (icône éclair ⚡ ou `Ctrl+Shift+Enter`).
   → Cela crée la base `job_market_db`, la table `job_listings`, et insère **80 lignes** de données d'exemple.

## ⚙️ 2. Configuration Python

```bash
cd job-market-dashboard
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
```

## ⚙️ 3. Variables d'environnement

Copie `.env.example` en `.env` :

```bash
copy .env.example .env          # Windows
# cp .env.example .env          # Mac/Linux
```

Modifie `.env` avec **tes identifiants MySQL** :

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=ton_mot_de_passe_mysql
DB_NAME=job_market_db
```

## 🚀 4. Lancer l'application

```bash
python app.py
```

Ouvre **http://localhost:5000**

## 🔄 Fonctionnalités

### Dashboard
- 4 cartes statistiques : nombre total d'offres, salaire moyen, compétence la plus demandée, industrie leader
- Graphique en aires : évolution du nombre d'offres par mois
- Graphique circulaire : répartition par industrie
- Donut : répartition par mode de travail (Remote/Hybrid/Onsite)
- Graphique en barres : répartition par niveau d'expérience

### Analytics
- Compétences les plus demandées (top 10)
- Distribution des salaires (histogramme par tranches)
- Évolution du salaire moyen dans le temps

### Browse Data
- Table avec recherche (titre, entreprise, compétences)
- Filtres : industrie, mode de travail, expérience
- Pagination
- Export CSV (respecte les filtres actifs)

### Upload CSV
- Glisser-déposer un fichier CSV
- Interface de mapping : associe chaque colonne de ton fichier au schéma attendu
- Bouton "Restaurer l'échantillon" pour revenir aux données de démo

## 🗄️ Schéma de données

| Colonne            | Type         | Exemple                  |
|--------------------|--------------|--------------------------|
| job_title          | VARCHAR(150) | Software Engineer        |
| company            | VARCHAR(150) | Acme Corp                 |
| industry           | VARCHAR(100) | Technology                |
| location           | VARCHAR(150) | New York, NY              |
| work_mode          | VARCHAR(20)  | Remote / Hybrid / Onsite  |
| experience_level   | VARCHAR(20)  | Entry / Mid / Senior / Lead |
| salary             | INT          | 95000                     |
| skills             | VARCHAR(255) | Python, SQL, AWS          |
| posted_date        | DATE         | 2025-09-12                |
